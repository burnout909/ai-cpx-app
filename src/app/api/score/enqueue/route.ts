// src/app/api/score/enqueue/route.ts
import { NextResponse } from "next/server";
import { after } from "next/server";
import { Redis } from "@upstash/redis";
import { v4 as uuidv4 } from "uuid";
import { processNextJob, type ScoreJob } from "../_worker";
import { logger } from "@/lib/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 300; // Worker runs inside this function

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

interface EnqueueRequest {
  caseName: string;
  origin: "VP" | "SP";
  audioKeys?: string[];
  transcriptS3Key?: string;
  sessionId?: string;
  checklistId?: string;
  scenarioId?: string;
  timestampsS3Key?: string;
  cachedTranscriptS3Key?: string;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as EnqueueRequest;

    if (!body.caseName || !body.origin) {
      return NextResponse.json(
        { detail: "caseName and origin are required" },
        { status: 400 },
      );
    }

    // Resolve user from auth cookie (before response is sent)
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ detail: "unauthorized" }, { status: 401 });
    }

    const jobId = uuidv4();
    const job: ScoreJob = {
      ...body,
      userId: user.id,
      status: "waiting",
      createdAt: Date.now(),
    };

    // Save job and add to queue
    await redis.set(`score:job:${jobId}`, job, { ex: 600 });
    await redis.lpush("score:queue", jobId);

    // after() guarantees the worker runs to completion even after response is sent
    after(async () => {
      try {
        await processNextJob();
      } catch (err) {
        logger.warn(`processNextJob trigger failed: ${err instanceof Error ? err.message : String(err)}`, {
          source: "score/enqueue",
        });
      }
    });

    return NextResponse.json({ jobId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`Score enqueue failed: ${msg}`, {
      source: "score/enqueue",
      stackTrace: err instanceof Error ? err.stack : undefined,
    });
    return NextResponse.json(
      { detail: `enqueue failed: ${msg}` },
      { status: 500 },
    );
  }
}
