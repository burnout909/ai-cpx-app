"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/reportClientError";

function isChunkLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    error.name === "ChunkLoadError" ||
    error.message?.includes("Loading chunk") ||
    error.message?.includes("Failed to fetch dynamically imported module")
  );
}

export default function GlobalErrorHandler() {
  useEffect(() => {
    function handleError(event: ErrorEvent) {
      if (isChunkLoadError(event.error)) return;

      reportClientError(event.message || "Unhandled error", {
        stackTrace: event.error?.stack,
        source: "global-error-handler",
        metadata: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        },
      });
    }

    function handleRejection(event: PromiseRejectionEvent) {
      const error = event.reason;
      if (isChunkLoadError(error)) return;

      const message =
        error instanceof Error ? error.message : String(error ?? "Unhandled promise rejection");

      reportClientError(message, {
        stackTrace: error instanceof Error ? error.stack : undefined,
        source: "unhandled-rejection",
      });
    }

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
    };
  }, []);

  return null;
}
