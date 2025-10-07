'use client';

import BottomFixButton from "@/component/BottomFixButton";
import SmallHeader from "@/component/SmallHeader";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import PlayIcon from "@/asset/icon/PlayIcon.svg";
import PauseIcon from "@/asset/icon/PauseIcon.svg";

const INITIAL_SECONDS = 12 * 60;

type Props = { category: string; caseName: string };

export default function RecordCPXClient({ category, caseName }: Props) {
    const router = useRouter();
    const [isRecording, setIsRecording] = useState(false);
    const [seconds, setSeconds] = useState<number>(INITIAL_SECONDS);
    const [isFinished, setIsFinished] = useState(false);

    const showTime = useCallback((sec: number) => {
        const mm = Math.floor(sec / 60).toString().padStart(2, "0");
        const ss = (sec % 60).toString().padStart(2, "0");
        return `${mm}:${ss}`;
    }, []);

    useEffect(() => {
        setIsRecording(false);
        setIsFinished(false);
        setSeconds(INITIAL_SECONDS);
    }, [category, caseName]);

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

    const toggleRecording = () => {
        if (isFinished) return;
        setIsRecording((prev) => !prev);
    };

    async function handleSubmit() {
        alert(`s3 업로드 후 GPT 호출 (category: ${category}, case: ${caseName})`);
    }

    return (
        <div className="flex flex-col">
            <SmallHeader
                title={`${category} | ${caseName}`}
                onClick={() => router.push("/record-select")}
            />

            <div className="flex-1 pt-[120px] pb-[136px] flex flex-col items-center justify-center gap-[24px]">
                <span className="text-[22px] text-[#8473D0] font-medium">
                    {isFinished ? "평가가 완료되었습니다." : isRecording ? "탭하여 일시정지" : "탭하여 시작"}
                </span>

                <button type="button" onClick={toggleRecording} disabled={isFinished} className="outline-none">
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

            <BottomFixButton
                disabled={isRecording}
                onClick={handleSubmit}
                buttonName={isFinished ? "채점 보기" : "종료 및 채점하기"}
            />
        </div>
    );
}
