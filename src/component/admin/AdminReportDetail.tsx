"use client";

import { useCallback, useState } from "react";
import { GradeItem } from "@/types/score";
import YesIcon from "@/assets/icon/YesIcon.svg";
import NoIcon from "@/assets/icon/NoIcon.svg";

export default function AdminReportDetailTable({ grades }: { grades: GradeItem[] }) {
    const borderColor = '#DDD6FE';
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

    const toggleExpand = useCallback((id: string) => {
        setExpandedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

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
                    {grades.map((g) => {
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
                    })}
                </tbody>
            </table>
        </div>
    );
}
