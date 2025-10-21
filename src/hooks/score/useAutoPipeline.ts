// useAutoPipeline.ts
import { SectionId } from "@/app/api/collectEvidence/route";
import { GradeItem, SectionResult } from "@/types/score";
import { EvidenceChecklist, loadChecklistByCase, ScoreChecklist } from "@/utils/loadChecklist";
import { ensureOkOrThrow, readJsonOrText } from "@/utils/score";

export function useAutoPipeline(
    setStatusMessage: (msg: string | null) => void,
    setGradesBySection: (data: any) => void, 
    setResults: (data: SectionResult[]) => void,
    setActiveSection: (section: string) => void,
    setNarrativeFeedback: (data: any) => void
) {
    return async function runAutoPipeline(key: string, caseName: string) {
        try {
            // 1️⃣ 체크리스트 로드
            setStatusMessage('채점 기준 로드 중');
            const { evidence, score } = await loadChecklistByCase(caseName!);

            const {
                HistoryEvidenceChecklist = [],
                PhysicalexamEvidenceChecklist = [],
                EducationEvidenceChecklist = [],
                PpiEvidenceChecklist = [],
            } = evidence;

            const {
                HistoryScoreChecklist = [],
                PhysicalExamScoreChecklist = [],
                EducationScoreChecklist = [],
                PpiScoreChecklist = [],
            } = score;

            // evidenceChecklist 전체 합치기 (피드백용)
            const combinedChecklist = {
                history_taking: HistoryEvidenceChecklist,
                physical_exam: PhysicalexamEvidenceChecklist,
                patient_education: EducationEvidenceChecklist,
                ppi: PpiEvidenceChecklist,
            };

            // 2️⃣ 전사
            setStatusMessage('오디오 전사 중');
            const res1 = await fetch('/api/transcribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ s3_key: key }),
            });
            const data1 = await readJsonOrText(res1);
            await ensureOkOrThrow(res1, data1);
            const text = data1?.text || '';

            // 3️⃣ 병렬 처리 시작
            setStatusMessage('채점 및 피드백 생성 중');

            const checklistMap = {
                history: HistoryEvidenceChecklist,
                physical_exam: PhysicalexamEvidenceChecklist,
                education: EducationEvidenceChecklist,
                ppi: PpiEvidenceChecklist,
            };

            const scoreListBySection = {
                history: HistoryScoreChecklist,
                physical_exam: PhysicalExamScoreChecklist,
                education: EducationScoreChecklist,
                ppi: PpiScoreChecklist,
            };

            const sectionIds = Object.keys(checklistMap) as (keyof typeof checklistMap)[];

            /* ✅ 병렬로 수행되는 두 가지 주요 비동기 작업 */
            const gradingPromise = (async () => {
                const promises: Promise<SectionResult>[] = sectionIds.map(async (sectionId) => {
                    const checklist = checklistMap[sectionId];
                    const res = await fetch('/api/collectEvidence', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            transcript: text,
                            evidenceChecklist: checklist,
                            sectionId,
                        }),
                    });
                    const data = await readJsonOrText(res);
                    await ensureOkOrThrow(res, data);
                    return { sectionId, evidenceList: data.evidenceList || [] } as SectionResult;
                });

                const results = await Promise.all(promises);
                setResults(results);

                // 점수 계산
                const graded: Record<'history' | 'physical_exam' | 'education' | 'ppi', GradeItem[]> = {
                    history: [], physical_exam: [], education: [], ppi: []
                };

                for (const { sectionId, evidenceList } of results) {
                    const evidenceChecklist = checklistMap[sectionId as SectionId];
                    const scoreList = scoreListBySection[sectionId as SectionId];
                    const maxMap = Object.fromEntries(scoreList.map((s) => [s.id, s.max_evidence_count]));
                    graded[sectionId as SectionId] = evidenceChecklist.map((item: EvidenceChecklist) => {
                        const ev = evidenceList.find((e) => e.id === item.id);
                        const evidence = ev?.evidence ?? [];
                        const maxCount = maxMap[item.id] ?? 2;
                        const point = Math.min(evidence.length, maxCount);
                        return { id: item.id, title: item.title, criteria: item.criteria, evidence, point, max_evidence_count: maxCount };
                    });
                }

                setGradesBySection(graded);
                setActiveSection('history');
                return graded;
            })();

            const feedbackPromise = (async () => {
                const feedbackRes = await fetch('/api/feedback', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chief_complaint: caseName,
                        transcript: text,
                        checklist: combinedChecklist, // ✅ 채점 전 checklist 전달
                    }),
                });
                const feedbackData = await readJsonOrText(feedbackRes);
                await ensureOkOrThrow(feedbackRes, feedbackData);
                setStatusMessage(null); //일단 null로 초기화 : 겹침 방지
                setNarrativeFeedback(feedbackData);
                return feedbackData;
            })();

            // ✅ 병렬 실행 (둘 다 완료될 때까지 기다림)
            await Promise.all([gradingPromise, feedbackPromise]);

            setStatusMessage(null);
        } catch (e: any) {
            console.error(e);
            setStatusMessage(`오류 발생: ${e.message || e}`);
        }
    };
}
