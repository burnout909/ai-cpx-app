'use client'
import { ReactNode } from "react";
import RightArrowIcon from "@/assets/icon/RightArrowIcon.svg"
import MicroPhoneIcon from "@/assets/icon/MicrophoneIcon.svg"
import PeopleIcon from "@/assets/icon/PeopleIcon.svg"
import SprakleIcon from "@/assets/icon/SparkleIcon.svg"
import { useRouter } from "next/navigation";

export default function Home() {
    const router = useRouter()
    return (
        <div>
            <div className="flex p-8 flex-col gap-12">
                <HomeComponent
                    icon={<MicroPhoneIcon className="w-[28px] h-[28px] text-[#210535]" />}
                    title={"이미 녹음본이 있어요"}
                    buttonName="채점 받기"
                    onClick={() => router.push('/upload-select')}
                />
                <HomeComponent
                    icon={<PeopleIcon className="w-[28px] h-[28px] text-[#210535]" />}
                    title={"환자 역할 해줄 사람이 있어요"}
                    buttonName="녹음 후 채점 받기"
                    onClick={() => router.push('/record-select')}
                />
                <HomeComponent
                    icon={<SprakleIcon className="w-[28px] h-[28px] text-[#210535]" />}
                    title={"혼자 연습하고 싶어요"}
                    buttonName="가상환자와 실습하기"
                    onClick={() => router.push('/live-select')}
                />
            </div>
        </div>
    )
}

type HomeComponentProps = {
    icon: ReactNode;
    title: string;
    buttonName: string;
    onClick: () => void;
};

function HomeComponent({
    icon,
    title,
    buttonName,
    onClick,
}: HomeComponentProps) {
    return (
        <div className="w-full flex flex-col gap-4">
            <div className="flex gap-2 items-center">
                {icon}
                <span className="font-semibold text-[24px]">{title}</span>
            </div>
            <button className="hover:opacity-80 flex cursor-pointer items-center w-full justify-between py-[18px] px-6 text-[#210535] font-semibold bg-[#DAD7E8] rounded-[12px]" onClick={onClick}>
                <span className="text-[22px] font-semibold">{buttonName}</span>
                <RightArrowIcon className="w-[28px] h-[28px]" />
            </button>
        </div>
    );
}