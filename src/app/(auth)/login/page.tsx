import { Suspense } from "react";
import LoginClient from "./LoginClient";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#f7f6fb] flex items-center justify-center p-6">
          <div className="w-full max-w-[420px] rounded-2xl bg-white p-8">
            <p className="text-sm text-gray-500">로그인 페이지 로딩 중...</p>
          </div>
        </main>
      }
    >
      <LoginClient />
    </Suspense>
  );
}
