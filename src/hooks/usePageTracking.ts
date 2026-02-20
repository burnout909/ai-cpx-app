"use client";

import { useEffect, useRef } from "react";
import { track } from "@/lib/mixpanel";

export function usePageTracking(page: string, extra?: Record<string, unknown>) {
  const enterTime = useRef(0);

  useEffect(() => {
    enterTime.current = Date.now();
    track("page_view", { page, ...extra });
    return () => {
      const duration = Date.now() - enterTime.current;
      // StrictMode double-mount에 의한 즉시 unmount 무시 (100ms 미만)
      if (duration < 100) return;
      track("page_leave", { page, duration_ms: duration, ...extra });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);
}
