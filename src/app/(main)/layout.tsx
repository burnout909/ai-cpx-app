import { Toaster } from "react-hot-toast";
import { ReactNode } from "react";
import FloatingInquiryLauncher from "@/component/FloatingInquiryLauncher";
import RejectedOnboardingGate from "@/component/RejectedOnboardingGate";

export default function Layout({ children }: { children: ReactNode }) {
    return (
        <div className="flex flex-col min-h-dvh w-full max-w-[450px] mx-auto bg-[#FCFCFC]">
            <RejectedOnboardingGate />
            {children}
            <FloatingInquiryLauncher />
            <Toaster reverseOrder={false} />
        </div>
    )
}
