import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export async function POST() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const profile = await prisma.profile.upsert({
      where: { id: user.id },
      update: {
        email: user.email ?? null,
      },
      create: {
        id: user.id,
        email: user.email ?? null,
      },
    });

    const verification = await prisma.studentIdVerification.findFirst({
      where: { userId: user.id },
      orderBy: { submittedAt: "desc" },
      select: { status: true },
    });

    if (!profile.displayName || !profile.studentNumber || !verification) {
      return NextResponse.json({ ok: true, status: "missing" });
    }

    return NextResponse.json({
      ok: true,
      status: verification.status.toLowerCase(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`auth/sync-profile POST failed: ${msg}`, {
      source: "api/auth/sync-profile",
      stackTrace: err instanceof Error ? err.stack : undefined,
      metadata: {},
    });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
