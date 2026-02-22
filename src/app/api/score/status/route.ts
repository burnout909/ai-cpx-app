// src/app/api/score/status/route.ts
import { NextResponse, after } from "next/server";
import { Redis } from "@upstash/redis";
import { processNextJob, type ScoreJob, type ScoreJobStatus } from "../_worker";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const maxDuration = 300;

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get("id");

    if (!jobId) {
      return NextResponse.json(
        { detail: "id query parameter is required" },
        { status: 400 },
      );
    }

    const job = await redis.get<ScoreJob>(`score:job:${jobId}`);

    if (!job) {
      return NextResponse.json(
        { detail: "job not found" },
        { status: 404 },
      );
    }

    const response: ScoreJobStatus = {
      status: job.status,
    };

    if (job.status === "waiting") {
      const queue = await redis.lrange<string>("score:queue", 0, -1);
      const pos = queue.indexOf(jobId);
      response.position = pos >= 0 ? pos + 1 : undefined;
    }

    if (job.status === "processing") {
      response.progress = job.progress ?? 0;
      response.stage = job.stage;
    }

    if (job.status === "done" && job.result) {
      response.progress = 100;
      response.result = job.result;
    }

    if (job.status === "failed" && job.error) {
      response.error = job.error;
    }

    // Polling doubles as worker trigger — if there's capacity, process next
    if (job.status !== "processing") {
      after(async () => {
        await processNextJob().catch(() => {});
      });
    }

    return NextResponse.json(response);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`Score status failed: ${msg}`, {
      source: "score/status",
      stackTrace: err instanceof Error ? err.stack : undefined,
    });
    return NextResponse.json(
      { detail: `status failed: ${msg}` },
      { status: 500 },
    );
  }
}
