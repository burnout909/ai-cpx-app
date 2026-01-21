import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseChecklistCsv, computeChecklistDiff, ChecklistJson } from "@/utils/checklistCsvParser";

export const runtime = "nodejs";

/**
 * GET: 케이스 목록 및 checklist_json 조회
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const caseId = searchParams.get("caseId");

    if (caseId) {
      // 특정 케이스 조회
      const caseData = await prisma.case.findUnique({
        where: { id: caseId },
        select: {
          id: true,
          name: true,
          diagnosis: true,
          description: true,
          checklistJson: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!caseData) {
        return NextResponse.json({ error: "케이스를 찾을 수 없습니다." }, { status: 404 });
      }

      return NextResponse.json({ case: caseData });
    }

    // 전체 케이스 목록 조회
    const cases = await prisma.case.findMany({
      select: {
        id: true,
        name: true,
        diagnosis: true,
        description: true,
        checklistJson: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json({ cases });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `조회 실패: ${msg}` }, { status: 500 });
  }
}

/**
 * POST: CSV 업로드 → JSON 변환 → 미리보기 또는 저장
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { csvText, caseName, caseId, action } = body as {
      csvText?: string;
      caseName?: string;
      caseId?: string;
      action: "preview" | "save";
    };

    if (!csvText) {
      return NextResponse.json({ error: "csvText가 필요합니다." }, { status: 400 });
    }

    // CSV 파싱
    const parseResult = parseChecklistCsv(csvText);

    if (!parseResult.success || !parseResult.data) {
      return NextResponse.json({
        success: false,
        errors: parseResult.errors,
        warnings: parseResult.warnings,
      }, { status: 400 });
    }

    // 기존 데이터 조회 (diff 계산용)
    let existingCase = null;
    if (caseId) {
      existingCase = await prisma.case.findUnique({
        where: { id: caseId },
        select: { id: true, name: true, checklistJson: true },
      });
    }

    const oldJson = existingCase?.checklistJson as ChecklistJson | null;
    const diff = computeChecklistDiff(oldJson, parseResult.data);

    if (action === "preview") {
      // 미리보기만 반환
      return NextResponse.json({
        success: true,
        parsed: parseResult.data,
        diff,
        warnings: parseResult.warnings,
        existingCase: existingCase ? { id: existingCase.id, name: existingCase.name } : null,
      });
    }

    // 저장
    if (!caseName && !caseId) {
      return NextResponse.json({ error: "케이스 이름(caseName) 또는 케이스 ID(caseId)가 필요합니다." }, { status: 400 });
    }

    let savedCase;
    if (caseId && existingCase) {
      // 기존 케이스 업데이트
      savedCase = await prisma.case.update({
        where: { id: caseId },
        data: {
          checklistJson: parseResult.data as any,
          updatedAt: new Date(),
        },
      });
    } else {
      // 새 케이스 생성
      savedCase = await prisma.case.create({
        data: {
          name: caseName!,
          checklistJson: parseResult.data as any,
        },
      });
    }

    return NextResponse.json({
      success: true,
      case: savedCase,
      warnings: parseResult.warnings,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `처리 실패: ${msg}` }, { status: 500 });
  }
}

/**
 * PUT: 체크리스트 직접 수정
 */
export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { caseId, checklistJson, name, diagnosis, description } = body as {
      caseId: string;
      checklistJson?: ChecklistJson;
      name?: string;
      diagnosis?: string;
      description?: string;
    };

    if (!caseId) {
      return NextResponse.json({ error: "caseId가 필요합니다." }, { status: 400 });
    }

    const existingCase = await prisma.case.findUnique({ where: { id: caseId } });
    if (!existingCase) {
      return NextResponse.json({ error: "케이스를 찾을 수 없습니다." }, { status: 404 });
    }

    const updateData: any = { updatedAt: new Date() };
    if (checklistJson) updateData.checklistJson = checklistJson;
    if (name !== undefined) updateData.name = name;
    if (diagnosis !== undefined) updateData.diagnosis = diagnosis;
    if (description !== undefined) updateData.description = description;

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
 * DELETE: 케이스 삭제
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

    await prisma.case.delete({ where: { id: caseId } });

    return NextResponse.json({ success: true, message: "케이스가 삭제되었습니다." });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `삭제 실패: ${msg}` }, { status: 500 });
  }
}
