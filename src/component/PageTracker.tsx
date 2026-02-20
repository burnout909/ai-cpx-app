"use client";

import { usePageTracking } from "@/hooks/usePageTracking";

export default function PageTracker({ page }: { page: string }) {
  usePageTracking(page);
  return null;
}
