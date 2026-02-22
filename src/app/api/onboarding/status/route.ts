import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export async function GET() {
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

    const profile = await prisma.profile.findUnique({
      where: { id: user.id },
      select: { displayName: true, studentNumber: true },
    });

    const verification = await prisma.studentIdVerification.findFirst({
      where: { userId: user.id },
      orderBy: { submittedAt: "desc" },
    });

    if (!profile?.displayName || !profile?.studentNumber) {
      return NextResponse.json({ status: "missing" });
    }

    if (!verification) {
      return NextResponse.json({ status: "missing" });
    }

    const status = verification.status.toLowerCase();

    if (status === "rejected") {
      return NextResponse.json({
        status,
        rejectReason: verification.rejectReason ?? null,
      });
    }

    return NextResponse.json({ status });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.error("Onboarding status check failed", {
      source: "api/onboarding/status",
      stackTrace: e instanceof Error ? e.stack : undefined,
      metadata: {},
    });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
