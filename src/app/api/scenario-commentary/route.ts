import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export interface ScenarioCommentaryResponse {
  html: string;
}

export interface ScenarioCommentaryError {
  detail: string;
}

/**
 * GET: PUBLISHED 시나리오의 commentaryContent(html)만 반환
 *
 * Query params:
 * - id: 시나리오 ID (필수)
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json<ScenarioCommentaryError>(
        { detail: "scenarioCommentary failed: id가 필요합니다." },
        { status: 400 },
      );
    }

    const scenario = await prisma.scenario.findUnique({
      where: { id },
      select: {
        status: true,
        commentaryContent: true,
      },
    });

    if (!scenario) {
      return NextResponse.json<ScenarioCommentaryError>(
        { detail: "scenarioCommentary failed: 시나리오를 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    if (scenario.status !== "PUBLISHED") {
      return NextResponse.json<ScenarioCommentaryError>(
        { detail: "scenarioCommentary failed: 배포된 시나리오만 조회할 수 있습니다." },
        { status: 403 },
      );
    }

    const commentary = scenario.commentaryContent as { html: string } | null;
    if (!commentary?.html) {
      return NextResponse.json<ScenarioCommentaryError>(
        { detail: "scenarioCommentary failed: 해설이 없습니다." },
        { status: 404 },
      );
    }

    return NextResponse.json<ScenarioCommentaryResponse>({ html: commentary.html });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`scenario-commentary GET failed: ${msg}`, {
      source: "api/scenario-commentary",
      stackTrace: err instanceof Error ? err.stack : undefined,
      metadata: { id: new URL(req.url).searchParams.get("id") },
    });
    return NextResponse.json<ScenarioCommentaryError>(
      { detail: `scenarioCommentary failed: ${msg}` },
      { status: 500 },
    );
  }
}
