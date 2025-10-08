import Header from "@/component/Header";
import { ReactNode } from "react";

export default function Layout({ children }: { children: ReactNode }) {
    return (
        <div className="flex flex-col min-h-dvh">
            <Header />
            {children}
        </div>
    )
}