"use client";
import { useState, type ComponentType } from "react";
import RightArrowIcon from "@/assets/icon/RightArrowIcon.svg";
import LeftArrowIcon from "@/assets/icon/LeftArrowIcon.svg";
import StudentIdPopup from "./StudentIdPopup";
import { Instruction1Video, Instruction2Video, Instruction3Video, Instruction4Video, Instruction5Video } from "./VideoLoop";

interface Props {
    onClose: () => void;
    onReadyStart: () => void; // 준비타이머 시작용 콜백 추가
}

type Slide = {
    title: string;
    content: string;
    video?: ComponentType;
};

export default function LiveClientPopup({ onClose, onReadyStart }: Props) {
    const [step, setStep] = useState(0);
    // const [dontShowAgain, setDontShowAgain] = useState(false);
    const [showStudentPopup, setShowStudentPopup] = useState<boolean>(false); // 새 팝업 상태 추가

    const nextStep = () => {
        if (step < 4) setStep(step + 1);
        else {
            // if (dontShowAgain) localStorage.setItem("isLiveClientShow", "false");
            setShowStudentPopup(true); // 학번 입력 팝업 띄우기
        }
    };

    const prevStep = () => {
        if (step > 0) setStep(step - 1);
    };

    // 단순 마크다운(**bold**)만 처리해서 여백 이슈 없이 볼드 유지
    const renderContent = (md: string) => {
        const renderLine = (line: string, lineIdx: number, last: boolean) => {
            const segments = line.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
            return (
                <span key={lineIdx}>
                    {segments.map((seg, idx) => {
                        const boldMatch = seg.match(/^\*\*(.+)\*\*$/);
                        if (boldMatch) return <strong key={idx}>{boldMatch[1]}</strong>;
                        return <span key={idx}>{seg}</span>;
                    })}
                    {!last && <br />}
                </span>
            );
        };

        const lines = md.split("\n");
        return lines.map((line, idx) => renderLine(line, idx, idx === lines.length - 1));
    };

    const slides: Slide[] = [
        {
            title: "발음은 최대한 또박또박!",
            content: "**발음이 정확**할수록\n환자의 대답도 정확해져요!",
            video: Instruction1Video
        },
        {
            title: "혼잣말은 No!",
            content: `가상환자는 **혼잣말**에도 대답해요.\nex) "가만 있어보자..." → "네, 가만히 있을게요."\n\n생각 정리도 혼잣말 없이 해주세요!`,
            video: Instruction2Video
        },
        {
            title: "환자의 응답이 느릴 수 있어요.",
            content: "환자도 가끔 생각을 하거든요.\n답변이 오지 않아도 **잠시만 기다려주세요!**",
            video: Instruction3Video
        },
        {
            title: "신체진찰은 '말로' 진행해주세요.",
            content: `ex) 눈 결막 보도록 하겠습니다.\n\n말하면 진찰 결과까지 알려줍니다!\n만약 결과를 듣지 못하셨다면\n**"결과는 어떤가요?"**라고 물어보시면 됩니다!`,
            video: Instruction4Video
        },
        {
            title: "준비되셨나요?",
            content: "상황 숙지 1분 타이머가 시작됩니다!",
            video: Instruction5Video
        },
    ];

    const CurrentVideo = slides[step]?.video;

    return (
        <>
            <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-[9999]">
                <div className="bg-white rounded-2xl shadow-lg w-[90%] max-w-[400px] h-[520px] p-6 items-center text-center flex flex-col relative">
                    <h2 className="text-[20px] font-semibold text-[#210535]">{slides[step].title}</h2>
                    <p className="text-[18px] text-[#4b3d6e] flex flex-col mt-4">
                        {renderContent(slides[step].content)}
                    </p>
                    <div className="flex flex-1 h-full justify-center items-center">
                        {CurrentVideo ? <CurrentVideo /> : null}
                    </div>
                    <div className="flex justify-center gap-2 mt-2">
                        {slides.map((_, i) => (
                            <div
                                key={i}
                                className={`w-2.5 h-2.5 rounded-full transition-all ${step === i ? "bg-[#7553FC]" : "bg-gray-300"
                                    }`}
                            ></div>
                        ))}
                    </div>

                    <div className="flex w-full justify-between items-center mt-2">
                        <button
                            onClick={prevStep}
                            disabled={step === 0}
                            className={`px-2 rounded-full transition-all ${step === 0 ? "opacity-30 cursor-not-allowed" : "hover:bg-gray-100"
                                }`}
                        >
                            <LeftArrowIcon className="w-6 h-6 text-[#7553FC]" />
                        </button>

                        {step < 4 ? (
                            <button
                                onClick={nextStep}
                                className="px-2 rounded-full hover:bg-gray-100 transition-all"
                            >
                                <RightArrowIcon className="w-6 h-6 text-[#7553FC]" />
                            </button>
                        ) : (
                            <button
                                onClick={nextStep}
                                className="bg-[#7553FC] text-white text-[16px] font-medium cursor-pointer py-3 px-6 rounded-xl hover:bg-[#6743f0]"
                            >
                                시작하기
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* 학번 입력 팝업 */}
            {showStudentPopup && (
                <StudentIdPopup
                    onClose={() => setShowStudentPopup(false)}
                    onConfirm={onReadyStart}
                />
            )}
        </>
    );
}
