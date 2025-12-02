import { GradeItem } from "@/types/score";
import YesIcon from "@/assets/icon/YesIcon.svg";
import NoIcon from "@/assets/icon/NoIcon.svg";

export default function ReportDetailTable({ grades }: { grades?: GradeItem[] }) {
    const borderColor = '#DDD6FE';
    const items = grades || [];

    if (!items.length) {
        return (
            <div className="w-full rounded-xl border px-4 py-6 text-center text-sm text-gray-500" style={{ borderColor }}>
                체크리스트 항목을 선택하면 상세가 표시됩니다.
            </div>
        );
    }

    return (
        <div
            className="overflow-x-auto rounded-xl border w-full"
            style={{ borderColor }}
        >
            <table className="min-w-full text-sm bg-[#FAFAFA]">
                <thead>
                    <tr>
                        <th className="px-4 py-3 text-left font-medium text-[#555]">
                            체크리스트
                        </th>
                        <th className="flex justify-end px-4 py-3 text-left font-medium whitespace-nowrap text-[#555]">
                            여부
                        </th>
                    </tr>
                </thead>
                <tbody style={{ color: '#333' }}>
                    {items.map((g) => (
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
                            <td className="px-4 py-3 whitespace-nowrap flex justify-end">
                                {g.point > 0 ? <YesIcon width={24} height={24} className="text-[#00BF40]" /> : <NoIcon width={24} height={24} className="text-[#FF4242]" />}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
