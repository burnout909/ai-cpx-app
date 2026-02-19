"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { track } from "@/lib/mixpanel";

export default function LoginClient() {
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const redirectTo = searchParams.get("redirect") || "/home";

  const handleOAuthSignIn = async (provider: "google" | "kakao") => {
    track("auth_login_clicked", { provider });
    setIsLoading(true);
    setMessage(null);

    const redirectBase =
      typeof window !== "undefined" ? window.location.origin : "";
    const redirectUrl = `${redirectBase}/auth/callback?redirect=${encodeURIComponent(
      redirectTo
    )}`;

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: redirectUrl,
      },
    });

    setIsLoading(false);
    if (error) {
      track("auth_login_error", { provider, error: error.message });
      setMessage(error.message);
    }
  };

  return (
    <main className="min-h-screen bg-[#f7f6fb] flex items-center justify-center p-6">
      <div className="w-full max-w-[420px] rounded-2xl bg-white p-8">
        <div className="flex  flex-col items-center gap-3 justify-center">
          <div className="relative h-[84px] w-[84px]">
            <Image src="/LogoIcon.png" alt="CPXMate symbol logo" fill />
          </div>
          <div className="relative flex font-semibold text-[18px]">
            <h2>CPX-MATE</h2>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-2">
          <button
            onClick={() => handleOAuthSignIn("google")}
            disabled={isLoading}
            className="h-11 rounded-lg border border-gray-200 bg-white text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Image src="/icons/google.svg" alt="Google" width={20} height={20} />
            Google로 계속하기
          </button>
          <button
            onClick={() => handleOAuthSignIn("kakao")}
            disabled={isLoading}
            className="h-11 rounded-lg bg-[#FEE500] text-[#3B1E1E] text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Image src="/icons/kakao.png" alt="Kakao" width={20} height={20} />
            Kakao로 계속하기
          </button>
        </div>

        {message && <p className="text-sm text-red-500 mt-4">{message}</p>}

        <div className="flex flex-1 justify-center gap-4">
          <div className="mt-6 text-center text-[14px] text-gray-500">
            <Link href="/policy/privacy" className="hover:underline">
              개인정보처리방침
            </Link>
          </div>
          <div className="mt-6 text-center text-[14px] text-gray-500">
            <Link href="/policy/terms" className="hover:underline">
              이용약관
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
