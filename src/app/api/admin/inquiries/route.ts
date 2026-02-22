import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

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

  const profile = await prisma.profile.findUnique({
    where: { id: user.id },
  });

  if (!profile) {
    return { error: "profile not found", status: 404 } as const;
  }

  return { user, profileId: profile.id } as const;
}

export async function GET() {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const [items, unansweredCount] = await Promise.all([
      prisma.inquiry.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          user: { select: { displayName: true, studentNumber: true, email: true } },
          answerer: { select: { displayName: true, email: true } },
        },
      }),
      prisma.inquiry.count({ where: { status: "PENDING" } }),
    ]);

    return NextResponse.json({ items, unansweredCount });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`admin inquiries GET failed: ${msg}`, {
      source: "api/admin/inquiries",
      stackTrace: err instanceof Error ? err.stack : undefined,
      metadata: {},
    });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const auth = await requireAdmin();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await req.json().catch(() => ({}));
    const id = typeof body?.id === "string" ? body.id : "";
    const answer = typeof body?.answer === "string" ? body.answer.trim() : "";

    if (!id || !answer) {
      return NextResponse.json({ error: "id and answer are required" }, { status: 400 });
    }

    const updated = await prisma.inquiry.update({
      where: { id },
      data: {
        answer,
        status: "ANSWERED",
        answeredBy: auth.profileId,
        answeredAt: new Date(),
        readByUser: false,
      },
      include: {
        user: { select: { displayName: true, studentNumber: true, email: true } },
        answerer: { select: { displayName: true, email: true } },
      },
    });

    return NextResponse.json({ item: updated });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`admin inquiries PATCH failed: ${msg}`, {
      source: "api/admin/inquiries",
      stackTrace: err instanceof Error ? err.stack : undefined,
      metadata: { id: typeof (err as any)?.id === "string" ? (err as any).id : undefined },
    });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
