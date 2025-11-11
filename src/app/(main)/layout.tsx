import { Toaster } from "react-hot-toast";
import { ReactNode } from "react";

export default function Layout({ children }: { children: ReactNode }) {
    return (
        <div className="flex flex-col min-h-dvh">
            {children}
            <Toaster reverseOrder={false} />
        </div>
    )
}