"use client";
import { useState } from "react";
import RightArrowIcon from "@/assets/icon/RightArrowIcon.svg";
import LeftArrowIcon from "@/assets/icon/LeftArrowIcon.svg";
import StudentIdPopup from "./StudentIdPopup";
import { marked } from "marked";

interface Props {
    onClose: () => void;
    onReadyStart: () => void; // 준비타이머 시작용 콜백 추가
}

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

    marked.setOptions({ breaks: true, async: false });
    const renderMarkdown = (md: string) => marked.parseInline(md) as string;

    const slides = [
        {
            title: "발음은 최대한 또박또박!",
            content: "**발음이 정확**할수록\n환자의 대답도 정확해져요!",
        },
        {
            title: "혼잣말은 No!",
            content: `가상환자는 **혼잣말**에도 대답해요.\nex) 가만 있어보자... : 네, 가만히 있을게요.\n\n생각 정리도 혼잣말 없이 해주세요!`,
        },
        {
            title: "환자의 응답이 느릴 수 있어요.",
            content: "환자도 가끔 생각을 하거든요.\n답변이 오지 않아도 **잠시만 기다려주세요!**",
        },
        {
            title: "신체진찰은 '말로' 진행해주세요.",
            content: `ex) 눈 결막 보도록 하겠습니다.\n\n말하면 진찰 결과까지 알려줍니다!\n만약 결과를 듣지 못하셨다면\n"결과는 어떤가요?"라고 물어보시면 됩니다!`,
        },
        {
            title: "준비되셨나요?",
            content: "상황 숙지 1분 타이머가 시작됩니다!",
        },
    ];

    return (
        <>
            <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-[9999]">
                <div className="bg-white rounded-2xl shadow-lg w-[90%] max-w-[400px] p-6 h-[423px] text-center flex flex-col gap-4 relative">
                    <h1 className="text-[22px] font-bold text-red-600">⚠️ 필독 ⚠️</h1>
                    <h2 className="text-[20px] font-semibold text-[#210535]">{slides[step].title}</h2>
                    <p
                        className="text-[18px] text-[#4b3d6e] whitespace-pre-line flex flex-1 flex-col"
                        dangerouslySetInnerHTML={{ __html: renderMarkdown(slides[step].content) }}
                    />

                    <div className="flex justify-center gap-2 mt-3">
                        {slides.map((_, i) => (
                            <div
                                key={i}
                                className={`w-2.5 h-2.5 rounded-full transition-all ${step === i ? "bg-[#7553FC]" : "bg-gray-300"
                                    }`}
                            ></div>
                        ))}
                    </div>

                    <div className="flex justify-between items-center mt-6">
                        <button
                            onClick={prevStep}
                            disabled={step === 0}
                            className={`p-2 rounded-full transition-all ${step === 0 ? "opacity-30 cursor-not-allowed" : "hover:bg-gray-100"
                                }`}
                        >
                            <LeftArrowIcon className="w-6 h-6 text-[#7553FC]" />
                        </button>

                        {step < 4 ? (
                            <button
                                onClick={nextStep}
                                className="p-2 rounded-full hover:bg-gray-100 transition-all"
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
