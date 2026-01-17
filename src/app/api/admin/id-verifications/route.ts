import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

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

export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const items = await prisma.studentIdVerification.findMany({
    orderBy: { submittedAt: "desc" },
    include: {
      user: { select: { displayName: true, studentNumber: true, email: true } },
      reviewer: { select: { displayName: true, email: true } },
    },
  });

  return NextResponse.json({ items });
}

export async function PATCH(req: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await req.json().catch(() => ({}));
  const id = typeof body?.id === "string" ? body.id : "";
  const statusRaw = typeof body?.status === "string" ? body.status : "";
  const status = statusRaw.toUpperCase();
  const rejectReason =
    typeof body?.rejectReason === "string" ? body.rejectReason.trim() : "";

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }
  if (status !== "APPROVED" && status !== "REJECTED") {
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
  }
  if (status === "REJECTED" && !rejectReason) {
    return NextResponse.json(
      { error: "rejectReason is required" },
      { status: 400 }
    );
  }

  const updated = await prisma.studentIdVerification.update({
    where: { id },
    data: {
      status,
      rejectReason: status === "REJECTED" ? rejectReason : null,
      reviewedBy: auth.user.id,
      reviewedAt: new Date(),
    },
    include: {
      user: { select: { displayName: true, studentNumber: true, email: true } },
      reviewer: { select: { displayName: true, email: true } },
    },
  });

  return NextResponse.json({ item: updated });
}
