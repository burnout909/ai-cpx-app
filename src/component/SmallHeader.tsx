'use client'
import LeftArrowIcon from "@/assets/icon/LeftArrowIcon.svg"
import { useTransition } from "react";
import Spinner from "./Spinner";
export default function SmallHeader({ title, onClick }: { title: string, onClick: () => void; }) {
    const [isPending, startTransition] = useTransition()
    function handleClick() {
        startTransition(() => {
            onClick()
        })
    }

    return (
        <div className="flex justify-between px-4 items-center">
            <div className="relative flex items-center justify-center items-center w-[48px] h-[48px] cursor-pointer">
                <LeftArrowIcon className="w-[24px] h-[24px] text-[#210535]" onClick={handleClick} />
                {isPending && (
                    <div className="absolute left-[40px] top-1/2 -translate-y-1/2 flex items-center justify-center">
                        <Spinner size={16} borderClassName="border-[#210535]" />
                    </div>
                )}            </div>
            <div className="text-[20px] font-semibold text-[#210535]">
                {title}
            </div>
            <div className="w-[24px] h-[24px]" />
        </div>
    )
}