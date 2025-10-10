'use client';
import Image from "next/image"
import { useRouter } from "next/navigation"

export default function Header() {
    const router = useRouter();
    return (
        <div className="px-3 pt-5 flex items-center">
            <button className="flex items-center cursor-pointer" onClick={() => router.push('/home')}>
                <div className="relative w-[70px] h-[70px]">
                    <Image
                        src="/LogoIcon.png"
                        alt="logo"
                        fill
                    />
                </div>
                <div className="relative w-[106px] h-[16px]">
                    <Image
                        src="/LogoLetterIcon.svg"
                        alt="logo"
                        fill
                    />
                </div>
            </button>

        </div>
    )
}