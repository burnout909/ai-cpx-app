'use client';

import BottomFixButton from "@/component/BottomFixButton";
import SmallHeader from "@/component/SmallHeader";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useMemo } from "react";
// 아래 SVG 컴포넌트 import는 Webpack+SVGR 설정 또는 public 경로 사용 전제
import PlayIcon from "@/asset/icon/PlayIcon.svg";
import PauseIcon from "@/asset/icon/PauseIcon.svg";

const INITIAL_SECONDS = 12 * 60; // 720s = 12분

/* =======================
   Mock Data & Types
======================= */
type Vitals = {
    bp: { systolic: number; diastolic: number }; // 혈압
    pulse: number; // 맥박
    rr: number;    // 호흡수
    temp: number;  // 체온(섭씨)
};

type CaseInfo = {
    description: string;
    vitals: Vitals;
};

// 카테고리 → 케이스명 → 데이터
const CASE_MOCK: Record<string, Record<string, CaseInfo>> = {
    소화기: {
        급성복통: {
            description: "56세 남성 홍길동씨가 숨 쉬기가 힘들어 내원하였다.",
            vitals: { bp: { systolic: 140, diastolic: 78 }, pulse: 96, rr: 22, temp: 37.2 },
        },
        소화불량: {
            description: "식후 상복부 불편감과 더부룩함을 호소한다.",
            vitals: { bp: { systolic: 126, diastolic: 82 }, pulse: 84, rr: 18, temp: 36.8 },
        },
    },
    순환기: {
        흉통: {
            description: "계단 오르면 가슴 중앙이 조이는 통증이 발생한다.",
            vitals: { bp: { systolic: 150, diastolic: 90 }, pulse: 98, rr: 20, temp: 36.9 },
        },
    },
    호흡기: {
        호흡곤란: {
            description: "활동 시 숨이 차고 쌕쌕거림이 동반된다.",
            vitals: { bp: { systolic: 132, diastolic: 86 }, pulse: 92, rr: 24, temp: 37.0 },
        },
    },
};

/* 안전 접근 헬퍼 (데이터 없으면 기본값 반환) */
function getCaseData(category: string, caseName: string): CaseInfo {
    const fallback: CaseInfo = {
        description: "증례 설명이 준비 중입니다.",
        vitals: { bp: { systolic: 120, diastolic: 80 }, pulse: 80, rr: 18, temp: 36.8 },
    };
    return CASE_MOCK[category]?.[caseName] ?? fallback;
}

/* °C 포맷 */
const formatTemp = (t: number) => `${t.toFixed(1)}°C`;

/* =======================
   Client Page
======================= */
export default function LiveCPXClient({
    category,
    caseName,
}: {
    category: string;
    caseName: string;
}) {
    const router = useRouter();

    // 상태
    const [isRecording, setIsRecording] = useState(false);
    const [seconds, setSeconds] = useState<number>(INITIAL_SECONDS);
    const [isFinished, setIsFinished] = useState(false);

    // 케이스 데이터 (메모)
    const caseData = useMemo(() => getCaseData(category, caseName), [category, caseName]);

    // MM:SS 포맷
    const showTime = useCallback((sec: number) => {
        const mm = Math.floor(sec / 60).toString().padStart(2, "0");
        const ss = (sec % 60).toString().padStart(2, "0");
        return `${mm}:${ss}`;
    }, []);

    // 카테고리/케이스 변경 시 타이머 초기화
    useEffect(() => {
        setIsRecording(false);
        setIsFinished(false);
        setSeconds(INITIAL_SECONDS);
    }, [category, caseName]);

    // 타이머 진행
    useEffect(() => {
        if (!isRecording || isFinished) return;
        const id = setInterval(() => {
            setSeconds((prev) => {
                if (prev <= 1) {
                    clearInterval(id);
                    setIsRecording(false);
                    setIsFinished(true);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(id);
    }, [isRecording, isFinished]);

    // 중앙 큰 버튼(아이콘) 탭 시 토글
    const toggleRecording = () => {
        if (isFinished) return; // 완료되면 조작 불가
        setIsRecording((prev) => !prev);
    };

    // 제출(업로드 → 채점) — 데모용
    async function handleSubmit() {
        alert(`s3 업로드 후 GPT 호출 (category: ${category}, case: ${caseName})`);
    }

    const { bp, pulse, rr, temp } = caseData.vitals;

    return (
        <div className="flex flex-col">
            <SmallHeader
                title={`${category} | ${caseName}`}
                onClick={() => router.push("/record-select")}
            />

            {/* 설명 */}
            <div className="px-8 pt-4">
                <p className="text-[#210535] text-[18px] leading-relaxed">
                    {caseData.description}
                </p>
            </div>

            {/* 바이탈표 (2열 그리드) */}
            <div className="grid grid-cols-2 gap-y-4 gap-x-4 px-8 pt-6 pb-12">
                <div className="flex gap-2">
                    <div className="text-[#210535] font-semibold text-[18px]">혈압</div>
                    <div className="text-[#210535] text-[18px]">
                        {bp.systolic}/{bp.diastolic}
                    </div>
                </div>

                <div className="flex gap-2">
                    <div className="text-[#210535] font-semibold text-[18px]">맥박</div>
                    <div className="text-[#210535] text-[18px]">
                        {pulse}
                    </div>
                </div>

                <div className="flex gap-2">
                    <div className="text-[#210535] font-semibold text-[18px]">호흡수</div>
                    <div className="text-[#210535] text-[18px]">
                        {rr}
                    </div>
                </div>

                <div className="flex gap-2">
                    <div className="text-[#210535] font-semibold text-[18px]">체온</div>
                    <div className="text-[#210535] text-[18px]">
                        {formatTemp(temp)}
                    </div>
                </div>
            </div>

            {/* 본문 (아이콘 + 타이머) */}
            <div className="flex-1 pb-[136px] flex flex-col items-center justify-center gap-[24px]">
                <button
                    type="button"
                    onClick={toggleRecording}
                    disabled={isFinished}
                    className="outline-none"
                >
                    {isRecording ? (
                        <PauseIcon className="w-[240px] h-[240px] text-[#B1A5E8] hover:text-[#7553FC] active:text-[#7553FC]" />
                    ) : (
                        <PlayIcon className="w-[240px] h-[240px] text-[#7553FC] hover:opacity-90 active:opacity-80" />
                    )}
                </button>

                <div className="font-semibold text-[36px] text-[#7553FC] tabular-nums">
                    {showTime(seconds)}
                </div>
            </div>

            {/* 하단 고정 CTA 버튼 */}
            <BottomFixButton
                disabled={isRecording}
                onClick={handleSubmit}
                buttonName={isFinished ? "채점 보기" : "종료 및 채점하기"}
            />
        </div>
    );
}
