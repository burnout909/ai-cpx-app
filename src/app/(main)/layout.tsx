import { Toaster } from "react-hot-toast";
import { ReactNode } from "react";
import FloatingChatLauncher from "@/component/FloatingChatLauncher";

export default function Layout({ children }: { children: ReactNode }) {
    return (
        <div className="flex flex-col min-h-dvh w-full max-w-[450px] mx-auto bg-[#FCFCFC]">
            {children}
            <FloatingChatLauncher />
            <Toaster reverseOrder={false} />
        </div>
    )
}
