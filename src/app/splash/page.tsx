'use client'

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Image from "next/image";

export default function SplashPage() {
    const router = useRouter();

    useEffect(() => {
        const timer = setTimeout(() => {
            router.replace('/home');
        }, 2000);
        return () => clearTimeout(timer);
    }, [router]);

    return (
        <div className="flex min-h-dvh justify-center items-center flex-col bg-[#FAFAFA]">
            <div className="relative w-[240px] h-[240px]">
                <Image
                    src="/LogoIcon.png" 
                    alt="splash"
                    fill
                />
            </div>
            <div className="relative w-[130px] h-[19px] mt-[-20px]">
                <Image
                    src="/LogoLetterIcon.svg"
                    alt="letterLogo"
                    fill
                />
            </div>
        </div>
    );
}
