import { SectionId } from "@/app/api/collectEvidence/route";
import { GradeItem, SectionResult } from "@/types/score";
import { EvidenceChecklist, loadChecklistByCase, EvidenceModule } from "@/utils/loadChecklist";
import { ensureOkOrThrow, readJsonOrText } from "@/utils/score";
import { generateUploadUrl } from "@/app/api/s3/s3";
import { postMetadata } from "@/lib/metadata";

type SectionKey = 'history' | 'physical_exam' | 'education' | 'ppi' | null;

// DB에서 체크리스트 로드
async function loadChecklistFromDB(checklistId: string): Promise<EvidenceModule> {
    const res = await fetch(`/api/admin/checklist?id=${encodeURIComponent(checklistId)}`);
    if (!res.ok) {
        throw new Error("체크리스트 로드 실패");
    }
    const data = await res.json();

    // id로 조회한 경우 latestVersion에서 가져오기
    const checklistJson = data.latestVersion?.checklistJson || data.checklistJson;
    if (!checklistJson) {
        throw new Error("체크리스트 데이터가 없습니다");
    }

    return checklistJson as EvidenceModule;
}

export function useAutoPipeline(
    setStatusMessage: (msg: string | null) => void,
    setGradesBySection: (data: any) => void,
    setResults: (data: SectionResult[]) => void,
    setActiveSection: (section: SectionKey | null) => void,
    setDone: (done: boolean) => void,
    onSessionId?: (sessionId: string) => void,
) {
    function deriveScriptKey(audioKeys: string[]): string | null {
        const first = audioKeys[0];
        if (!first) return null;
        const normalized = first.replace(/-part\d+(?=\.mp3$)/i, '');
        const base = normalized.replace(/\.mp3$/i, '.txt');
        if (normalized.startsWith('SP_audio/')) {
            return base.replace(/^SP_audio\//, 'SP_script/');
        }
        return base;
    }

    return async function runAutoPipeline(
        keys: string | string[],
        caseName: string,
        sessionId?: string | null,
        origin: "VP" | "SP" = "SP",
        checklistId?: string | null
    ) {
        const audioKeys = (Array.isArray(keys) ? keys : [keys]).filter(Boolean);
        let activeSessionId = sessionId ?? null;
        try {
            if (audioKeys.length === 0) throw new Error('오디오 키가 없습니다.');
            // 체크리스트 로드
            setStatusMessage('채점 기준 로드 중');

            let evidence: EvidenceModule;
            if (checklistId) {
                // DB에서 체크리스트 로드
                evidence = await loadChecklistFromDB(checklistId);
            } else {
                // 기존 방식: 로컬 파일에서 로드
                const loaded = await loadChecklistByCase(caseName!);
                evidence = loaded.evidence;
            }

            const checklistMap = {
                history: evidence.HistoryEvidenceChecklist || [],
                physical_exam: evidence.PhysicalexamEvidenceChecklist || [],
                education: evidence.EducationEvidenceChecklist || [],
                ppi: evidence.PpiEvidenceChecklist || [],
            };

            // const scoreListBySection = {
            //     history: score.HistoryScoreChecklist || [],
            //     physical_exam: score.PhysicalExamScoreChecklist || [],
            //     education: score.EducationScoreChecklist || [],
            //     ppi: score.PpiScoreChecklist || [],
            // };

            const sectionIds = Object.keys(checklistMap) as (keyof typeof checklistMap)[];
            // 전사 (병렬 수행, 결과 순서 보장)
            setStatusMessage(`오디오 전사 중`);
            const transcriptParts = await Promise.all(
                audioKeys.map(async (key) => {
                    const res1 = await fetch('/api/transcribe', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ s3_key: key }),
                    });
                    const data1 = await readJsonOrText(res1);
                    await ensureOkOrThrow(res1, data1);
                    return data1?.text || '';
                })
            );
            const text = transcriptParts.join('\n');

            // 전사 결과를 S3에 저장 (SP_script/ 경로로 교체, 나머지는 동일하게 유지)
            try {
                const bucket = process.env.NEXT_PUBLIC_S3_BUCKET_NAME;
                if (!bucket) {
                    console.warn('[script upload skipped] bucket not set');
                } else {
                    const scriptKey = deriveScriptKey(audioKeys);
                    if (!scriptKey) throw new Error('scriptKey missing');
                    const uploadUrl = await generateUploadUrl(bucket, scriptKey);
                    const body = new Blob([text], { type: 'text/plain; charset=utf-8' });

                    const uploadRes = await fetch(uploadUrl, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
                        body,
                    });
                    if (!uploadRes.ok) {
                        throw new Error('script upload failed');
                    }

                    const meta = await postMetadata({
                        type: "transcript",
                        s3Key: scriptKey,
                        sessionId: activeSessionId,
                        caseName,
                        origin,
                        source: "UPLOAD",
                        textExcerpt: text.slice(0, 200),
                        textLength: text.length,
                        sizeBytes: body.size,
                    });
                    if (meta.sessionId && meta.sessionId !== activeSessionId) {
                        activeSessionId = meta.sessionId;
                        onSessionId?.(meta.sessionId);
                    }
                }
            } catch (err) {
                console.warn('[script upload failed]', err);
            }

            // 채점 먼저 수행
            setStatusMessage('채점 중');

            const resultsPromises: Promise<SectionResult>[] = sectionIds.map(async (sectionId) => {
                const res = await fetch('/api/collectEvidence', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        transcript: text,
                        evidenceChecklist: checklistMap[sectionId],
                        sectionId,
                    }),
                });
                const data = await readJsonOrText(res);
                await ensureOkOrThrow(res, data);
                return { sectionId, evidenceList: data.evidenceList || [] } as SectionResult;
            });

            const results = await Promise.all(resultsPromises);
            setResults(results);

            // 점수 계산
            const graded: Record<'history' | 'physical_exam' | 'education' | 'ppi', GradeItem[]> = {
                history: [], physical_exam: [], education: [], ppi: []
            };

            for (const { sectionId, evidenceList } of results) {
                const evidenceChecklist = checklistMap[sectionId as SectionId];
                // const scoreList = scoreListBySection[sectionId as SectionId];
                // const maxMap = Object.fromEntries(scoreList.map((s) => [s.id, s.max_evidence_count]));

                graded[sectionId as SectionId] = evidenceChecklist.map((item: EvidenceChecklist) => {
                    const ev = evidenceList.find((e) => e.id === item.id);
                    const evidence = ev?.evidence ?? [];
                    // const maxCount = maxMap[item.id] ?? 2;
                    const point = Math.min(evidence.length, 1); //추후 점수 기준 변경 시 수정 필요
                    const result = {
                        id: item.id,
                        title: item.title,
                        criteria: item.criteria,
                        evidence,
                        point,
                        max_evidence_count: 1, //추후 점수 기준 변경 시 수정 필요
                    };
                    return result
                });
            }

            setGradesBySection(graded);
            setActiveSection(null);

            // 완료
            setStatusMessage(null);
            setDone(true);



        } catch (e: any) {
            console.error(e);
            setStatusMessage(`오류 발생: ${e.message || e}`);
        }
    };
}
