// 총점 & 섹션 요약 카드
export default function ReportSummary({
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
        <div className="bg-[#FCFCFC]">
            <div className="mb-3 rounded-xl p-4 flex justify-between "
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-5 bg-[#FCFCFC]">
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
        </div>
    );
}
