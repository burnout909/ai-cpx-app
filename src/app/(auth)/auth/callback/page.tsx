import { Suspense } from "react";
import AuthCallbackClient from "./AuthCallbackClient";

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-[#f7f6fb] flex items-center justify-center p-6">
          <div className="w-full max-w-[420px] rounded-2xl bg-white p-8 text-center">
            <p className="text-sm text-gray-500">로그인 처리 중...</p>
          </div>
        </main>
      }
    >
      <AuthCallbackClient />
    </Suspense>
  );
}
