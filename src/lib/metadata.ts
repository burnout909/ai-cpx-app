export type MetadataType = "audio" | "transcript" | "feedback" | "score";

export type MetadataPayload = {
  type: MetadataType;
  s3Key: string;
  sessionId?: string | null;
  caseName?: string | null;
  diagnosis?: string;
  origin?: "VP" | "SP";
  fileName?: string;
  contentType?: string;
  sizeBytes?: number;
  durationSec?: number;
  language?: string;
  textExcerpt?: string;
  textLength?: number;
  tokenCount?: number;
  model?: string;
  total?: number;
  dataJson?: unknown;
  source?: "LIVE" | "UPLOAD";
  scenarioJson?: unknown;
  checklistJson?: unknown;
};

export async function postMetadata(payload: MetadataPayload) {
  try {
    const res = await fetch("/api/metadata", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    return {
      ok: res.ok,
      sessionId: typeof data?.sessionId === "string" ? data.sessionId : null,
      recordId: typeof data?.recordId === "string" ? data.recordId : null,
      error: res.ok ? null : data?.error || "metadata request failed",
    };
  } catch (err) {
    console.warn("[metadata request failed]", err);
    return { ok: false, sessionId: null, recordId: null, error: "network error" };
  }
}
