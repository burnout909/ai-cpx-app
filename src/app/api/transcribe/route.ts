import { NextResponse } from "next/server";
import { getOpenAIClient } from "../_lib";
import { logger } from "@/lib/logger";
import { transcribeFromS3 } from "@/lib/pipeline/transcribe";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { s3_key } = await req.json();
    if (!s3_key) {
      return NextResponse.json({ detail: "s3_key is required" }, { status: 400 });
    }

    const bucket = process.env.NEXT_PUBLIC_S3_BUCKET_NAME!;
    const openai = await getOpenAIClient();
    const { segments, text } = await transcribeFromS3(openai, s3_key, bucket);

    return NextResponse.json({ backend: "openai", segments, text });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.error(`Transcribe failed: ${msg}`, {
      source: "api/transcribe",
      stackTrace: e instanceof Error ? e.stack : undefined,
    });
    return NextResponse.json({ detail: `Transcribe failed: ${msg}` }, { status: 500 });
  }
}
