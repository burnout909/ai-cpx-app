'use client';
import { useState } from "react";
import SmallHeader from "@/component/SmallHeader";
import { useRouter } from "next/navigation";
import { UPLOAD_RECORD_CASE_CATEGORIES } from "@/constants/caseData";
import BottomFixButton from "@/component/BottomFixButton";

type SelectedCaseState = {
    category: string;
    case: string;
};

export default function SelectPage() {
    const router = useRouter();

    // 하나의 객체로 상태 관리
    const [selected, setSelected] = useState<SelectedCaseState>({
        category: UPLOAD_RECORD_CASE_CATEGORIES[0].name,
        case: UPLOAD_RECORD_CASE_CATEGORIES[0].details[0].name,
    });

    // 현재 선택된 대분류 찾기
    const currentCategory = UPLOAD_RECORD_CASE_CATEGORIES.find(
        (cat) => cat.name === selected.category
    ) ?? UPLOAD_RECORD_CASE_CATEGORIES[0];

    return (
        <div className="flex flex-col relative">
            <SmallHeader title="Case 선택" onClick={() => router.push('/home')} />

            <div className="flex flex-row flex-1 px-6 py-4 gap-4 overflow-y-auto pb-[136px]">
                {/* 왼쪽: 대분류 */}
                <div className="flex flex-col gap-4 w-1/2">
                    {UPLOAD_RECORD_CASE_CATEGORIES.map((category) => (
                        <button
                            key={category.id}
                            onClick={() => setSelected({ category: category.name, case: category.details[0].name })}
                            className={`px-3 py-4 rounded-[8px] font-medium text-[22px] text-left transition-all
                ${selected.category === category.name
                                    ? "bg-[#D0C7FA] text-[#210535]"
                                    : "text-[#9A8FCB] hover:bg-[#F0EEFC] hover:text-[#210535]"}`}
                        >
                            {category.name} ({category.count})
                        </button>
                    ))}
                </div>

                {/* 오른쪽: 세부 케이스 */}
                <div className="flex flex-col gap-4 w-1/2 overflow-y-auto border-l border-[#E0DEF0] pl-8  rounded-[8px]">
                    {currentCategory.details.map((item) => (
                        <button
                            key={item.id}
                            onClick={() =>
                                setSelected((prev) => ({ ...prev, case: item.name }))
                            }
                            className={`text-left font-medium px-3 py-[17px] text-[20px] rounded-[8px] transition-all
                ${selected.case === item.name
                                    ? "bg-[#DAD7E8] text-[#210535]"
                                    : "text-[#9A8FCB] hover:bg-[#F0EEFC] hover:text-[#210535]"
                                }`}
                        >
                            {item.name}
                        </button>
                    ))}
                </div>
            </div>

            {/* 고정 버튼 */}
            <BottomFixButton
                buttonName="실습 시작하기"
                disabled={!selected.case}
                onClick={() => {
                    if (selected.case) {
                        router.push(
                            `/record-select/cpx?category=${encodeURIComponent(
                                selected.category
                            )}&case=${encodeURIComponent(selected.case)}`
                        );
                    }
                }}
            />
        </div>
    );
}
