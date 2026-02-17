import { SectionId } from "@/app/api/collectEvidence/route";
import { GradeItem, SectionResult, SectionTimingMap } from "@/types/score";
import { EvidenceChecklist, loadChecklistByCase, EvidenceModule } from "@/utils/loadChecklist";
import { ensureOkOrThrow, readJsonOrText } from "@/utils/score";
import { generateDownloadUrl, generateUploadUrl } from "@/app/api/s3/s3";
import { postMetadata } from "@/lib/metadata";

type SectionKey = 'history' | 'physical_exam' | 'education' | 'ppi' | null;

interface ApiSegment {
    id: number;
    start: number;
    end: number;
    text: string;
}

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

// Scenario DB 스냅샷에서 체크리스트 로드
async function loadChecklistFromScenario(scenarioId: string): Promise<EvidenceModule> {
    const res = await fetch(`/api/scenario-checklist?id=${encodeURIComponent(scenarioId)}`);
    if (!res.ok) {
        throw new Error("시나리오 체크리스트 로드 실패");
    }
    const data = await res.json();
    if (!data.checklist) {
        throw new Error("시나리오 체크리스트 데이터가 없습니다");
    }
    return data.checklist as EvidenceModule;
}

export interface PipelineResult {
    gradesBySection: Record<string, GradeItem[]>;
    timingBySection: SectionTimingMap;
}

export function useAutoPipeline(
    setStatusMessage: (msg: string | null) => void,
    setGradesBySection: (data: any) => void,
    setResults: (data: SectionResult[]) => void,
    setActiveSection: (section: SectionKey | null) => void,
    onSessionId?: (sessionId: string) => void,
    setTimingBySection?: (timing: SectionTimingMap) => void,
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
        checklistId?: string | null,
        scenarioId?: string | null,
        cachedTranscriptS3Key?: string | null,
    ): Promise<PipelineResult | null> {
        const audioKeys = (Array.isArray(keys) ? keys : [keys]).filter(Boolean);
        let activeSessionId = sessionId ?? null;
        try {
            if (audioKeys.length === 0) throw new Error('오디오 키가 없습니다.');

            // 체크리스트 로드 + 전사를 병렬 수행 (서로 독립적)
            setStatusMessage('채점 기준 로드 및 전사 중');

            const checklistPromise = (async (): Promise<EvidenceModule> => {
                if (scenarioId) {
                    return loadChecklistFromScenario(scenarioId);
                } else if (checklistId) {
                    return loadChecklistFromDB(checklistId);
                } else {
                    const loaded = await loadChecklistByCase(caseName!);
                    return loaded.evidence;
                }
            })();

            const transcriptPromise = (async () => {
                let text: string;
                let allSegments: ApiSegment[] = [];

                if (cachedTranscriptS3Key) {
                    const bucket = process.env.NEXT_PUBLIC_S3_BUCKET_NAME;
                    if (!bucket) throw new Error('S3 bucket not set');
                    const downloadUrl = await generateDownloadUrl(bucket, cachedTranscriptS3Key);
                    const dlRes = await fetch(downloadUrl);
                    if (!dlRes.ok) throw new Error('Transcript 다운로드 실패');
                    text = await dlRes.text();
                } else {
                    const transcriptParts = await Promise.all(
                        audioKeys.map(async (key) => {
                            const res1 = await fetch('/api/transcribe', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ s3_key: key }),
                            });
                            const data1 = await readJsonOrText(res1);
                            await ensureOkOrThrow(res1, data1);
                            return {
                                text: data1?.text || '',
                                segments: (data1?.segments || []) as ApiSegment[],
                            };
                        })
                    );
                    text = transcriptParts.map((p) => p.text).join('\n');

                    let timeOffset = 0;
                    for (const part of transcriptParts) {
                        for (const seg of part.segments) {
                            allSegments.push({
                                ...seg,
                                id: allSegments.length + 1,
                                start: seg.start + timeOffset,
                                end: seg.end + timeOffset,
                            });
                        }
                        if (part.segments.length > 0) {
                            timeOffset = part.segments[part.segments.length - 1].end + timeOffset;
                        }
                    }

                    // S3 전사본 업로드 (fire-and-forget, 증거수집을 블로킹하지 않음)
                    const uploadInBackground = async () => {
                        try {
                            const bucket = process.env.NEXT_PUBLIC_S3_BUCKET_NAME;
                            if (!bucket) return;
                            const scriptKey = deriveScriptKey(audioKeys);
                            if (!scriptKey) return;
                            const uploadUrl = await generateUploadUrl(bucket, scriptKey);
                            const body = new Blob([text], { type: 'text/plain; charset=utf-8' });

                            const uploadRes = await fetch(uploadUrl, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'text/plain; charset=utf-8' },
                                body,
                            });
                            if (!uploadRes.ok) throw new Error('script upload failed');

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
                        } catch (err) {
                            console.warn('[script upload failed]', err);
                        }
                    };
                    uploadInBackground();
                }

                return { text, allSegments };
            })();

            const [evidence, { text, allSegments }] = await Promise.all([
                checklistPromise,
                transcriptPromise,
            ]);

            const checklistMap = {
                history: evidence.HistoryEvidenceChecklist || [],
                physical_exam: evidence.PhysicalexamEvidenceChecklist || [],
                education: evidence.EducationEvidenceChecklist || [],
                ppi: evidence.PpiEvidenceChecklist || [],
            };

            const sectionIds = Object.keys(checklistMap) as (keyof typeof checklistMap)[];

            // 채점 + 섹션 분류 병렬 수행
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

            // classifySections를 collectEvidence와 병렬 실행
            const classifyPromise = fetch('/api/classifySections', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    transcript: text,
                    segments: allSegments.length > 0 ? allSegments : undefined,
                    caseName,
                }),
            })
                .then(async (res) => {
                    if (!res.ok) throw new Error('classifySections failed');
                    const data = await res.json();
                    return data.timing as SectionTimingMap;
                })
                .catch((err) => {
                    console.warn('[classifySections skipped]', err);
                    return null;
                });

            const [results, timingResult] = await Promise.all([
                Promise.all(resultsPromises),
                classifyPromise,
            ]);

            setResults(results);
            if (timingResult && setTimingBySection) {
                setTimingBySection(timingResult);
            }

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

            return { gradesBySection: graded, timingBySection: timingResult ?? {} };
        } catch (e: any) {
            console.error(e);
            setStatusMessage(`오류 발생: ${e.message || e}`);
            return null;
        }
    };
}
