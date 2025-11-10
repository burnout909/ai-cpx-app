import Spinner from "@/component/Spinner";

interface ButtonProps {
    disabled: boolean;
    onClick: () => void;
    buttonName: string;
    loading?: boolean; // 추가: 로딩 중이면 Spinner 표시
}

export default function BottomFixButton({
    disabled,
    onClick,
    buttonName,
    loading = false,
}: ButtonProps) {
    return (
        <>
            <button
                disabled={disabled || loading}
                onClick={onClick}
                className={`mx-auto max-w-[418px] fixed px-6 py-[10px] rounded-[12px]
          left-[16px] right-[16px] bottom-[32px]
          text-white font-semibold text-[18px]
          flex gap-3 justify-center items-center gap-2 transition-all z-[52] whitespace-pre-line
          ${!disabled && !loading
                        ? "bg-[#7553FC] hover:opacity-90"
                        : "bg-[#C4B8F6] cursor-not-allowed opacity-90"
                    }
        `}
            >
                {/* 버튼 이름 */}
                {buttonName}

                {/* 로딩 중일 때 Spinner 표시 */}
                {loading && <Spinner size={20} borderClassName="border-white opacity-80" />}
            </button>

            {/* 하단 블러 배경 */}
            <div
                className="
          fixed mx-auto max-w-[450px] h-[90px] bottom-0 left-0 right-0
          backdrop-blur-xs z-[51]
        "
            />
        </>
    );
}
