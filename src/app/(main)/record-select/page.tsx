'use client';
import { useState, useTransition, useEffect } from "react";
import SmallHeader from "@/component/SmallHeader";
import { useRouter } from "next/navigation";
import { UPLOAD_RECORD_CASE_CATEGORIES } from "@/constants/caseData";
import BottomFixButton from "@/component/BottomFixButton";
import { track } from "@/lib/mixpanel";
import Header from "@/component/Header";

interface ChecklistInfo {
    chiefComplaint: string;
    latestVersion: string;
    id: string;
}

type SelectedState = {
    category: string;
    chiefComplaint: string;
    checklistId: string | null;
};

export default function SelectPage() {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    // 체크리스트 데이터 (DB에서 가져옴)
    const [checklistMap, setChecklistMap] = useState<Record<string, ChecklistInfo>>({});
    const [loading, setLoading] = useState(true);

    // 선택 상태
    const [selected, setSelected] = useState<SelectedState>({
        category: "",
        chiefComplaint: "",
        checklistId: null,
    });

    // DB에서 체크리스트 목록 가져오기
    useEffect(() => {
        async function fetchData() {
            try {
                const checklistRes = await fetch("/api/checklist");
                const checklistData = await checklistRes.json();

                // 체크리스트 매핑
                if (checklistRes.ok && checklistData.checklists) {
                    const mapped: Record<string, ChecklistInfo> = {};
                    for (const checklist of checklistData.checklists) {
                        mapped[checklist.chiefComplaint] = {
                            chiefComplaint: checklist.chiefComplaint,
                            latestVersion: checklist.latestVersion,
                            id: checklist.id,
                        };
                    }
                    setChecklistMap(mapped);
                }
            } catch (err) {
                console.error("데이터 로드 실패:", err);
            } finally {
                setLoading(false);
            }
        }
        fetchData();
    }, []);

    // 현재 선택된 대분류
    const currentCategory =
        UPLOAD_RECORD_CASE_CATEGORIES.find((cat) => cat.name === selected.category);

    // 주호소에 체크리스트가 있는지 확인
    const isAvailable = (chiefComplaint: string) => {
        return !!checklistMap[chiefComplaint];
    };

    // 버튼 클릭 시 이동 로직
    const handleStartPractice = () => {
        if (!selected.chiefComplaint || !selected.checklistId) return;
        track("record_practice_started", { category: selected.category, case_name: selected.chiefComplaint });

        startTransition(() => {
            router.push(
                `/record-select/cpx?category=${encodeURIComponent(
                    selected.category
                )}&case=${encodeURIComponent(selected.chiefComplaint)}&checklistId=${encodeURIComponent(selected.checklistId!)}`
            );
        });
    };

    return (
        <div className="flex flex-col relative min-h-dvh">
            <Header />
            <SmallHeader title="주호소 선택" onClick={() => router.push('/home')} />

            <div className="flex flex-row flex-1 px-5 pt-[10px] gap-2 overflow-y-auto pb-[136px]">
                {/* 1열: 대분류 */}
                <div className="flex flex-col gap-2 w-1/2">
                    <div className="text-xs font-semibold text-[#9A8FCB] mb-1 px-2">분류</div>
                    {UPLOAD_RECORD_CASE_CATEGORIES.map((category) => (
                        <button
                            key={category.id}
                            onClick={() =>
                                setSelected({
                                    category: category.name,
                                    chiefComplaint: "",
                                    checklistId: null,
                                })
                            }
                            className={`px-3 py-2 rounded-[8px] font-medium text-[15px] text-left transition-all
                                ${selected.category === category.name
                                    ? "bg-[#D0C7FA] text-[#210535]"
                                    : "text-[#5B4A99] hover:bg-[#F0EEFC] hover:text-[#210535]"
                                }`}
                        >
                            {category.name}
                        </button>
                    ))}
                </div>

                {/* 2열: 주호소 */}
                <div className="flex flex-col gap-2 w-1/2 border-l border-[#E0DEF0] pl-3">
                    <div className="text-xs font-semibold text-[#9A8FCB] mb-1 px-2">주호소</div>
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <div className="w-5 h-5 border-2 border-[#D0C7FA] border-t-[#7553FC] rounded-full animate-spin" />
                        </div>
                    ) : !currentCategory ? (
                        <div className="text-[13px] text-[#B8B2D1] px-3 py-4">
                            분류를 선택하세요
                        </div>
                    ) : (
                        currentCategory.details.map((item) => {
                            const available = isAvailable(item.name);
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => {
                                        if (!available) return;
                                        setSelected((prev) => ({
                                            ...prev,
                                            chiefComplaint: item.name,
                                            checklistId: checklistMap[item.name]?.id || null,
                                        }));
                                    }}
                                    disabled={!available}
                                    className={`text-left font-medium px-3 py-2 text-[14px] rounded-[8px] transition-all
                                        ${!available
                                            ? "text-[#C9C4DC] cursor-not-allowed"
                                            : selected.chiefComplaint === item.name
                                                ? "bg-[#7553FC] text-white"
                                                : "text-[#5B4A99] hover:bg-[#F0EEFC] hover:text-[#210535]"
                                        }`}
                                >
                                    {item.name}
                                </button>
                            );
                        })
                    )}
                </div>
            </div>

            {/* 고정 버튼 */}
            <BottomFixButton
                disabled={!selected.checklistId || isPending}
                loading={isPending}
                onClick={handleStartPractice}
                buttonName={"실습 시작하기"}
            />
        </div>
    );
}
