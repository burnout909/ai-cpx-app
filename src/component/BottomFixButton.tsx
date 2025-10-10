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
                className={`mx-auto max-w-[410px] fixed px-6 py-[14px] rounded-[12px]
          left-[20px] right-[20px] bottom-[42px]
          text-white font-semibold text-[20px]
          flex gap-3 justify-center items-center gap-2 transition-all z-[50]
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
          fixed mx-auto max-w-[450px] h-[126px] bottom-0 left-0 right-0
          backdrop-blur-xs
        "
            />
        </>
    );
}
