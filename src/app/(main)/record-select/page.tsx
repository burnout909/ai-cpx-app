'use client';
import { useState, useTransition, useEffect } from "react";
import SmallHeader from "@/component/SmallHeader";
import { useRouter } from "next/navigation";
import { UPLOAD_RECORD_CASE_CATEGORIES } from "@/constants/caseData";
import BottomFixButton from "@/component/BottomFixButton";
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
    const [loadingChecklists, setLoadingChecklists] = useState(true);

    // 선택 상태
    const [selected, setSelected] = useState<SelectedState>({
        category: UPLOAD_RECORD_CASE_CATEGORIES[0].name,
        chiefComplaint: "",
        checklistId: null,
    });

    // DB에서 체크리스트 목록 가져오기
    useEffect(() => {
        async function fetchChecklists() {
            try {
                const res = await fetch("/api/admin/checklist");
                const data = await res.json();

                if (res.ok && data.checklists) {
                    // chiefComplaint별로 매핑
                    const mapped: Record<string, ChecklistInfo> = {};
                    for (const checklist of data.checklists) {
                        mapped[checklist.chiefComplaint] = {
                            chiefComplaint: checklist.chiefComplaint,
                            latestVersion: checklist.latestVersion,
                            id: checklist.id,
                        };
                    }
                    setChecklistMap(mapped);
                }
            } catch (err) {
                console.error("체크리스트 목록 로드 실패:", err);
            } finally {
                setLoadingChecklists(false);
            }
        }
        fetchChecklists();
    }, []);

    // 현재 선택된 대분류
    const currentCategory =
        UPLOAD_RECORD_CASE_CATEGORIES.find((cat) => cat.name === selected.category) ??
        UPLOAD_RECORD_CASE_CATEGORIES[0];

    // 주호소가 체크리스트를 가지고 있는지 확인
    const hasChecklist = (chiefComplaint: string) => {
        return !!checklistMap[chiefComplaint];
    };

    // 버튼 클릭 시 이동 로직
    const handleStartPractice = () => {
        if (!selected.chiefComplaint || !selected.checklistId) return;

        startTransition(() => {
            router.push(
                `/record-select/cpx?category=${encodeURIComponent(
                    selected.chiefComplaint
                )}&case=${encodeURIComponent(selected.chiefComplaint)}&checklistId=${encodeURIComponent(selected.checklistId!)}`
            );
        });
    };

    return (
        <div className="flex flex-col relative min-h-dvh">
            <Header />
            <SmallHeader title="Case 선택" onClick={() => router.push('/home')} />

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
                                    : "text-[#9A8FCB] hover:bg-[#F0EEFC] hover:text-[#210535]"
                                }`}
                        >
                            {category.name}
                        </button>
                    ))}
                </div>

                {/* 2열: 주호소 */}
                <div className="flex flex-col gap-2 w-1/2 border-l border-[#E0DEF0] pl-3">
                    <div className="text-xs font-semibold text-[#9A8FCB] mb-1 px-2">주호소</div>
                    {loadingChecklists ? (
                        <div className="flex items-center justify-center py-8">
                            <div className="w-5 h-5 border-2 border-[#D0C7FA] border-t-[#7553FC] rounded-full animate-spin" />
                        </div>
                    ) : (
                        currentCategory.details.map((item) => {
                            const hasCheck = hasChecklist(item.name);
                            const checklistInfo = checklistMap[item.name];
                            return (
                                <button
                                    key={item.id}
                                    onClick={() => {
                                        if (!hasCheck) return;
                                        setSelected({
                                            ...selected,
                                            chiefComplaint: item.name,
                                            checklistId: checklistInfo?.id || null,
                                        });
                                    }}
                                    disabled={!hasCheck}
                                    className={`text-left font-medium px-3 py-2 text-[14px] rounded-[8px] transition-all
                                        ${!hasCheck
                                            ? "text-[#C9C4DC] cursor-not-allowed"
                                            : selected.chiefComplaint === item.name
                                                ? "bg-[#7553FC] text-white"
                                                : "text-[#9A8FCB] hover:bg-[#F0EEFC] hover:text-[#210535]"
                                        }`}
                                >
                                    <span className="flex items-center justify-between">
                                        {item.name}
                                        {hasCheck && checklistInfo && (
                                            <span className="text-xs text-[#7553FC] bg-[#F0EEFC] px-1.5 py-0.5 rounded">
                                                v{checklistInfo.latestVersion}
                                            </span>
                                        )}
                                    </span>
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
