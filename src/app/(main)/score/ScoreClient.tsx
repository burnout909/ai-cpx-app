'use client';

import {
    HistoryEvidenceChecklist,
    PhysicalexamEvidenceChecklist,
    EducationEvidenceChecklist,
    PpiEvidenceChecklist,
} from '@/app/assets/evidenceChecklist';
import BottomFixButton from '@/component/BottomFixButton';
import { useEffect, useState } from 'react';

/* =========================
   Types
========================= */
interface Props {
    s3Key: string;
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
export default function ScoreClient({ s3Key }: Props) {
    const [statusMessage, setStatusMessage] = useState<string | null>('준비 중');
    const [results, setResults] = useState<SectionResult[]>([]);

    // 리포트 데이터
    const [gradesBySection, setGradesBySection] = useState<
        Record<string, GradeItem[]>
    >({});
    const [activeSection, setActiveSection] = useState<string>('history');

    useEffect(() => {
        console.log("s3Key:", s3Key)
        if (!s3Key) return;
        runAutoPipeline(s3Key);
    }, [s3Key]);

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

    async function runAutoPipeline(key: string) {
        try {
            // 1️⃣ 전사
            setStatusMessage('오디오 전사 중');
            const res1 = await fetch('/api/transcribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ s3_key: key }),
            });
            const data1 = await readJsonOrText(res1);
            await ensureOkOrThrow(res1, data1);
            const text = data1?.text || '';

            // 2️⃣ 클린업
            setStatusMessage('전사문 클린업 중');
            const res2 = await fetch('/api/cleanup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ transcript: text }),
            });
            const data2 = await readJsonOrText(res2);
            await ensureOkOrThrow(res2, data2);
            const cleaned = data2?.text || text;

            // 3️⃣ 병렬 증거 수집
            setStatusMessage('모든 섹션 증거 수집 중');
            const checklistMap = {
                history: HistoryEvidenceChecklist,
                physical_exam: PhysicalexamEvidenceChecklist,
                education: EducationEvidenceChecklist,
                ppi: PpiEvidenceChecklist,
            };
            const sectionIds = Object.keys(checklistMap) as (keyof typeof checklistMap)[];

            const promises = sectionIds.map(async (sectionId) => {
                const checklist = checklistMap[sectionId];
                const res = await fetch('/api/collectEvidence', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        transcript: cleaned,
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

            // 4️⃣ 채점 계산
            const graded: Record<string, GradeItem[]> = {};
            for (const { sectionId, evidenceList } of results) {
                const checklist =
                    checklistMap[sectionId as keyof typeof checklistMap] || [];
                graded[sectionId] = checklist.map((item) => {
                    const ev = evidenceList.find((e) => e.id === item.id);
                    const evidence = ev?.evidence ?? [];
                    const point = Math.min(evidence.length, 2); // 단순 evidence 개수 기반 점수
                    return {
                        id: item.id,
                        title: item.title,
                        criteria: item.criteria,
                        evidence,
                        point,
                        max_evidence_count: 2,
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
        <div className="flex flex-col items-center justify-center bg-gradient-to-b from-zinc-50 to-white dark:from-black dark:to-zinc-950 px-4 h-full pb-[136px]">
            {/* 진행 상태 */}
            {statusMessage &&
                <div className="fixed top-3/7 left-1/2 -translate-x-1/2 -translate-y-3/7 text-center text-[24px] font-semibold text-[#7553FC] animate-pulse">
                    {statusMessage}
                </div>
            }
            <div className="max-w-4xl w-full py-[20px]" id='report-root'>
                <h1 className="text-2xl font-semibold mb-6 text-left">
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
    return (
        <>
            <div className="mb-4 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 bg-white/70 dark:bg-zinc-900/70 flex justify-between">
                <div className="text-base font-medium">총점</div>
                <div className="text-base font-semibold">
                    {overall.got} / {overall.max}
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                {Object.entries(totals).map(([key, val]) => (
                    <button
                        key={key}
                        onClick={() => setActive(key)}
                        className={`text-left rounded-xl border p-4 transition ${active === key
                            ? 'border-zinc-900 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                            : 'border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/60 hover:bg-zinc-100/60 dark:hover:bg-zinc-800/60'
                            }`}
                    >
                        <div className="flex justify-between items-center">
                            <div>{PART_LABEL[key] || key}</div>
                            <span className="rounded-full px-2 py-1 text-xs bg-zinc-900 text-white dark:bg-white dark:text-zinc-900">
                                {val.got} / {val.max}
                            </span>
                        </div>
                    </button>
                ))}
            </div>
        </>
    );
}

// 섹션 상세 테이블
function ReportDetailTable({ grades }: { grades: GradeItem[] }) {
    return (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
            <table className="min-w-full text-sm">
                <thead className="bg-zinc-100 dark:bg-zinc-800/60">
                    <tr>
                        <th className="px-4 py-3 text-left font-medium">ID</th>
                        <th className="px-4 py-3 text-left font-medium">체크리스트</th>
                        <th className="px-4 py-3 text-left font-medium whitespace-nowrap">점수</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {grades.map((g) => (
                        <tr key={g.id} className="align-top">
                            <td className="px-4 py-3 font-mono text-xs">{g.id}</td>
                            <td className="px-4 py-3">
                                <div className="font-medium">{g.title}</div>
                                {g.evidence?.length > 0 && (
                                    <ul className="mt-1 list-disc pl-4 space-y-0.5 text-xs text-zinc-600 dark:text-zinc-400">
                                        {g.evidence.map((evi, i) => (
                                            <li key={i} className="whitespace-pre-wrap">{evi}</li>
                                        ))}
                                    </ul>
                                )}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                                <span className="inline-flex items-center rounded-md bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 px-2 py-1 text-xs">
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
