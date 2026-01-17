"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import IdRejectedPopup from "@/component/IdRejectedPopup";
import { fetchOnboardingStatus } from "@/lib/onboarding";

const REJECTED_POPUP_KEY = "cpxmate_rejected_popup_seen";

export default function RejectedOnboardingGate() {
  const router = useRouter();
  const [reason, setReason] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let mounted = true;

    const checkStatus = async () => {
      if (sessionStorage.getItem(REJECTED_POPUP_KEY) === "1") return;
      const result = await fetchOnboardingStatus();
      if (mounted && result.status === "rejected") {
        sessionStorage.setItem(REJECTED_POPUP_KEY, "1");
        setReason(result.rejectReason ?? null);
        setOpen(true);
      }
    };

    checkStatus();

    return () => {
      mounted = false;
    };
  }, []);

  if (!open) return null;

  return (
    <IdRejectedPopup
      reason={reason}
      onClose={() => setOpen(false)}
      onRegister={() => {
        setOpen(false);
        router.push("/onboarding");
      }}
    />
  );
}
