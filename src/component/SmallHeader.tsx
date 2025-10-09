'use client'
import LeftArrowIcon from "@/assets/icon/LeftArrowIcon.svg"
export default function SmallHeader({ title, onClick }: { title: string, onClick: () => void; }) {
    return (
        <div className="flex justify-between px-5 py-3 items-center">
            <div className="flex justify-center items-center w-[48px] h-[48px] cursor-pointer">
                <LeftArrowIcon className="w-[28px] h-[28px] text-[#210535]" onClick={onClick} />
            </div>
            <div className="text-[22px] font-semibold text-[#210535]">
                {title}
            </div>
            <div className="w-[28px] h-[28px]" />
        </div>
    )
}