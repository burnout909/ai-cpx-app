// /app/api/collectEvidence/route.ts
import { NextResponse } from "next/server";
import { getOpenAIClient } from "../_lib";
import { logger } from "@/lib/logger";
import {
  collectEvidenceForSection,
  normalizeTranscriptToText,
} from "@/lib/pipeline/collectEvidence";
import type { SectionId, TranscriptInput, EvidenceChecklistItem, EvidenceListItem } from "@/lib/pipeline/collectEvidence";

// Re-export types for external consumers
export type { SectionId, TranscriptInput, EvidenceChecklistItem, EvidenceListItem };

/** Request DTO */
export interface CollectEvidenceRequest {
  transcript: TranscriptInput;
  evidenceChecklist?: EvidenceChecklistItem[];
  sectionId: SectionId;
}

/** Success Response DTO */
export interface CollectEvidenceResponse {
  evidenceList: EvidenceListItem[];
}

/** Error Response DTO */
export interface CollectEvidenceError {
  detail: string;
}

/* =========================
   Route
========================= */
export async function POST(
  req: Request
): Promise<NextResponse<CollectEvidenceResponse | CollectEvidenceError>> {
  try {
    const payload = (await req.json()) as CollectEvidenceRequest;
    const transcriptText = normalizeTranscriptToText(payload?.transcript);
    const evidenceChecklist = payload?.evidenceChecklist ?? [];
    const sectionId = payload?.sectionId;

    if (!transcriptText || !sectionId) {
      return NextResponse.json<CollectEvidenceError>(
        {
          detail:
            "Invalid payload: transcript, evidenceChecklist, sectionId required.",
        },
        { status: 400 }
      );
    }

    const openai = await getOpenAIClient();
    const evidenceList = await collectEvidenceForSection(
      openai,
      transcriptText,
      evidenceChecklist,
      sectionId,
    );

    return NextResponse.json<CollectEvidenceResponse>({ evidenceList });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`collectEvidence failed: ${msg}`, {
      source: "api/collectEvidence",
      stackTrace: err instanceof Error ? err.stack : undefined,
    });
    return NextResponse.json<CollectEvidenceError>(
      { detail: `collectEvidence failed: ${msg}` },
      { status: 500 }
    );
  }
}
