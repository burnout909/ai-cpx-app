
interface ButtonProps {
    disabled: boolean;
    onClick: () => void;
    buttonName: string;
}
export default function BottomFixButton({ disabled, onClick, buttonName }: ButtonProps) {
    return (
        <>
            <button
                disabled={disabled}
                onClick={onClick}
                className={`mx-auto max-w-[386px] fixed px-6 py-4 rounded-[12px]
                    left-[32px] right-[32px] bottom-[52px]
                    text-white font-semibold text-[22px]
                    justify-center items-center transition-all z-[50]
                    ${!disabled
                        ? "bg-[#7553FC] hover:opacity-90"
                        : "bg-[#C4B8F6] cursor-not-allowed"
                    }
                    cursor-pointer
                    `}
            >
                {buttonName}
            </button>
            <div
                className="
    fixed mx-auto max-w-[450px] h-[136px] bottom-0 left-0 right-0
    bg-opcaity-10
    backdrop-blur-xs
  "
            />
        </>
    )
}