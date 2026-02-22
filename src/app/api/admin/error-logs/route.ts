import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

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

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const params = req.nextUrl.searchParams;

  // Single item lookup
  const id = params.get("id");
  if (id) {
    const item = await prisma.errorLog.findUnique({ where: { id } });
    if (!item) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    return NextResponse.json({ item });
  }

  // List with filters
  const level = params.get("level"); // WARN or ERROR
  const source = params.get("source");
  const startDate = params.get("startDate");
  const endDate = params.get("endDate");
  const page = Math.max(1, Number(params.get("page") ?? 1));
  const limit = Math.min(100, Math.max(1, Number(params.get("limit") ?? 20)));

  const where: Prisma.ErrorLogWhereInput = {
    level: level === "WARN" || level === "ERROR" ? level : { in: ["WARN", "ERROR"] },
    ...(source && { source: { contains: source, mode: "insensitive" as const } }),
    ...(startDate || endDate
      ? {
          createdAt: {
            ...(startDate && { gte: new Date(startDate) }),
            ...(endDate && { lte: new Date(endDate + "T23:59:59.999Z") }),
          },
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.errorLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.errorLog.count({ where }),
  ]);

  return NextResponse.json({
    items,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  });
}
