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
            // 1️⃣ 체크리스트 불러오기
            setStatusMessage('체크리스트 로드 중...');

            let evidence: EvidenceModule;
            if (scenarioId) {
                evidence = await loadChecklistFromScenario(scenarioId);
            } else if (checklistId) {
                evidence = await loadChecklistFromDB(checklistId);
            } else {
                const loaded = await loadChecklistByCase(caseName!);
                evidence = loaded.evidence;
            }

            // evidence(named exports)
            const {
                HistoryEvidenceChecklist = [],
                PhysicalexamEvidenceChecklist = [],
                EducationEvidenceChecklist = [],
                PpiEvidenceChecklist = [],
            } = evidence;

            // score(named exports)
            // const {
            //     HistoryScoreChecklist = [],
            //     PhysicalExamScoreChecklist = [],
            //     EducationScoreChecklist = [],
            //     PpiScoreChecklist = [],
            // } = score;
            // 이미 transcript 존재 → 다운로드 URL 생성
            const transcriptUrl = await generateDownloadUrl(bucket as string, key);

            // URL로 실제 파일 내용 요청
            const res = await fetch(transcriptUrl);
            if (!res.ok) throw new Error("Transcript 다운로드 실패");

            // 내용 읽기 (텍스트 파일)
            const transcript = await res.text();

            // 병렬 증거 수집

            const checklistMap: Record<'history' | 'physical_exam' | 'education' | 'ppi', EvidenceChecklist[]> = {
                history: HistoryEvidenceChecklist,
                physical_exam: PhysicalexamEvidenceChecklist,
                education: EducationEvidenceChecklist,
                ppi: PpiEvidenceChecklist,
            };

            // const scoreChecklistMap: Record<'history' | 'physical_exam' | 'education' | 'ppi', ScoreChecklist[]> = {
            //     history: HistoryScoreChecklist,
            //     physical_exam: PhysicalExamScoreChecklist,
            //     education: EducationScoreChecklist,
            //     ppi: PpiScoreChecklist,
            // };

            const sectionIds = Object.keys(checklistMap) as (keyof typeof checklistMap)[];


            // 3️⃣ 채점 + 섹션 분류 병렬 수행
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

            // VP timestamps 다운로드 (있으면)
            let turnTimestamps: TurnTimestamp[] | undefined;
            let sessionDurationSec: number | undefined;
            if (timestampsS3Key && bucket) {
                try {
                    const tsUrl = await generateDownloadUrl(bucket, timestampsS3Key);
                    const tsRes = await fetch(tsUrl);
                    if (tsRes.ok) {
                        const tsData: TimestampsPayload = await tsRes.json();
                        turnTimestamps = tsData.turns;
                        sessionDurationSec = tsData.sessionDurationSec;
                    }
                } catch (err) {
                    console.warn('[VP timestamps download failed]', err);
                }
            }

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
