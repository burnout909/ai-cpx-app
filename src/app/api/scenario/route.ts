import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { generateDownloadUrl } from "@/app/api/s3/s3";

export const runtime = "nodejs";

const BUCKET = process.env.NEXT_PUBLIC_S3_BUCKET_NAME!;

/**
 * Public GET: 배포된 시나리오 조회 (인증 불필요)
 *
 * Query params:
 * - id: 특정 시나리오 조회 (scenarioContent + rolePromptSnapshot + patientImage)
 * - status: PUBLISHED (목록 조회 시)
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const status = searchParams.get("status");

    // 단일 시나리오 조회
    if (id) {
      const scenario = await prisma.scenario.findUnique({
        where: { id, status: "PUBLISHED" },
        select: {
          id: true,
          chiefComplaint: true,
          caseName: true,
          versionNumber: true,
          scenarioContent: true,
          rolePromptSnapshot: true,
          activeImageId: true,
        },
      });

      if (!scenario) {
        return NextResponse.json(
          { error: "시나리오를 찾을 수 없습니다." },
          { status: 404 }
        );
      }

      // 환자 이미지 URL 조회
      let patientImageUrl: string | null = null;
      if (scenario.activeImageId) {
        const img = await prisma.patientImage.findUnique({
          where: { id: scenario.activeImageId },
          select: { s3Key: true },
        });
        if (img) {
          patientImageUrl = await generateDownloadUrl(BUCKET, img.s3Key);
        }
      }

      return NextResponse.json({
        scenario: {
          id: scenario.id,
          chiefComplaint: scenario.chiefComplaint,
          caseName: scenario.caseName,
          versionNumber: scenario.versionNumber,
          scenarioContent: scenario.scenarioContent,
          rolePromptSnapshot: scenario.rolePromptSnapshot,
        },
        patientImageUrl,
      });
    }

    // 목록 조회: PUBLISHED만
    if (status !== "PUBLISHED") {
      return NextResponse.json(
        { error: "status=PUBLISHED 파라미터가 필요합니다." },
        { status: 400 }
      );
    }

    const scenarios = await prisma.scenario.findMany({
      where: { status: "PUBLISHED" },
      select: {
        id: true,
        chiefComplaint: true,
        caseName: true,
        versionNumber: true,
      },
      orderBy: [{ chiefComplaint: "asc" }, { caseName: "asc" }],
    });

    return NextResponse.json({ scenarios });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const { searchParams } = new URL(req.url);
    logger.error(`scenario GET failed: ${msg}`, {
      source: "api/scenario GET",
      stackTrace: err instanceof Error ? err.stack : undefined,
      metadata: { id: searchParams.get("id"), status: searchParams.get("status") },
    });
    return NextResponse.json({ error: `조회 실패: ${msg}` }, { status: 500 });
  }
}
