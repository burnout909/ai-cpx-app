import { NextResponse } from "next/server";
import { getOpenAIClient } from "../_lib";
import { logger } from "@/lib/logger";
import { classifySectionsCore } from "@/lib/pipeline/classifySections";
import type { ClassifySectionsInput } from "@/lib/pipeline/classifySections";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  let payload: ClassifySectionsInput | undefined;
  try {
    payload = (await req.json()) as ClassifySectionsInput;
    const { transcript } = payload;

    if (!transcript) {
      return NextResponse.json(
        { detail: "transcript is required" },
        { status: 400 }
      );
    }

    const openai = await getOpenAIClient();
    const result = await classifySectionsCore(openai, payload);

    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.error(`classifySections failed: ${msg}`, {
      source: "api/classifySections",
      stackTrace: e instanceof Error ? e.stack : undefined,
      metadata: { caseName: payload?.caseName, transcriptLength: payload?.transcript?.length },
    });
    return NextResponse.json(
      { detail: `classifySections failed: ${msg}` },
      { status: 500 }
    );
  }
}
