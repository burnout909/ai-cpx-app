import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

async function requireUser() {
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

  return { userId: profile.id } as const;
}

export async function POST(req: Request) {
  const auth = await requireUser();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await req.json().catch(() => ({}));
  const content = typeof body?.content === "string" ? body.content.trim() : "";

  if (!content) {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }

  const title = typeof body?.title === "string" && body.title.trim()
    ? body.title.trim()
    : content.split("\n")[0].slice(0, 30) + (content.split("\n")[0].length > 30 ? "..." : "");

  const inquiry = await prisma.inquiry.create({
    data: { userId: auth.userId, title, content },
  });

  return NextResponse.json({ item: inquiry }, { status: 201 });
}

export async function GET() {
  const auth = await requireUser();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const [items, unreadCount] = await Promise.all([
    prisma.inquiry.findMany({
      where: { userId: auth.userId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.inquiry.count({
      where: { userId: auth.userId, status: "ANSWERED", readByUser: false },
    }),
  ]);

  return NextResponse.json({ items, hasUnread: unreadCount > 0 });
}

export async function PATCH(req: Request) {
  const auth = await requireUser();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await req.json().catch(() => ({}));
  const id = typeof body?.id === "string" ? body.id : "";

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const inquiry = await prisma.inquiry.findUnique({ where: { id } });
  if (!inquiry || inquiry.userId !== auth.userId) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const updated = await prisma.inquiry.update({
    where: { id },
    data: { readByUser: true },
  });

  return NextResponse.json({ item: updated });
}
