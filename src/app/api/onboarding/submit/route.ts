import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
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

  const body = await req.json().catch(() => ({}));
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const studentNumber =
    typeof body?.studentNumber === "string" ? body.studentNumber.trim() : "";
  const s3Key = typeof body?.s3Key === "string" ? body.s3Key.trim() : "";

  if (!name || !studentNumber || !s3Key) {
    return NextResponse.json(
      { error: "name, studentNumber, s3Key are required" },
      { status: 400 }
    );
  }

  await prisma.profile.upsert({
    where: { id: user.id },
    update: {
      displayName: name,
      studentNumber,
    },
    create: {
      id: user.id,
      email: user.email ?? null,
      displayName: name,
      studentNumber,
    },
  });

  await prisma.studentIdVerification.create({
    data: {
      userId: user.id,
      s3Key,
    },
  });

  return NextResponse.json({ ok: true });
}
