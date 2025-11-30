import type { ReactNode } from 'react';

export default function AdminLayout({ children }: { children: ReactNode }) {
    return (
        <div
            className="min-h-screen bg-white mx-auto min-w-[1280px] max-w-[1920px]"
        >
            {children}
        </div>
    );
}
