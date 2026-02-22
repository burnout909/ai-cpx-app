const DEDUP_WINDOW_MS = 5000;
const recentMessages = new Map<string, number>();

interface ReportOptions {
  stackTrace?: string;
  source?: string;
  metadata?: Record<string, unknown>;
  level?: "WARN" | "ERROR";
}

export function reportClientError(
  message: string,
  options?: ReportOptions,
): void {
  try {
    // Dedup: skip if same message was sent within last 5 seconds
    const now = Date.now();
    const lastSent = recentMessages.get(message);
    if (lastSent && now - lastSent < DEDUP_WINDOW_MS) return;
    recentMessages.set(message, now);

    // Cleanup old entries
    if (recentMessages.size > 50) {
      for (const [key, ts] of recentMessages) {
        if (now - ts > DEDUP_WINDOW_MS) recentMessages.delete(key);
      }
    }

    const payload = JSON.stringify({
      message: message.slice(0, 2000),
      stackTrace: options?.stackTrace?.slice(0, 5000),
      source: options?.source,
      metadata: options?.metadata,
      userAgent: navigator.userAgent,
      level: options?.level ?? "ERROR",
    });

    // Prefer sendBeacon (works during page unload), fallback to fetch
    const url = "/api/client-error";
    const sent =
      typeof navigator.sendBeacon === "function" &&
      navigator.sendBeacon(url, new Blob([payload], { type: "application/json" }));

    if (!sent) {
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
      }).catch(() => {
        // Silently fail — error reporter must not throw
      });
    }
  } catch {
    // Silently fail
  }
}
