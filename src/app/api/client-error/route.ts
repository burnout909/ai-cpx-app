import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";

export interface ClientErrorRequest {
  message: string;
  stackTrace?: string;
  source?: string;
  metadata?: Record<string, unknown>;
  userAgent?: string;
  level?: "WARN" | "ERROR";
}

interface ClientErrorResponse {
  ok: boolean;
}

interface ClientErrorError {
  detail: string;
}

const MAX_MESSAGE_LENGTH = 2000;
const MAX_STACK_TRACE_LENGTH = 5000;

export async function POST(req: NextRequest) {
  try {
    const body: ClientErrorRequest = await req.json();

    if (!body.message || typeof body.message !== "string") {
      return NextResponse.json<ClientErrorError>(
        { detail: "client-error failed: message is required" },
        { status: 400 },
      );
    }

    const message = body.message.slice(0, MAX_MESSAGE_LENGTH);
    const stackTrace = body.stackTrace?.slice(0, MAX_STACK_TRACE_LENGTH);
    const source = `client/${body.source || "unknown"}`;
    const level = body.level === "WARN" ? "WARN" : "ERROR";
    const userAgent = body.userAgent?.slice(0, 500);

    const logFn = level === "WARN" ? logger.warn : logger.error;
    logFn(message, {
      source,
      stackTrace,
      userAgent,
      metadata: body.metadata,
    });

    return NextResponse.json<ClientErrorResponse>({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json<ClientErrorError>(
      { detail: `client-error failed: ${msg}` },
      { status: 500 },
    );
  }
}
