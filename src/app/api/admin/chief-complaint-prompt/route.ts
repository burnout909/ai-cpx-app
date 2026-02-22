import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { CCPromptType } from "@prisma/client";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

async function requireAdmin() {
  const cookieStore = await cookies();
  const adminAccess = cookieStore.get("admin_access")?.value;
  if (adminAccess !== "1") {
    return { error: "forbidden", status: 403 } as const;
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { error: "unauthorized", status: 401 } as const;
  }

  return { user } as const;
}

function incrementVersion(version: string): string {
  const num = parseFloat(version);
  return (num + 0.1).toFixed(1);
}

/**
 * GET: 주호소별 프롬프트 조회
 * - ?chiefComplaint=X&type=ROLE|COMMENTARY → 해당 주호소+타입의 모든 버전 (최신순)
 * - ?chiefComplaint=X (type 없음) → 해당 주호소의 ROLE/COMMENTARY 각각 최신 버전
 * - 파라미터 없으면 → 모든 주호소의 최신 버전 목록
 */
export async function GET(req: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(req.url);
    const chiefComplaint = searchParams.get("chiefComplaint");
    const typeParam = searchParams.get("type") as CCPromptType | null;

    if (chiefComplaint && typeParam) {
      // 특정 주호소 + 특정 타입의 모든 버전
      const prompts = await prisma.chiefComplaintPrompt.findMany({
        where: { chiefComplaint, type: typeParam },
        orderBy: { createdAt: "desc" },
      });

      return NextResponse.json({
        chiefComplaint,
        type: typeParam,
        latestVersion: prompts[0] || null,
        versions: prompts,
      });
    }

    if (chiefComplaint) {
      // 특정 주호소의 ROLE/COMMENTARY 최신 각각
      const [roleVersions, commentaryVersions] = await Promise.all([
        prisma.chiefComplaintPrompt.findMany({
          where: { chiefComplaint, type: CCPromptType.ROLE },
          orderBy: { createdAt: "desc" },
        }),
        prisma.chiefComplaintPrompt.findMany({
          where: { chiefComplaint, type: CCPromptType.COMMENTARY },
          orderBy: { createdAt: "desc" },
        }),
      ]);

      return NextResponse.json({
        chiefComplaint,
        role: {
          latestVersion: roleVersions[0] || null,
          versions: roleVersions,
        },
        commentary: {
          latestVersion: commentaryVersions[0] || null,
          versions: commentaryVersions,
        },
      });
    }

    // 모든 주호소의 최신 버전 목록 (타입별)
    const allPrompts = await prisma.chiefComplaintPrompt.findMany({
      orderBy: { createdAt: "desc" },
    });

    // 주호소+타입별 최신 버전만 추출
    const latestByKey = new Map<string, typeof allPrompts[0]>();
    for (const p of allPrompts) {
      const key = `${p.chiefComplaint}::${p.type}`;
      if (!latestByKey.has(key)) {
        latestByKey.set(key, p);
      }
    }

    // 주호소별로 그룹핑
    const grouped = new Map<string, { role?: typeof allPrompts[0]; commentary?: typeof allPrompts[0] }>();
    for (const p of latestByKey.values()) {
      const existing = grouped.get(p.chiefComplaint) || {};
      if (p.type === CCPromptType.ROLE) existing.role = p;
      else existing.commentary = p;
      grouped.set(p.chiefComplaint, existing);
    }

    const prompts = Array.from(grouped.entries()).map(([cc, data]) => ({
      chiefComplaint: cc,
      roleVersion: data.role?.version || null,
      commentaryVersion: data.commentary?.version || null,
      roleUpdatedAt: data.role?.createdAt || null,
      commentaryUpdatedAt: data.commentary?.createdAt || null,
    }));

    return NextResponse.json({ prompts });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`chief-complaint-prompt GET failed: ${msg}`, {
      source: "api/admin/chief-complaint-prompt",
      stackTrace: err instanceof Error ? err.stack : undefined,
      metadata: { chiefComplaint: new URL(req.url).searchParams.get("chiefComplaint"), type: new URL(req.url).searchParams.get("type") },
    });
    return NextResponse.json({ error: `조회 실패: ${msg}` }, { status: 500 });
  }
}

/**
 * POST: 새 버전 저장
 * Body: { chiefComplaint, type: "ROLE"|"COMMENTARY", content }
 */
export async function POST(req: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await req.json();
    const { chiefComplaint, type, content } = body;

    if (!chiefComplaint) {
      return NextResponse.json(
        { error: "주호소가 필요합니다." },
        { status: 400 }
      );
    }

    if (!type || !["ROLE", "COMMENTARY"].includes(type)) {
      return NextResponse.json(
        { error: "type은 ROLE 또는 COMMENTARY여야 합니다." },
        { status: 400 }
      );
    }

    if (!content?.trim()) {
      return NextResponse.json(
        { error: "프롬프트 내용이 필요합니다." },
        { status: 400 }
      );
    }

    const promptType = type as CCPromptType;

    // 최신 버전 조회
    const latest = await prisma.chiefComplaintPrompt.findFirst({
      where: { chiefComplaint, type: promptType },
      orderBy: { createdAt: "desc" },
    });

    const newVersion = latest ? incrementVersion(latest.version) : "0.1";

    const created = await prisma.chiefComplaintPrompt.create({
      data: {
        chiefComplaint,
        type: promptType,
        version: newVersion,
        content,
      },
    });

    return NextResponse.json({ success: true, prompt: created });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`chief-complaint-prompt POST failed: ${msg}`, {
      source: "api/admin/chief-complaint-prompt",
      stackTrace: err instanceof Error ? err.stack : undefined,
      metadata: {},
    });
    return NextResponse.json({ error: `저장 실패: ${msg}` }, { status: 500 });
  }
}
