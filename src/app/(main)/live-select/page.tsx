'use client';
import { useState, useTransition, useEffect } from "react";
import SmallHeader from "@/component/SmallHeader";
import { useRouter } from "next/navigation";
import { LIVE_CASE_CATEGORIES } from "@/constants/caseData";
import BottomFixButton from "@/component/BottomFixButton";
import Header from "@/component/Header";

interface ScenarioCase {
    id: string;
    caseName: string;
    chiefComplaint: string;
    versionNumber: number;
}

interface ChecklistInfo {
    chiefComplaint: string;
    latestVersion: string;
    id: string;
}

type SelectedState = {
    category: string;
    chiefComplaint: string;
    caseId: string | null;
    caseName: string | null;
};

export default function SelectPage() {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();

    // 시나리오 데이터 (DB에서 가져옴)
    const [scenariosByChiefComplaint, setScenariosByChiefComplaint] = useState<Record<string, ScenarioCase[]>>({});
    // 체크리스트 데이터 (DB에서 가져옴)
    const [checklistMap, setChecklistMap] = useState<Record<string, ChecklistInfo>>({});
    const [loading, setLoading] = useState(true);

    // 선택 상태
    const [selected, setSelected] = useState<SelectedState>({
        category: LIVE_CASE_CATEGORIES[0].name,
        chiefComplaint: "",
        caseId: null,
        caseName: null,
    });

    // DB에서 시나리오와 체크리스트 목록 가져오기
    useEffect(() => {
        async function fetchData() {
            try {
                // 병렬로 시나리오와 체크리스트 조회
                const [scenarioRes, checklistRes] = await Promise.all([
                    fetch("/api/admin/scenario?status=PUBLISHED"),
                    fetch("/api/admin/checklist"),
                ]);

                const [scenarioData, checklistData] = await Promise.all([
                    scenarioRes.json(),
                    checklistRes.json(),
                ]);

                // 시나리오 그룹화
                if (scenarioRes.ok && scenarioData.scenarios) {
                    const grouped: Record<string, ScenarioCase[]> = {};
                    for (const scenario of scenarioData.scenarios) {
                        const cc = scenario.chiefComplaint;
                        if (!grouped[cc]) {
                            grouped[cc] = [];
                        }
                        grouped[cc].push({
                            id: scenario.id,
                            caseName: scenario.caseName,
                            chiefComplaint: cc,
                            versionNumber: scenario.versionNumber,
                        });
                    }
                    setScenariosByChiefComplaint(grouped);
                }

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
        LIVE_CASE_CATEGORIES.find((cat) => cat.name === selected.category) ??
        LIVE_CASE_CATEGORIES[0];

    // 현재 선택된 주호소의 케이스 목록
    const currentCases = selected.chiefComplaint
        ? scenariosByChiefComplaint[selected.chiefComplaint] || []
        : [];

    // 주호소가 케이스와 체크리스트 둘 다 있는지 확인
    const isAvailable = (chiefComplaint: string) => {
        const hasCases = scenariosByChiefComplaint[chiefComplaint]?.length > 0;
        const hasChecklist = !!checklistMap[chiefComplaint];
        return hasCases && hasChecklist;
    };

    // 케이스 수 반환
    const getCaseCount = (chiefComplaint: string) => {
        return scenariosByChiefComplaint[chiefComplaint]?.length || 0;
    };

    // 버튼 클릭 시 이동 로직
    const handleStartPractice = () => {
        if (!selected.caseId || !selected.caseName) return;

        startTransition(() => {
            router.push(
                `/live-select/cpx?category=${encodeURIComponent(
                    selected.chiefComplaint
                )}&case=${encodeURIComponent(selected.caseName!)}&scenarioId=${encodeURIComponent(selected.caseId!)}`
            );
        });
    };

    return (
        <div className="flex flex-col relative min-h-dvh">
            <Header />
            <SmallHeader title="Case 선택" onClick={() => router.push('/home')} />

            <div className="flex flex-row flex-1 px-5 pt-[10px] gap-2 overflow-y-auto pb-[136px]">
                {/* 1열: 대분류 */}
                <div className="flex flex-col gap-2 w-1/3">
                    <div className="text-xs font-semibold text-[#9A8FCB] mb-1 px-2">분류</div>
                    {LIVE_CASE_CATEGORIES.map((category) => (
                        <button
                            key={category.id}
                            onClick={() =>
                                setSelected({
                                    category: category.name,
                                    chiefComplaint: "",
                                    caseId: null,
                                    caseName: null,
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
                <div className="flex flex-col gap-2 w-1/3 border-l border-[#E0DEF0] pl-3">
                    <div className="text-xs font-semibold text-[#9A8FCB] mb-1 px-2">주호소</div>
                    {currentCategory.details.map((item) => {
                        const available = isAvailable(item.name);
                        const caseCount = getCaseCount(item.name);
                        return (
                            <button
                                key={item.id}
                                onClick={() => {
                                    if (!available) return;
                                    setSelected((prev) => ({
                                        ...prev,
                                        chiefComplaint: item.name,
                                        caseId: null,
                                        caseName: null,
                                    }));
                                }}
                                disabled={!available}
                                className={`text-left font-medium px-3 py-2 text-[14px] rounded-[8px] transition-all
                                    ${!available
                                        ? "text-[#C9C4DC] cursor-not-allowed"
                                        : selected.chiefComplaint === item.name
                                            ? "bg-[#DAD7E8] text-[#210535]"
                                            : "text-[#9A8FCB] hover:bg-[#F0EEFC] hover:text-[#210535]"
                                    }`}
                            >
                                <span className="flex items-center justify-between">
                                    {item.name}
                                    {available && (
                                        <span className="text-xs text-[#7553FC] bg-[#F0EEFC] px-1.5 py-0.5 rounded">
                                            {caseCount}
                                        </span>
                                    )}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {/* 3열: 케이스 */}
                <div className="flex flex-col gap-2 w-1/3 border-l border-[#E0DEF0] pl-3">
                    <div className="text-xs font-semibold text-[#9A8FCB] mb-1 px-2">케이스</div>
                    {loading ? (
                        <div className="flex items-center justify-center py-8">
                            <div className="w-5 h-5 border-2 border-[#D0C7FA] border-t-[#7553FC] rounded-full animate-spin" />
                        </div>
                    ) : !selected.chiefComplaint ? (
                        <div className="text-[13px] text-[#B8B2D1] px-3 py-4">
                            주호소를 선택하세요
                        </div>
                    ) : currentCases.length === 0 ? (
                        <div className="text-[13px] text-[#B8B2D1] px-3 py-4">
                            등록된 케이스가 없습니다
                        </div>
                    ) : (
                        currentCases.map((scenario) => (
                            <button
                                key={scenario.id}
                                onClick={() =>
                                    setSelected((prev) => ({
                                        ...prev,
                                        caseId: scenario.id,
                                        caseName: scenario.caseName,
                                    }))
                                }
                                className={`text-left font-medium px-3 py-2 text-[14px] rounded-[8px] transition-all
                                    ${selected.caseId === scenario.id
                                        ? "bg-[#7553FC] text-white"
                                        : "text-[#6B5FA8] hover:bg-[#F0EEFC] hover:text-[#210535]"
                                    }`}
                            >
                                {scenario.caseName}
                            </button>
                        ))
                    )}
                </div>
            </div>

            {/* 고정 버튼 */}
            <BottomFixButton
                disabled={!selected.caseId || isPending}
                loading={isPending}
                onClick={handleStartPractice}
                buttonName={"실습 시작하기"}
            />
        </div>
    );
}
