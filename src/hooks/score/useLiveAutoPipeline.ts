import { SectionId } from "@/app/api/collectEvidence/route";
import { generateDownloadUrl } from "@/app/api/s3/s3";
import { GradeItem, SectionResult } from "@/types/score";
import { EvidenceChecklist, loadChecklistByCase, ScoreChecklist, EvidenceModule } from "@/utils/loadChecklist";
import { ensureOkOrThrow, readJsonOrText } from "@/utils/score";

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

export function useLiveAutoPipeline(
    setStatusMessage: (msg: string | null) => void,
    setGradesBySection: (data: any) => void,
    setResults: (data: SectionResult[]) => void,
    setActiveSection: (section: SectionKey | null) => void,
    setDone: (done: boolean) => void,
) {
    return async function runLiveAutoPipeline(key: string, caseName: string, checklistId?: string | null) {
        const bucket = process.env.NEXT_PUBLIC_S3_BUCKET_NAME;
        try {
            // 1️⃣ 체크리스트 불러오기
            setStatusMessage('체크리스트 로드 중...');

            let evidence: EvidenceModule;
            if (checklistId) {
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


            // 3️⃣ 채점 먼저 수행
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

            const results = await Promise.all(resultsPromises);
            setResults(results);

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

            // 5️⃣ 완료
            setStatusMessage(null);
            setDone(true);
        } catch (e: any) {
            console.error(e);
            setStatusMessage(`오류 발생: ${e.message || e}`);
        }
    }
}
