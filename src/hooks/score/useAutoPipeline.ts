import { SectionId } from "@/app/api/collectEvidence/route";
import { GradeItem, SectionResult } from "@/types/score";
import { EvidenceChecklist, loadChecklistByCase } from "@/utils/loadChecklist";
import { ensureOkOrThrow, readJsonOrText } from "@/utils/score";
import { generateUploadUrl } from "@/app/api/s3/s3";

export function useAutoPipeline(
    setStatusMessage: (msg: string | null) => void,
    setGradesBySection: (data: any) => void,
    setResults: (data: SectionResult[]) => void,
    setActiveSection: (section: string) => void,
    setNarrativeFeedback: (data: any) => void,
    setFeedbackDone: (done: boolean) => void,
) {
    return async function runAutoPipeline(key: string, caseName: string) {
        try {
            // 체크리스트 로드
            setStatusMessage('채점 기준 로드 중');
            const { evidence, score } = await loadChecklistByCase(caseName!);

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
            // 전사
            setStatusMessage('오디오 전사 중');
            const res1 = await fetch('/api/transcribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ s3_key: key }),
            });
            const data1 = await readJsonOrText(res1);
            await ensureOkOrThrow(res1, data1);
            const text = data1?.text || '';

            // 전사 결과를 S3에 저장 (SP_script/ 경로로 교체, 나머지는 동일하게 유지)
            try {
                const bucket = process.env.NEXT_PUBLIC_S3_BUCKET_NAME;
                if (!bucket) {
                    console.warn('[script upload skipped] bucket not set');
                } else {
                    const scriptKey = key.startsWith('SP_audio/')
                        ? key.replace(/^SP_audio\//, 'SP_script/').replace(/\.mp3$/i, '.txt')
                        : key;
                    const uploadUrl = await generateUploadUrl(bucket, scriptKey);
                    const body = new Blob([text], { type: 'text/plain; charset=utf-8' });

                    await fetch(uploadUrl, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
                        body,
                    });
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
            setActiveSection('history');

            // 채점 결과 기반으로 피드백 생성
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
            // 완료
            setStatusMessage(null);
            setNarrativeFeedback(feedbackData);
            setFeedbackDone(true);



        } catch (e: any) {
            console.error(e);
            setStatusMessage(`오류 발생: ${e.message || e}`);
        }
    };
}
