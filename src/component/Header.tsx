'use client';
import Image from "next/image"
import { useRouter } from "next/navigation"

export default function Header() {
    const router = useRouter();
    return (
        <div className="px-3 pt-4 flex items-center w-full">
            <button className="flex items-center cursor-pointer" onClick={() => router.push('/home')}>
                <div className="relative w-[60px] h-[60px]">
                    <Image
                        src="/LogoIcon.png"
                        alt="logo"
                        fill
                    />
                </div>
                <div className="relative w-[106px] h-[16px]">
                    <Image
                        src="/LogoLetterIcon.png"
                        alt="logo"
                        fill
                    />
                </div>
            </button>

        </div>
    )
}