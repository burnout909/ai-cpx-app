import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CaseStatus } from "@prisma/client";

export const runtime = "nodejs";

/**
 * GET: 시나리오 목록 조회 (주호소별 그룹핑 지원)
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const caseId = searchParams.get("caseId");
    const chiefComplaint = searchParams.get("chiefComplaint");
    const status = searchParams.get("status") as CaseStatus | null;
    const groupBy = searchParams.get("groupBy"); // "chiefComplaint"

    // 특정 케이스 조회
    if (caseId) {
      const caseData = await prisma.case.findUnique({
        where: { id: caseId },
      });

      if (!caseData) {
        return NextResponse.json({ error: "케이스를 찾을 수 없습니다." }, { status: 404 });
      }

      return NextResponse.json({ case: caseData });
    }

    // 필터 조건 구성
    const where: any = {};
    if (chiefComplaint) where.chiefComplaint = chiefComplaint;
    if (status) where.status = status;

    const cases = await prisma.case.findMany({
      where,
      orderBy: [{ chiefComplaint: "asc" }, { name: "asc" }],
    });

    // 주호소별 그룹핑
    if (groupBy === "chiefComplaint") {
      const grouped: Record<string, typeof cases> = {};
      const uncategorized: typeof cases = [];

      for (const c of cases) {
        const cc = c.chiefComplaint || "미분류";
        if (cc === "미분류") {
          uncategorized.push(c);
        } else {
          if (!grouped[cc]) grouped[cc] = [];
          grouped[cc].push(c);
        }
      }

      // 주호소 목록 (미분류 제외)
      const chiefComplaints = Object.keys(grouped).sort();

      return NextResponse.json({
        grouped,
        uncategorized,
        chiefComplaints,
        total: cases.length,
      });
    }

    return NextResponse.json({ cases });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `조회 실패: ${msg}` }, { status: 500 });
  }
}

/**
 * POST: 새 시나리오 케이스 생성
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      name,
      chiefComplaint,
      diagnosis,
      description,
      scenarioJson,
      checklistJson,
      solutionText,
      status = "DRAFT",
    } = body;

    if (!name) {
      return NextResponse.json({ error: "케이스 이름(name)이 필요합니다." }, { status: 400 });
    }

    const newCase = await prisma.case.create({
      data: {
        name,
        chiefComplaint,
        diagnosis,
        description,
        scenarioJson,
        checklistJson,
        solutionText,
        status: status as CaseStatus,
      },
    });

    return NextResponse.json({ success: true, case: newCase });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `생성 실패: ${msg}` }, { status: 500 });
  }
}

/**
 * PUT: 시나리오 케이스 수정
 */
export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const {
      caseId,
      name,
      chiefComplaint,
      diagnosis,
      description,
      scenarioJson,
      checklistJson,
      solutionText,
      status,
    } = body;

    if (!caseId) {
      return NextResponse.json({ error: "caseId가 필요합니다." }, { status: 400 });
    }

    const existingCase = await prisma.case.findUnique({ where: { id: caseId } });
    if (!existingCase) {
      return NextResponse.json({ error: "케이스를 찾을 수 없습니다." }, { status: 404 });
    }

    const updateData: any = { updatedAt: new Date() };
    if (name !== undefined) updateData.name = name;
    if (chiefComplaint !== undefined) updateData.chiefComplaint = chiefComplaint;
    if (diagnosis !== undefined) updateData.diagnosis = diagnosis;
    if (description !== undefined) updateData.description = description;
    if (scenarioJson !== undefined) updateData.scenarioJson = scenarioJson;
    if (checklistJson !== undefined) updateData.checklistJson = checklistJson;
    if (solutionText !== undefined) updateData.solutionText = solutionText;
    if (status !== undefined) updateData.status = status as CaseStatus;

    const updatedCase = await prisma.case.update({
      where: { id: caseId },
      data: updateData,
    });

    return NextResponse.json({ success: true, case: updatedCase });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `수정 실패: ${msg}` }, { status: 500 });
  }
}

/**
 * PATCH: 상태만 변경 (배포/수정 중 전환)
 */
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { caseId, status } = body;

    if (!caseId || !status) {
      return NextResponse.json({ error: "caseId와 status가 필요합니다." }, { status: 400 });
    }

    if (!["DRAFT", "PUBLISHED"].includes(status)) {
      return NextResponse.json({ error: "유효하지 않은 status입니다." }, { status: 400 });
    }

    const updatedCase = await prisma.case.update({
      where: { id: caseId },
      data: { status: status as CaseStatus, updatedAt: new Date() },
    });

    return NextResponse.json({ success: true, case: updatedCase });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `상태 변경 실패: ${msg}` }, { status: 500 });
  }
}

/**
 * DELETE: 시나리오 케이스 삭제
 */
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const caseId = searchParams.get("caseId");

    if (!caseId) {
      return NextResponse.json({ error: "caseId가 필요합니다." }, { status: 400 });
    }

    const existingCase = await prisma.case.findUnique({ where: { id: caseId } });
    if (!existingCase) {
      return NextResponse.json({ error: "케이스를 찾을 수 없습니다." }, { status: 404 });
    }

    // 연관된 세션이 있는지 확인
    const sessionCount = await prisma.cpxSession.count({
      where: { caseId },
    });

    if (sessionCount > 0) {
      return NextResponse.json(
        { error: `이 케이스에 ${sessionCount}개의 세션이 연결되어 있어 삭제할 수 없습니다.` },
        { status: 400 }
      );
    }

    await prisma.case.delete({ where: { id: caseId } });

    return NextResponse.json({ success: true, message: "케이스가 삭제되었습니다." });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `삭제 실패: ${msg}` }, { status: 500 });
  }
}
