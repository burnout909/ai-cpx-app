import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CpxOrigin, SessionStatus, TranscriptSource, UploadType } from "@prisma/client";

type MetadataType = "audio" | "transcript" | "feedback" | "score";

function parseOrigin(value: unknown): CpxOrigin | null {
  if (value === "VP" || value === "SP") return value;
  return null;
}

function parseTranscriptSource(value: unknown): TranscriptSource | null {
  if (value === "LIVE" || value === "UPLOAD") return value;
  return null;
}

function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim().length > 0) {
    const num = Number(value);
    if (Number.isFinite(num)) return num;
  }
  return null;
}

async function hasAdminAccess() {
  const cookieStore = await cookies();
  return cookieStore.get("admin_access")?.value === "1";
}

async function resolveCase({
  caseName,
  diagnosis,
  scenarioJson,
  checklistJson,
}: {
  caseName: string;
  diagnosis?: unknown;
  scenarioJson?: unknown;
  checklistJson?: unknown;
}) {
  if (!caseName) return null;
  const existing = await prisma.case.findFirst({ where: { name: caseName } });
  if (!existing) {
    return await prisma.case.create({
      data: {
        name: caseName,
        ...(typeof diagnosis === "string" && diagnosis.trim()
          ? { diagnosis: diagnosis.trim() }
          : {}),
        ...(scenarioJson !== undefined ? { scenarioJson } : {}),
        ...(checklistJson !== undefined ? { checklistJson } : {}),
      } as any,
    });
  }

  const updateData: Record<string, unknown> = {};
  if (typeof diagnosis === "string" && diagnosis.trim()) {
    updateData.diagnosis = diagnosis.trim();
  }
  if (scenarioJson !== undefined) updateData.scenarioJson = scenarioJson;
  if (checklistJson !== undefined) updateData.checklistJson = checklistJson;
  if (Object.keys(updateData).length === 0) return existing;

  return await prisma.case.update({
    where: { id: existing.id },
    data: updateData as any,
  });
}

