import { SectionId } from "@/app/api/collectEvidence/route";
import { GradeItem, SectionResult } from "@/types/score";
import { EvidenceChecklist, loadChecklistByCase } from "@/utils/loadChecklist";
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

            const checklistMap = {
                history: evidence.HistoryEvidenceChecklist || [],
                physical_exam: evidence.PhysicalexamEvidenceChecklist || [],
                education: evidence.EducationEvidenceChecklist || [],
                ppi: evidence.PpiEvidenceChecklist || [],
            };

            const scoreListBySection = {
                history: score.HistoryScoreChecklist || [],
                physical_exam: score.PhysicalExamScoreChecklist || [],
                education: score.EducationScoreChecklist || [],
                ppi: score.PpiScoreChecklist || [],
            };

            const sectionIds = Object.keys(checklistMap) as (keyof typeof checklistMap)[];

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

            // 3️⃣ 채점 먼저 수행
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

            // 4️⃣ 점수 계산
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
                    return {
                        id: item.id,
                        title: item.title,
                        criteria: item.criteria,
                        evidence,
                        point,
                        max_evidence_count: maxCount,
                    };
                });
            }

            setGradesBySection(graded);
            setActiveSection('history');

            // 5️⃣ 채점 결과 기반으로 피드백 생성
            setStatusMessage('피드백 생성 중');

            const feedbackRes = await fetch('/api/feedback', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chief_complaint: caseName,
                    transcript: text,
                    graded, // checklist 대신 실제 채점 결과 사용
                }),
            });
            const feedbackData = await readJsonOrText(feedbackRes);
            await ensureOkOrThrow(feedbackRes, feedbackData);
            // 6️⃣ 완료
            setStatusMessage(null);
            setNarrativeFeedback(feedbackData);



        } catch (e: any) {
            console.error(e);
            setStatusMessage(`오류 발생: ${e.message || e}`);
        }
    };
}
