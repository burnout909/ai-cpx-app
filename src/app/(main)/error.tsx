"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/reportClientError";

export default function MainError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportClientError(error.message || "Main page error", {
      stackTrace: error.stack,
      source: "main-error-boundary",
      metadata: { digest: error.digest },
    });
  }, [error]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        gap: "16px",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <h2 style={{ fontSize: "18px", fontWeight: 600, color: "#333" }}>
        오류가 발생했습니다
      </h2>
      <div style={{ display: "flex", gap: "12px" }}>
        <button
          onClick={reset}
          style={{
            padding: "10px 24px",
            backgroundColor: "#7553FC",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            fontSize: "14px",
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          다시 시도
        </button>
        <button
          onClick={() => (window.location.href = "/")}
          style={{
            padding: "10px 24px",
            backgroundColor: "#f3f4f6",
            color: "#333",
            border: "none",
            borderRadius: "8px",
            fontSize: "14px",
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          홈으로 돌아가기
        </button>
      </div>
    </div>
  );
}
