import { GradeItem } from "@/types/score";

export default function ReportDetailTable({ grades }: { grades: GradeItem[] }) {
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
