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

    const handleSubmit = () => {
        const regex = /^20\d{8}$/;
        if (!regex.test(studentId)) {
            setError("학번은 '20XXXXXXXX' 형식의 10자리 숫자여야 합니다.");
            return;
        }
        setError("");
        setGlobalStudentId(studentId);
        onConfirm();
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex justify-center items-center z-[10000]">
            <div className="bg-white rounded-2xl shadow-lg w-[90%] max-w-[400px] p-6 text-center flex flex-col gap-4">
                <h2 className="text-[20px] font-semibold text-[#210535]">학번을 입력해주세요</h2>
                <input
                    type="text"
                    placeholder="예: 2023123456"
                    value={studentId}
                    onChange={(e) => setStudentId(e.target.value)}
                    className="border border-gray-300 rounded-lg px-4 py-2 text-center w-full text-[16px] focus:outline-none focus:ring-2 focus:ring-[#7553FC]"
                />
                {error && <p className="text-red-500 text-sm">{error}</p>}
                <div className="flex justify-center gap-4 mt-2">
                    <button
                        onClick={handleSubmit}
                        className="w-full bg-[#7553FC] text-white text-[16px] font-medium px-6 py-3 rounded-lg hover:bg-[#6743f0]"
                    >
                        확인
                    </button>
                </div>
            </div>
        </div>
    );
}