export async function POST(req: Request) {
  try {
    const adminAccess = await hasAdminAccess();
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const payload = await req.json().catch(() => ({}));
    const type = payload?.type as MetadataType | undefined;
    const s3Key = typeof payload?.s3Key === "string" ? payload.s3Key.trim() : "";
    const rawCaseName =
      typeof payload?.caseName === "string" ? payload.caseName.trim() : "";

    const validTypes: MetadataType[] = [
      "audio",
      "transcript",
      "feedback",
      "score",
    ];
    if (!type || !validTypes.includes(type) || !s3Key) {
      return NextResponse.json(
        { error: "type (audio/transcript/feedback/score) and s3Key are required" },
        { status: 400 }
      );
    }

    const origin = parseOrigin(payload?.origin);
    const requestedSessionId =
      typeof payload?.sessionId === "string" ? payload.sessionId.trim() : "";

    let session =
      requestedSessionId.length > 0
        ? await prisma.cpxSession.findFirst({
            where: { id: requestedSessionId, userId: user.id },
          })
        : null;

    if (requestedSessionId && !session) {
      return NextResponse.json(
        { error: "session not found" },
        { status: 404 }
      );
    }

    const caseRecord = await resolveCase({
      caseName: rawCaseName,
      diagnosis: adminAccess ? payload?.diagnosis : undefined,
      scenarioJson: adminAccess ? payload?.scenarioJson : undefined,
      checklistJson: adminAccess ? payload?.checklistJson : undefined,
    });

    if (!session) {
      if (!origin) {
        return NextResponse.json(
          { error: "origin is required when creating a session" },
          { status: 400 }
        );
      }
      session = await prisma.cpxSession.create({
        data: {
          userId: user.id,
          caseId: caseRecord?.id ?? null,
          origin,
          status: SessionStatus.IN_PROGRESS,
        },
      });
    } else if (!session.caseId && caseRecord?.id) {
      session = await prisma.cpxSession.update({
        where: { id: session.id },
        data: { caseId: caseRecord.id },
      });
    }

    const sessionId = session.id;
    const sessionOrigin = origin ?? session.origin ?? CpxOrigin.SP;

    let recordId: string | null = null;

    if (type === "audio") {
      const data: any = {
        userId: user.id,
        sessionId,
        caseId: session.caseId ?? caseRecord?.id ?? null,
        origin: sessionOrigin,
        type: UploadType.AUDIO,
        s3Key,
      };
      const fileName =
        typeof payload?.fileName === "string" ? payload.fileName.trim() : "";
      const contentType =
        typeof payload?.contentType === "string"
          ? payload.contentType.trim()
          : "";
      const sizeBytes = parseNumber(payload?.sizeBytes);

      if (fileName) data.fileName = fileName;
      if (contentType) data.contentType = contentType;
      if (sizeBytes !== null) data.sizeBytes = Math.round(sizeBytes);

      const existing = await prisma.upload.findFirst({
        where: { userId: user.id, s3Key },
      });
      const saved = existing
        ? await prisma.upload.update({
            where: { id: existing.id },
            data,
          })
        : await prisma.upload.create({ data });
      recordId = saved.id;
    } else if (type === "transcript") {
      const data: any = {
        userId: user.id,
        sessionId,
        origin: sessionOrigin,
        s3Key,
        source:
          parseTranscriptSource(payload?.source) ?? TranscriptSource.UPLOAD,
      };
      const language =
        typeof payload?.language === "string" ? payload.language.trim() : "";
      const durationSec = parseNumber(payload?.durationSec);
      const textExcerpt =
        typeof payload?.textExcerpt === "string"
          ? payload.textExcerpt.trim()
          : "";
      const sizeBytes = parseNumber(payload?.sizeBytes);
      const textLength = parseNumber(payload?.textLength);
      const tokenCount = parseNumber(payload?.tokenCount);

      if (language) data.language = language;
      if (durationSec !== null) data.durationSec = Math.round(durationSec);
      if (textExcerpt) data.textExcerpt = textExcerpt;
      if (sizeBytes !== null) data.sizeBytes = Math.round(sizeBytes);
      if (textLength !== null) data.textLength = Math.round(textLength);
      if (tokenCount !== null) data.tokenCount = Math.round(tokenCount);

      const existing = await prisma.transcript.findFirst({
        where: { userId: user.id, s3Key },
      });
      const saved = existing
        ? await prisma.transcript.update({
            where: { id: existing.id },
            data,
          })
        : await prisma.transcript.create({ data });
      recordId = saved.id;
    } else if (type === "feedback") {
      const data: any = {
        userId: user.id,
        sessionId,
        origin: sessionOrigin,
        s3Key,
      };
      const model =
        typeof payload?.model === "string" ? payload.model.trim() : "";
      const sizeBytes = parseNumber(payload?.sizeBytes);
      const textLength = parseNumber(payload?.textLength);
      const tokenCount = parseNumber(payload?.tokenCount);

      if (model) data.model = model;
      if (sizeBytes !== null) data.sizeBytes = Math.round(sizeBytes);
      if (textLength !== null) data.textLength = Math.round(textLength);
      if (tokenCount !== null) data.tokenCount = Math.round(tokenCount);

      const existing = await prisma.feedback.findFirst({
        where: { userId: user.id, s3Key },
      });
      const saved = existing
        ? await prisma.feedback.update({
            where: { id: existing.id },
            data,
          })
        : await prisma.feedback.create({ data });
      recordId = saved.id;
    } else if (type === "score") {
      const data: any = {
        userId: user.id,
        sessionId,
        origin: sessionOrigin,
        s3Key,
      };
      const total = parseNumber(payload?.total);
      const sizeBytes = parseNumber(payload?.sizeBytes);
      const textLength = parseNumber(payload?.textLength);
      const tokenCount = parseNumber(payload?.tokenCount);

      if (total !== null) data.total = total;
      if (sizeBytes !== null) data.sizeBytes = Math.round(sizeBytes);
      if (textLength !== null) data.textLength = Math.round(textLength);
      if (tokenCount !== null) data.tokenCount = Math.round(tokenCount);
      if (payload?.dataJson !== undefined) data.dataJson = payload.dataJson;

      const existing = await prisma.score.findFirst({
        where: { userId: user.id, s3Key },
      });
      const saved = existing
        ? await prisma.score.update({
            where: { id: existing.id },
            data,
          })
        : await prisma.score.create({ data });
      recordId = saved.id;
    }

    if (type === "score" || type === "feedback") {
      if (session.status !== SessionStatus.COMPLETED) {
        await prisma.cpxSession.update({
          where: { id: sessionId },
          data: {
            status: SessionStatus.COMPLETED,
            endedAt: new Date(),
          },
        });
      }
    }

    return NextResponse.json({
      ok: true,
      sessionId,
      recordId,
    });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { error: err?.message || "failed to save metadata" },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  try {
    const adminAccess = await hasAdminAccess();
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limitRaw = parseNumber(searchParams.get("limit"));
    const limit = Math.min(Math.max(limitRaw ?? 20, 1), 100);
    const origin = parseOrigin(searchParams.get("origin"));
    const caseName =
      typeof searchParams.get("caseName") === "string"
        ? (searchParams.get("caseName") || "").trim()
        : "";
    const sessionId =
      typeof searchParams.get("sessionId") === "string"
        ? (searchParams.get("sessionId") || "").trim()
        : "";
    const statusRaw =
      typeof searchParams.get("status") === "string"
        ? (searchParams.get("status") || "").trim()
        : "";

    const chiefComplaint =
      typeof searchParams.get("chiefComplaint") === "string"
        ? (searchParams.get("chiefComplaint") || "").trim()
        : "";

    const where: any = { userId: user.id };
    if (origin) where.origin = origin;

    const caseFilter: Record<string, unknown> = {};
    if (caseName) caseFilter.name = caseName;
    if (chiefComplaint) caseFilter.chiefComplaint = chiefComplaint;
    if (Object.keys(caseFilter).length > 0) where.case = caseFilter;

    if (sessionId) where.id = sessionId;
    if (statusRaw && Object.values(SessionStatus).includes(statusRaw as any)) {
      where.status = statusRaw as SessionStatus;
    }

    const sessions = await prisma.cpxSession.findMany({
      where,
      take: limit,
      orderBy: { startedAt: "desc" },
      include: {
        case: adminAccess
          ? true
          : {
              select: {
                id: true,
                name: true,
                chiefComplaint: true,
                description: true,
              },
            },
        uploads: { orderBy: { createdAt: "desc" } },
        transcripts: { orderBy: { createdAt: "desc" } },
        feedbacks: { orderBy: { createdAt: "desc" } },
        scores: { orderBy: { createdAt: "desc" } },
      },
    });

    return NextResponse.json({ sessions });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { error: err?.message || "failed to load metadata" },
      { status: 500 }
    );
  }
}
