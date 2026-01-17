import { Suspense } from "react";
import AdminAccessClient from "./AdminAccessClient";

export default function AdminAccessPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#f7f6fb] flex items-center justify-center p-6">
          <div className="w-full max-w-[420px] rounded-2xl bg-white shadow-lg p-8">
            <p className="text-sm text-gray-500">로딩 중...</p>
          </div>
        </main>
      }
    >
      <AdminAccessClient />
    </Suspense>
  );
}
