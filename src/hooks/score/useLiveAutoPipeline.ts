import { SectionId } from "@/app/api/collectEvidence/route";
import { generateDownloadUrl } from "@/app/api/s3/s3";
import { GradeItem, SectionResult, SectionTimingMap } from "@/types/score";
import { EvidenceChecklist, loadChecklistByCase, ScoreChecklist, EvidenceModule } from "@/utils/loadChecklist";
import { ensureOkOrThrow, readJsonOrText } from "@/utils/score";

interface TurnTimestamp {
    text: string;
    elapsedSec: number;
}

interface TimestampsPayload {
    sessionDurationSec: number;
    turns: TurnTimestamp[];
}

type SectionKey = 'history' | 'physical_exam' | 'education' | 'ppi' | null;

// DB에서 체크리스트 로드
async function loadChecklistFromDB(checklistId: string): Promise<EvidenceModule> {
    const res = await fetch(`/api/admin/checklist?id=${encodeURIComponent(checklistId)}`);
    if (!res.ok) {
        throw new Error("체크리스트 로드 실패");
    }
    const data = await res.json();
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

export interface LivePipelineResult {
    gradesBySection: Record<string, GradeItem[]>;
    timingBySection: SectionTimingMap;
}

export function useLiveAutoPipeline(
    setStatusMessage: (msg: string | null) => void,
    setGradesBySection: (data: any) => void,
    setResults: (data: SectionResult[]) => void,
    setActiveSection: (section: SectionKey | null) => void,
    setTimingBySection?: (timing: SectionTimingMap) => void,
) {
    return async function runLiveAutoPipeline(key: string, caseName: string, checklistId?: string | null, timestampsS3Key?: string | null, scenarioId?: string | null): Promise<LivePipelineResult | null> {
        const bucket = process.env.NEXT_PUBLIC_S3_BUCKET_NAME;
        try {
            // 체크리스트 + 전사 다운로드 + 타임스탬프 다운로드를 병렬 수행
            setStatusMessage('체크리스트 로드 및 전사 다운로드 중...');

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
                const transcriptUrl = await generateDownloadUrl(bucket as string, key);
                const res = await fetch(transcriptUrl);
                if (!res.ok) throw new Error("Transcript 다운로드 실패");
                return res.text();
            })();

            const timestampsPromise = (async () => {
                if (!timestampsS3Key || !bucket) return { turnTimestamps: undefined, sessionDurationSec: undefined };
                try {
                    const tsUrl = await generateDownloadUrl(bucket, timestampsS3Key);
                    const tsRes = await fetch(tsUrl);
                    if (tsRes.ok) {
                        const tsData: TimestampsPayload = await tsRes.json();
                        return { turnTimestamps: tsData.turns, sessionDurationSec: tsData.sessionDurationSec };
                    }
                } catch (err) {
                    console.warn('[VP timestamps download failed]', err);
                }
                return { turnTimestamps: undefined, sessionDurationSec: undefined };
            })();

            const [evidence, transcript, { turnTimestamps, sessionDurationSec }] = await Promise.all([
                checklistPromise,
                transcriptPromise,
                timestampsPromise,
            ]);

            const checklistMap: Record<'history' | 'physical_exam' | 'education' | 'ppi', EvidenceChecklist[]> = {
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
                        transcript: transcript,
                        evidenceChecklist: checklistMap[sectionId],
                        sectionId,
                    }),
                });
                const data = await readJsonOrText(res);
                await ensureOkOrThrow(res, data);
                return { sectionId, evidenceList: data.evidenceList || [] } as SectionResult;
            });

            // classifySections를 collectEvidence와 병렬 실행
            const classifyBody: Record<string, unknown> = { transcript, caseName };
            if (turnTimestamps && turnTimestamps.length > 0) {
                classifyBody.turnTimestamps = turnTimestamps;
                if (sessionDurationSec) classifyBody.totalDurationSec = sessionDurationSec;
            } else {
                classifyBody.totalDurationSec = 720;
            }

            const classifyPromise = fetch('/api/classifySections', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(classifyBody),
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

            // 4️⃣ 점수 계산
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
    }
}
