"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { track } from "@/lib/mixpanel";
import Spinner from "@/component/Spinner";

export default function AuthCallbackClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [message, setMessage] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    let isCancelled = false;
    const run = async () => {
      const errorDescription = searchParams.get("error_description");
      if (errorDescription) {
        track("auth_oauth_error", { error: errorDescription });
        setHasError(true);
        setMessage(decodeURIComponent(errorDescription));
        return;
      }

      const redirectTo = searchParams.get("redirect") || "/home";
      const syncAndRedirect = async () => {
        const res = await fetch("/api/auth/sync-profile", {
          method: "POST",
          credentials: "include",
        });
        const data = await res.json().catch(() => ({}));
        if (isCancelled) return;
        if (data?.status === "missing") {
          track("auth_onboarding_redirected");
          router.replace("/onboarding");
          return;
        }
        track("auth_login_completed");
        router.replace(redirectTo);
      };

      const { data, error } = await supabase.auth.getSession();
      if (error) {
        setHasError(true);
        setMessage(error.message);
        return;
      }

      if (data.session) {
        await syncAndRedirect();
        return;
      }

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === "SIGNED_IN" && session) {
          subscription.unsubscribe();
          await syncAndRedirect();
        }
      });
    };

    run();
    return () => {
      isCancelled = true;
    };
  }, [searchParams, supabase, router]);

  return (
    <main className="min-h-screen bg-[#f7f6fb] flex items-center justify-center p-6">
      <div className="w-full max-w-[420px] rounded-2xl bg-white p-8 text-center">
        {hasError && message ? (
          <p className="text-sm text-red-500">{message}</p>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <Spinner size={28} borderClassName="border-[#7553FC]" />
            <p className="text-sm text-gray-500">로그인 처리 중</p>
          </div>
        )}
      </div>
    </main>
  );
}
