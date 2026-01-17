"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function AdminAccessClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/admin/dashboard";

  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    setIsLoading(true);
    setMessage(null);
    const res = await fetch("/api/admin/access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ password }),
    });
    setIsLoading(false);
    if (!res.ok) {
      setMessage("비밀번호가 일치하지 않습니다.");
      return;
    }
    router.replace(redirectTo);
  };

  return (
    <main className="min-h-screen bg-[#f7f6fb] flex items-center justify-center p-6">
      <div className="w-full max-w-[420px] rounded-2xl bg-white shadow-lg p-8">
        <h1 className="text-[22px] font-semibold text-[#210535]">
          관리자 접근
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          관리자 비밀번호를 입력하세요.
        </p>

        <div className="mt-6 flex flex-col gap-4">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호"
            className="h-11 rounded-lg border border-gray-200 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-[#7553FC]"
          />

          {message && <p className="text-sm text-red-500">{message}</p>}

          <button
            onClick={handleSubmit}
            disabled={isLoading || !password}
            className="h-11 rounded-lg bg-[#7553FC] text-white text-sm font-medium disabled:opacity-50"
          >
            확인
          </button>
        </div>
      </div>
    </main>
  );
}
