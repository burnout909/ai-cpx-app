import { SectionId } from "@/app/api/collectEvidence/route";
import { generateDownloadUrl } from "@/app/api/s3/s3";
import { GradeItem, SectionResult } from "@/types/score";
import { EvidenceChecklist, loadChecklistByCase, ScoreChecklist } from "@/utils/loadChecklist";
import { ensureOkOrThrow, readJsonOrText } from "@/utils/score";

export function useLiveAutoPipeline(
    setStatusMessage: (msg: string | null) => void,
    setGradesBySection: (data: any) => void, 
    setResults: (data: SectionResult[]) => void,
    setActiveSection: (section: string) => void
) {
    return async function runLiveAutoPipeline(key: string, caseName: string) {
        const bucket = process.env.NEXT_PUBLIC_S3_BUCKET_NAME;
        try {
            // 1️⃣ 체크리스트 불러오기
            setStatusMessage('체크리스트 로드 중...');
            const { evidence, score } = await loadChecklistByCase(caseName!);

            // evidence(named exports)
            const {
                HistoryEvidenceChecklist = [],
                PhysicalexamEvidenceChecklist = [],
                EducationEvidenceChecklist = [],
                PpiEvidenceChecklist = [],
            } = evidence;

            // score(named exports)
            const {
                HistoryScoreChecklist = [],
                PhysicalExamScoreChecklist = [],
                EducationScoreChecklist = [],
                PpiScoreChecklist = [],
            } = score;
            // 이미 transcript 존재 → 다운로드 URL 생성
            const transcript = generateDownloadUrl(bucket as string, key);

            // 1️⃣ 병렬 증거 수집
            setStatusMessage('모든 섹션 증거 수집 중');

            const checklistMap: Record<'history' | 'physical_exam' | 'education' | 'ppi', EvidenceChecklist[]> = {
                history: HistoryEvidenceChecklist,
                physical_exam: PhysicalexamEvidenceChecklist,
                education: EducationEvidenceChecklist,
                ppi: PpiEvidenceChecklist,
            };

            const scoreChecklistMap: Record<'history' | 'physical_exam' | 'education' | 'ppi', ScoreChecklist[]> = {
                history: HistoryScoreChecklist,
                physical_exam: PhysicalExamScoreChecklist,
                education: EducationScoreChecklist,
                ppi: PpiScoreChecklist,
            };

            const sectionIds = Object.keys(checklistMap) as (keyof typeof checklistMap)[];

            const promises: Promise<SectionResult>[] = sectionIds.map(async (sectionId) => {
                const checklist = checklistMap[sectionId];
                const res = await fetch('/api/collectEvidence', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        transcript, // 이미 존재하는 텍스트 URL or 내용
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

            // 2️⃣ 채점 계산
            const graded: Record<'history' | 'physical_exam' | 'education' | 'ppi', GradeItem[]> = {
                history: [],
                physical_exam: [],
                education: [],
                ppi: [],
            };

            for (const { sectionId, evidenceList } of results) {
                const checklist = checklistMap[sectionId as SectionId];
                const scoreList = scoreChecklistMap[sectionId as SectionId];
                const maxMap = Object.fromEntries(scoreList.map((s) => [s.id, s.max_evidence_count]));

                graded[sectionId as SectionId] = checklist.map((item: EvidenceChecklist) => {
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
            setStatusMessage(null);
        } catch (e: any) {
            console.error(e);
            setStatusMessage(`오류 발생: ${e.message || e}`);
        }
    }
}