"use client";
import { useState } from "react";
import RightArrowIcon from "@/assets/icon/RightArrowIcon.svg";
import LeftArrowIcon from "@/assets/icon/LeftArrowIcon.svg";
import StudentIdPopup from "./StudentIdPopup";

interface Props {
    onClose: () => void;
    onReadyStart: () => void; // 준비타이머 시작용 콜백 추가
}

export default function LiveClientPopup({ onClose, onReadyStart }: Props) {
    const [step, setStep] = useState(0);
    // const [dontShowAgain, setDontShowAgain] = useState(false);
    const [showStudentPopup, setShowStudentPopup] = useState<boolean>(false); // 새 팝업 상태 추가

    const nextStep = () => {
        if (step < 2) setStep(step + 1);
        else {
            // if (dontShowAgain) localStorage.setItem("isLiveClientShow", "false");
            setShowStudentPopup(true); // 학번 입력 팝업 띄우기
        }
    };

    const prevStep = () => {
        if (step > 0) setStep(step - 1);
    };

    const slides = [
        {
            title: "발음은 최대한 또박또박!",
            content: "발음이 정확해야 채점이 정확하게 이루어져요.",
        },
        {
            title: "신체진찰은 '말로' 진행해주세요.",
            content: "말하면 가상 환자가 검사 결과를 알려줍니다.",
        },
        {
            title: "준비되셨나요?",
            content: "이제 가상환자와 대화를 시작해볼까요?",
        },
    ];

    return (
        <>
            <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-[9999]">
                <div className="bg-white rounded-2xl shadow-lg w-[90%] max-w-[400px] p-6 text-center flex flex-col gap-4 relative">
                    <h2 className="text-[20px] font-semibold text-[#210535]">{slides[step].title}</h2>
                    <p className="text-[18px] text-[#4b3d6e]">{slides[step].content}</p>

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

                        {step < 2 ? (
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