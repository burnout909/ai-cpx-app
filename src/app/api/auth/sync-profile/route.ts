import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function POST() {
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

  const displayName =
    (user.user_metadata?.name as string | undefined) ||
    (user.user_metadata?.full_name as string | undefined) ||
    null;
  const studentNumber =
    (user.user_metadata?.student_number as string | undefined) ||
    (user.user_metadata?.studentNumber as string | undefined) ||
    null;

  const profile = await prisma.profile.upsert({
    where: { id: user.id },
    update: {
      email: user.email ?? null,
      displayName,
      studentNumber,
    },
    create: {
      id: user.id,
      email: user.email ?? null,
      displayName,
      studentNumber,
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
}
