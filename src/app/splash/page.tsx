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
        <div className="flex min-h-screen justify-center items-center flex-col bg-[#FAFAFA]">
            <div className="relative w-[312px] h-[312px]">
                <Image
                    src="/LogoIcon.png" 
                    alt="splash"
                    fill
                />
            </div>
            <div className="relative w-[195px] h-[29px] mt-[-12px]">
                <Image
                    src="/LogoLetterIcon.svg"
                    alt="letterLogo"
                    fill
                />
            </div>
        </div>
    );
}
