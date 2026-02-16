import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { GradeItem } from "@/types/score";
import YesIcon from "@/assets/icon/YesIcon.svg";
import NoIcon from "@/assets/icon/NoIcon.svg";

export default function ReportDetailTable({ grades }: { grades?: GradeItem[] }) {
    const borderColor = '#DDD6FE';
    const items = grades || [];
    const [filter, setFilter] = useState<"all" | "correct" | "incorrect">("all");
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

    const toggleExpand = useCallback((id: string) => {
        setExpandedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    // 섹션이 바뀌면 필터·확장 초기화
    useEffect(() => {
        setFilter("all");
        setExpandedIds(new Set());
    }, [grades]);

    const filteredItems = useMemo(() => {
        switch (filter) {
            case "correct":
                return items.filter((g) => g.point > 0);
            case "incorrect":
                return items.filter((g) => g.point <= 0);
            default:
                return items;
        }
    }, [filter, items]);

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
            <>
                <div className="flex items-center justify-end bg-white border-b" style={{ borderColor }}>
                    <FilterButton
                        active={filter === "all"}
                        label="전체"
                        onClick={() => setFilter("all")}
                    />
                    <FilterButton
                        active={filter === "correct"}
                        label="정답"
                        icon={<YesIcon width={18} height={18} className="text-[#00BF40]" />}
                        onClick={() => setFilter("correct")}
                    />
                    <FilterButton
                        active={filter === "incorrect"}
                        label="오답"
                        icon={<NoIcon width={18} height={18} className="text-[#FF4242]" />}
                        onClick={() => setFilter("incorrect")}
                    />
                </div>
                <table className="min-w-full text-sm bg-[#FAFAFA]">
                    <thead>
                        <tr>
                            <th className="px-4 py-3 text-left font-bold text-[#555]">
                                체크리스트
                            </th>
                            <th className="flex justify-end px-4 py-3 text-left font-bold whitespace-nowrap text-[#555]">
                                여부
                            </th>
                        </tr>
                    </thead>
                    <tbody style={{ color: '#333' }}>
                        {filteredItems.length === 0 ? (
                            <tr>
                                <td className="px-4 py-6 text-sm text-gray-500" colSpan={2}>
                                    선택한 필터에 해당하는 항목이 없습니다.
                                </td>
                            </tr>
                        ) : (
                            filteredItems.map((g) => {
                                const expanded = expandedIds.has(g.id);
                                return (
                                    <tr
                                        key={g.id}
                                        className="align-top border-t cursor-pointer select-none active:bg-gray-100 transition-colors"
                                        style={{ borderColor }}
                                        onClick={() => toggleExpand(g.id)}
                                    >
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-1.5">
                                                <span
                                                    className="text-[10px] text-[#7553FC] transition-transform duration-200"
                                                    style={{ display: 'inline-block', transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
                                                >
                                                    ▶
                                                </span>
                                                <span className="font-medium">{g.title}</span>
                                            </div>
                                            {expanded && g.criteria && (
                                                <div className="mt-2 pl-3 text-sm text-[#7553FC] leading-relaxed">
                                                    {g.criteria}
                                                </div>
                                            )}
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
                                );
                            })
                        )}
                    </tbody>
                </table>
            </>
        </div>
    );
}

function FilterButton({
    active,
    label,
    icon,
    onClick,
}: {
    active: boolean;
    label: string;
    icon?: ReactNode;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`flex flex-1 justify-center items-center gap-1 px-3 py-2 text-[14px] transition-colors ${active ? "bg-[#F2EDFF] text-[#7553FC] font-semibold" : "text-[#555] hover:bg-gray-50 font-medium"
                }`}
        >
            {icon}
            <span>{label}</span>
        </button>
    );
}
