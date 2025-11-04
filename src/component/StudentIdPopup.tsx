"use client";
import { useState } from "react";
import { useUserStore } from "@/store/useUserStore";

interface Props {
    onClose: () => void;
    onConfirm: () => void;
}

export default function StudentIdPopup({ onClose, onConfirm }: Props) {
    const [studentId, setStudentId] = useState("");
    const [error, setError] = useState("");
    const setGlobalStudentId = useUserStore((s) => s.setStudentId);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        // 숫자만 입력 가능 + 10자리 제한
        const value = e.target.value.replace(/[^0-9]/g, "").slice(0, 10);
        setStudentId(value);

    };

    const handleSubmit = () => {
        const regex = /^\d{4}191\d{3}$/;
        if (!regex.test(studentId)) {
            setError("학번은 'XXXX191XXX' 형식의 10자리 숫자여야 합니다.");
            return;
        }
        setError("");
        setGlobalStudentId(studentId);
        onConfirm();
        onClose();
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter" && !error && studentId.length === 10) {
            handleSubmit();
        }
    };

    const isValid = studentId.length === 10;

    return (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-[10000]">
            <div className="bg-white rounded-2xl shadow-lg w-[90%] max-w-[400px] p-6 text-center flex flex-col gap-4">
                <h2 className="text-[20px] font-semibold text-[#210535]">학번을 입력해주세요</h2>

                <input
                    type="text"
                    placeholder="예: 2023191000"
                    value={studentId}
                    onChange={handleChange}
                    onKeyDown={handleKeyDown}
                    maxLength={10}
                    className="border border-gray-300 rounded-lg px-4 py-2 text-center w-full text-[16px] focus:outline-none focus:ring-2 focus:ring-[#7553FC]"
                />

                {error && <p className="text-red-500 text-sm">{error}</p>}

                <div className="flex justify-center gap-4 mt-2">
                    <button
                        onClick={handleSubmit}
                        disabled={!isValid}
                        className={`w-full text-[16px] font-medium px-6 py-3 rounded-lg transition-all
                            ${isValid
                                ? "bg-[#7553FC] text-white hover:bg-[#6743f0] cursor-pointer"
                                : "bg-gray-300 text-gray-500 cursor-not-allowed"}`}
                    >
                        확인
                    </button>
                </div>
            </div>
        </div>
    );
}
