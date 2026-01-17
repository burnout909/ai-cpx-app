export type OnboardingStatus = "missing" | "pending" | "approved" | "rejected";
export type OnboardingStatusResult = {
  status: OnboardingStatus;
  rejectReason?: string | null;
};

export async function fetchOnboardingStatus(): Promise<OnboardingStatusResult> {
  const res = await fetch("/api/onboarding/status", {
    method: "GET",
    credentials: "include",
  });
  if (!res.ok) return { status: "missing" };
  const data = await res.json().catch(() => ({}));
  const status = String(data?.status || "").toLowerCase();
  if (status === "approved" || status === "pending" || status === "rejected") {
    return {
      status: status as OnboardingStatus,
      rejectReason: data?.rejectReason ?? null,
    };
  }
  return { status: "missing" };
}
