'use client';

import { SectionId } from '@/app/api/collectEvidence/route';
import { generateDownloadUrl } from '@/app/api/s3/s3';
import BottomFixButton from '@/component/BottomFixButton';
import { EvidenceChecklist, loadChecklistByCase, ScoreChecklist } from '@/utils/loadChecklist';
import { useEffect, useState } from 'react';

/* =========================
   Types
========================= */
interface Props {
    s3Key: string;
    transcriptS3Key: string | null
    caseName: string | null
}

interface EvidenceListItem {
    id: string;
    evidence: string[];
}

interface SectionResult {
    sectionId: string;
    evidenceList: EvidenceListItem[];
}

interface GradeItem {
    id: string;
    title: string;
    criteria: string;
    evidence: string[];
    point: number;
    max_evidence_count: number;
}

/* =========================
   Main Component
========================= */
export default function ScoreClient({ s3Key, transcriptS3Key, caseName }: Props) {
    const [statusMessage, setStatusMessage] = useState<string | null>('준비 중');
    const [results, setResults] = useState<SectionResult[]>([]);

    // 리포트 데이터
    const [gradesBySection, setGradesBySection] = useState<
        Record<string, GradeItem[]>
    >({});
    const [activeSection, setActiveSection] = useState<string>('history');

    useEffect(() => {
        if (!caseName) return;

        // transcript가 있으면 실시간 모드
        if (transcriptS3Key) {
            console.log('🔹 runLiveAutoPipeline 시작');
            runLiveAutoPipeline(transcriptS3Key, caseName);
        }
        // 아니면 기본 모드
        else if (s3Key) {
            console.log('🔹 runAutoPipeline 시작');
            runAutoPipeline(s3Key, caseName);
        }
    }, [s3Key, transcriptS3Key, caseName]);

    async function readJsonOrText(res: Response): Promise<any> {
        const ct = res.headers.get('content-type') || '';
        if (ct.includes('application/json')) return await res.json().catch(() => ({}));
        return await res.text().catch(() => '');
    }

    async function ensureOkOrThrow(res: Response, data: any) {
        if (!res.ok) {
            const msg = typeof data === 'string' ? data : data?.message || res.statusText;
            throw new Error(msg);
        }
    }

    async function runAutoPipeline(key: string, caseName: string) {
        try {
            // 1️⃣ 체크리스트 불러오기
            setStatusMessage('채점 기준 로드 중');
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

            // // 3️⃣ 클린업
            // setStatusMessage('전사문 클린업 중');
            // const res2 = await fetch('/api/cleanup', {
            //     method: 'POST',
            //     headers: { 'Content-Type': 'application/json' },
            //     body: JSON.stringify({ transcript: text }),
            // });
            // const data2 = await readJsonOrText(res2);
            // await ensureOkOrThrow(res2, data2);
            // const cleaned = data2?.text || text;

            // 4️⃣ 병렬 증거 수집
            setStatusMessage('채점 중');

            const checklistMap: Record<'history' | 'physical_exam' | 'education' | 'ppi', EvidenceChecklist[]> = {
                history: HistoryEvidenceChecklist,
                physical_exam: PhysicalexamEvidenceChecklist,
                education: EducationEvidenceChecklist,
                ppi: PpiEvidenceChecklist,
            };

            const scoreListBySection: Record<'history' | 'physical_exam' | 'education' | 'ppi', ScoreChecklist[]> = {
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

            // 5️⃣ 채점 계산
            const graded: Record<'history' | 'physical_exam' | 'education' | 'ppi', GradeItem[]> = {
                history: [],
                physical_exam: [],
                education: [],
                ppi: [],
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
            setStatusMessage(null);
        } catch (e: any) {
            console.error(e);
            setStatusMessage(`오류 발생: ${e.message || e}`);
        }
    }
    async function runLiveAutoPipeline(key: string, caseName: string) {
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
    // 점수 요약 계산
    function sumPoints(list: GradeItem[]) {
        return list.reduce(
            (acc, g) => ({
                got: acc.got + g.point,
                max: acc.max + g.max_evidence_count,
            }),
            { got: 0, max: 0 }
        );
    }

    function getAllTotals() {
        const totals = Object.fromEntries(
            Object.entries(gradesBySection).map(([k, v]) => [k, sumPoints(v)])
        );
        const overall = Object.values(totals).reduce(
            (acc, cur) => ({ got: acc.got + cur.got, max: acc.max + cur.max }),
            { got: 0, max: 0 }
        );
        return { totals, overall };
    }

    const { totals, overall } = getAllTotals();

    const PART_LABEL: Record<string, string> = {
        history: 'History',
        physical_exam: 'Physical Exam',
        education: 'Education',
        ppi: 'PPI',
    };

    /**각 section이미지 저장 */
    async function handleSave() {
        alert("준비중인 기능입니다")
        // try {
        //     const sectionIds = ["history", "physical_exam", "education", "ppi"];
        //     for (const sectionId of sectionIds) {
        //         setActiveSection(sectionId);
        //         await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

        //         const target = document.querySelector("#report-root") as HTMLElement;
        //         if (!target) continue;

        //         // ✅ dom-to-image-more 사용
        //         const blob = await domtoimage.toBlob(target, {
        //             bgcolor: "#ffffff",
        //             style: { transform: "scale(2)", transformOrigin: "top left" },
        //         });

        //         // 다운로드
        //         const url = URL.createObjectURL(blob);
        //         const link = document.createElement("a");
        //         link.href = url;
        //         link.download = `report_${sectionId}.png`;
        //         document.body.appendChild(link);
        //         link.click();
        //         document.body.removeChild(link);
        //         URL.revokeObjectURL(url);
        //     }
        // } catch (e: any) {
        //     alert(`이미지 저장 실패: ${e.message || e}`);
        // }
    }


    return (
        <div className="flex flex-col items-center justify-center px-4 pb-[136px]">
            {/* 진행 상태 */}
            {statusMessage &&
                <div className="fixed top-3/7 left-1/2 -translate-x-1/2 -translate-y-3/7 text-center text-[20px] font-semibold text-[#7553FC] animate-pulse">
                    {statusMessage}
                </div>
            }
            <div className="w-full py-[10px]" id='report-root'>
                <h1 className="text-[24px] font-semibold mb-5 text-left">
                    {!statusMessage && 'Report'}
                </h1>


                {/* Report Summary */}
                {Object.keys(totals).length > 0 && (
                    <ReportSummary
                        totals={totals}
                        overall={overall}
                        active={activeSection}
                        setActive={setActiveSection}
                        PART_LABEL={PART_LABEL}
                    />
                )}

                {/* Report Detail */}
                {gradesBySection[activeSection] && (
                    <ReportDetailTable grades={gradesBySection[activeSection]} />
                )}
                <BottomFixButton
                    disabled={!!statusMessage}
                    onClick={handleSave}
                    buttonName={'Report 저장하기'}
                />
            </div>
        </div>
    );
}
/* =========================
   Report Components
========================= */

// 총점 & 섹션 요약 카드
function ReportSummary({
    totals,
    overall,
    active,
    setActive,
    PART_LABEL,
}: {
    totals: Record<string, { got: number; max: number }>;
    overall: { got: number; max: number };
    active: string;
    setActive: (s: string) => void;
    PART_LABEL: Record<string, string>;
}) {
    const primaryColor = '#7553FC';
    const secondaryColor = '#E9E2FF';

    return (
        <>
            <div
                className="mb-3 rounded-xl p-4 flex justify-between"
                style={{
                    border: `2px solid ${primaryColor}`,
                    backgroundColor: '#FFFFFF',
                }}
            >
                <div className="text-base font-medium text-[#333]">총점</div>
                <div
                    className="text-base font-semibold"
                    style={{ color: primaryColor }}
                >
                    {overall.got} / {overall.max}
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-5">
                {Object.entries(totals).map(([key, val]) => {
                    const isActive = active === key;
                    return (
                        <button
                            key={key}
                            onClick={() => setActive(key)}
                            className="text-left rounded-xl border p-4 transition"
                            style={{
                                border: isActive
                                    ? `2px solid ${primaryColor}`
                                    : '1px solid #E5E5E5',
                                backgroundColor: isActive
                                    ? secondaryColor
                                    : '#FFFFFF',
                                color: isActive ? primaryColor : '#333',
                            }}
                        >
                            <div className="flex justify-between items-center">
                                <div className="font-medium">
                                    {PART_LABEL[key] || key}
                                </div>
                                <span
                                    className="rounded-full px-2 py-1 text-xs font-semibold"
                                    style={{
                                        backgroundColor: isActive
                                            ? primaryColor
                                            : '#F3F3F3',
                                        color: isActive ? '#FFF' : '#555',
                                    }}
                                >
                                    {val.got} / {val.max}
                                </span>
                            </div>
                        </button>
                    );
                })}
            </div>
        </>
    );
}

// 섹션 상세 테이블
function ReportDetailTable({ grades }: { grades: GradeItem[] }) {
    const primaryColor = '#7553FC';
    const borderColor = '#DDD6FE';

    return (
        <div
            className="overflow-x-auto rounded-xl border"
            style={{ borderColor }}
        >
            <table className="min-w-full text-sm bg-[#FAFAFA]">
                <thead>
                    <tr>
                        <th className="px-4 py-3 text-left font-medium text-[#555]">ID</th>
                        <th className="px-4 py-3 text-left font-medium text-[#555]">
                            체크리스트
                        </th>
                        <th className="px-4 py-3 text-left font-medium whitespace-nowrap text-[#555]">
                            점수
                        </th>
                    </tr>
                </thead>
                <tbody style={{ color: '#333' }}>
                    {grades.map((g) => (
                        <tr key={g.id} className="align-top border-t" style={{ borderColor }}>
                            <td className="px-4 py-3 font-mono text-xs">{g.id}</td>
                            <td className="px-4 py-3">
                                <div className="font-medium">{g.title}</div>
                                {g.evidence?.length > 0 && (
                                    <ul className="mt-1 list-disc pl-4 space-y-0.5 text-xs text-[#666]">
                                        {g.evidence.map((evi, i) => (
                                            <li key={i} className="whitespace-pre-wrap">
                                                {evi}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                                <span
                                    className="inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold"
                                    style={{
                                        backgroundColor: primaryColor,
                                        color: '#FFFFFF',
                                    }}
                                >
                                    {g.point} / {g.max_evidence_count}
                                </span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
