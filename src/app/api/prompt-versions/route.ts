import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { PromptType } from "@prisma/client";
import { logger } from "@/lib/logger";

const createSchema = z.object({
  type: z.nativeEnum(PromptType),
  version: z.string(),
  content: z.string(),
});

async function hasAdminAccess() {
  const cookieStore = await cookies();
  return cookieStore.get("admin_access")?.value === "1";
}

// GET: 특정 type의 프롬프트 버전 목록 조회
export async function GET(req: NextRequest) {
  if (!(await hasAdminAccess())) {
    return NextResponse.json(
      { error: "admin access required" },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") as PromptType | null;

  if (!type || !Object.values(PromptType).includes(type)) {
    return NextResponse.json(
      { error: "Invalid or missing type parameter" },
      { status: 400 }
    );
  }

  try {
    const versions = await prisma.promptVersion.findMany({
      where: { type },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ versions });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    logger.error(`prompt-versions GET failed: ${message}`, {
      source: "api/prompt-versions",
      stackTrace: error instanceof Error ? error.stack : undefined,
      metadata: { type },
    });
    return NextResponse.json(
      { error: "Failed to fetch prompt versions", details: message },
      { status: 500 }
    );
  }
}

// POST: 새 프롬프트 버전 저장
export async function POST(req: NextRequest) {
  if (!(await hasAdminAccess())) {
    return NextResponse.json(
      { error: "admin access required" },
      { status: 403 }
    );
  }

  const parsed = createSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.format() },
      { status: 400 }
    );
  }

  const { type, version, content } = parsed.data;

  try {
    // 이미 존재하는 버전인지 확인
    const existing = await prisma.promptVersion.findUnique({
      where: { type_version: { type, version } },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Version already exists" },
        { status: 409 }
      );
    }

    const created = await prisma.promptVersion.create({
      data: { type, version, content },
    });

    return NextResponse.json({ promptVersion: created }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    logger.error(`prompt-versions POST failed: ${message}`, {
      source: "api/prompt-versions",
      stackTrace: error instanceof Error ? error.stack : undefined,
      metadata: { type, version },
    });
    return NextResponse.json(
      { error: "Failed to create prompt version", details: message },
      { status: 500 }
    );
  }
}
