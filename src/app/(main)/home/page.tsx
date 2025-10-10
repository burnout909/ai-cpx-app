'use client'
import { ReactNode, useTransition } from "react";
import RightArrowIcon from "@/assets/icon/RightArrowIcon.svg"
import MicroPhoneIcon from "@/assets/icon/MicrophoneIcon.svg"
import PeopleIcon from "@/assets/icon/PeopleIcon.svg"
import SprakleIcon from "@/assets/icon/SparkleIcon.svg"
import { useRouter } from "next/navigation";
import Spinner from "@/component/Spinner";

export default function Home() {
    const router = useRouter();

    return (
        <div>
            <div className="flex px-5 py-3 flex-col gap-8">
                <HomeComponent
                    icon={<MicroPhoneIcon className="w-[24px] h-[24px] text-[#210535]" />}
                    title={"이미 녹음본이 있어요"}
                    buttonName="채점 받기"
                    onClick={() => router.push('/upload-select')}
                />
                <HomeComponent
                    icon={<PeopleIcon className="w-[24px] h-[24px] text-[#210535]" />}
                    title={"환자 역할 해줄 사람이 있어요"}
                    buttonName="녹음 후 채점 받기"
                    onClick={() => router.push('/record-select')}
                />
                <HomeComponent
                    icon={<SprakleIcon className="w-[24px] h-[24px] text-[#210535]" />}
                    title={"혼자 연습하고 싶어요"}
                    buttonName="가상환자와 실습하기"
                    onClick={() => router.push('/live-select')}
                />
            </div>
        </div>
    );
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
    const [isPending, startTransition] = useTransition();

    const handleClick = () => {
        startTransition(() => {
            onClick();
        });
    };

    return (
        <div className="w-full flex flex-col gap-4 px-2">
            {/* 상단 타이틀 + 로딩 스피너 */}
            <div className="flex gap-2 items-center">
                {icon}
                <span className="font-semibold text-[20px]">{title}</span>
            </div>

            {/* 버튼 영역 */}
            <button
                onClick={handleClick}
                disabled={isPending}
                className={`flex cursor-pointer items-center w-full justify-between py-[14px] px-6 text-[#210535] font-semibold bg-[#DAD7E8] rounded-[12px] transition-opacity duration-200 ${isPending ? "opacity-80" : "hover:opacity-80"
                    }`}
            >
                <span className="text-[18px] font-semibold flex gap-2 items-center">
                    {buttonName}
                    {isPending && <Spinner size={20} borderClassName="border-[#210535]"/>} {/* pending 중이면 스피너 표시 */}
                </span>
                <RightArrowIcon className="w-[24px] h-[24px]" />

            </button>
        </div>
    );
}
