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

  return { user } as const;
}

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await req.json().catch(() => ({}));
  const caseName =
    typeof body?.caseName === "string" ? body.caseName.trim() : "";
  if (!caseName) {
    return NextResponse.json({ error: "caseName is required" }, { status: 400 });
  }

  const diagnosis =
    typeof body?.diagnosis === "string" ? body.diagnosis.trim() : "";
  const description =
    typeof body?.description === "string" ? body.description.trim() : "";

  const data: Record<string, unknown> = {};
  if (diagnosis) data.diagnosis = diagnosis;
  if (description) data.description = description;
  if (body?.scenarioJson !== undefined) data.scenarioJson = body.scenarioJson;
  if (body?.checklistJson !== undefined) data.checklistJson = body.checklistJson;

  try {
    const existing = await prisma.case.findFirst({ where: { name: caseName } });

    if (!existing) {
      const created = await prisma.case.create({
        data: {
          name: caseName,
          ...(Object.keys(data).length > 0 ? data : {}),
        } as any,
      });
      return NextResponse.json({ case: created });
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ case: existing });
    }

    const updated = await prisma.case.update({
      where: { id: existing.id },
      data: data as any,
    });

    return NextResponse.json({ case: updated });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`admin/cases POST failed: ${msg}`, {
      source: "api/admin/cases",
      stackTrace: err instanceof Error ? err.stack : undefined,
      metadata: { caseName, diagnosis, description },
    });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
