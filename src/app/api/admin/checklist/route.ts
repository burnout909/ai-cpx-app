import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseChecklistCsv, computeChecklistDiff, ChecklistJson } from "@/utils/checklistCsvParser";

export const runtime = "nodejs";

/**
 * 버전 번호 증가 (0.1 -> 0.2 -> 0.3 ...)
 */
function incrementVersion(version: string): string {
  const num = parseFloat(version);
  return (num + 0.1).toFixed(1);
}

/**
 * GET: 체크리스트 조회
 * - chiefComplaint: 해당 주호소의 모든 버전 조회
 * - (없으면) 주호소별 최신 버전 목록 조회
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const chiefComplaint = searchParams.get("chiefComplaint");
    const id = searchParams.get("id");

    // ID로 특정 체크리스트 조회
    if (id) {
      const checklist = await prisma.evidenceChecklist.findUnique({
        where: { id },
      });

      if (!checklist) {
        return NextResponse.json({ error: "체크리스트를 찾을 수 없습니다." }, { status: 404 });
      }

      return NextResponse.json({
        checklistJson: checklist.checklistJson,
        version: checklist.version,
        chiefComplaint: checklist.chiefComplaint,
        createdAt: checklist.createdAt,
        id: checklist.id,
      });
    }

    // 특정 주호소의 모든 버전 조회
    if (chiefComplaint) {
      const checklists = await prisma.evidenceChecklist.findMany({
        where: { chiefComplaint },
        orderBy: { version: "desc" },
      });

      return NextResponse.json({
        chiefComplaint,
        versions: checklists.map((c) => ({
          id: c.id,
          version: c.version,
          checklistJson: c.checklistJson,
          createdAt: c.createdAt,
        })),
        latestVersion: checklists[0] || null,
      });
    }

    // 주호소별 최신 버전 목록 조회
    // 모든 체크리스트 조회 후 주호소별로 그룹화하여 최신 버전만 추출
    const allChecklists = await prisma.evidenceChecklist.findMany({
      orderBy: [{ chiefComplaint: "asc" }, { version: "desc" }],
    });

    // 주호소별로 그룹화 (첫 번째가 최신 버전)
    const byChiefComplaint = new Map<string, typeof allChecklists>();
    for (const checklist of allChecklists) {
      if (!byChiefComplaint.has(checklist.chiefComplaint)) {
        byChiefComplaint.set(checklist.chiefComplaint, []);
      }
      byChiefComplaint.get(checklist.chiefComplaint)!.push(checklist);
    }

    // 최신 버전 목록
    const latestVersions = Array.from(byChiefComplaint.entries()).map(([cc, versions]) => ({
      chiefComplaint: cc,
      latestVersion: versions[0].version,
      totalVersions: versions.length,
      checklistJson: versions[0].checklistJson,
      createdAt: versions[0].createdAt,
      id: versions[0].id,
    }));

    return NextResponse.json({ checklists: latestVersions });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `조회 실패: ${msg}` }, { status: 500 });
  }
}

/**
 * POST: CSV 업로드 → JSON 변환 → 미리보기 또는 새 버전으로 저장
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { csvText, chiefComplaint, action, checklistJson } = body as {
      csvText?: string;
      chiefComplaint?: string;
      action: "preview" | "save";
      checklistJson?: ChecklistJson; // 직접 저장할 체크리스트 (diff 선택 결과)
    };

    if (!chiefComplaint) {
      return NextResponse.json({ error: "chiefComplaint가 필요합니다." }, { status: 400 });
    }

    // 현재 최신 버전 조회
    const latestChecklist = await prisma.evidenceChecklist.findFirst({
      where: { chiefComplaint },
      orderBy: { version: "desc" },
    });

    const nextVersion = latestChecklist ? incrementVersion(latestChecklist.version) : "0.1";

    // 직접 checklistJson이 제공된 경우 (diff 선택 결과 저장)
    if (action === "save" && checklistJson) {
      const newChecklist = await prisma.evidenceChecklist.create({
        data: {
          chiefComplaint,
          version: nextVersion,
          checklistJson: checklistJson as any,
        },
      });

      return NextResponse.json({
        success: true,
        checklist: {
          id: newChecklist.id,
          chiefComplaint: newChecklist.chiefComplaint,
          version: newChecklist.version,
          checklistJson: newChecklist.checklistJson,
          createdAt: newChecklist.createdAt,
        },
      });
    }

    // CSV 파싱이 필요한 경우
    if (!csvText) {
      return NextResponse.json({ error: "csvText 또는 checklistJson이 필요합니다." }, { status: 400 });
    }

    const parseResult = parseChecklistCsv(csvText);

    if (!parseResult.success || !parseResult.data) {
      return NextResponse.json({
        success: false,
        errors: parseResult.errors,
        warnings: parseResult.warnings,
      }, { status: 400 });
    }

    const oldJson = latestChecklist?.checklistJson as ChecklistJson | null;
    const diff = computeChecklistDiff(oldJson, parseResult.data);

    if (action === "preview") {
      return NextResponse.json({
        success: true,
        parsed: parseResult.data,
        diff,
        warnings: parseResult.warnings,
        currentVersion: latestChecklist?.version || null,
        nextVersion,
        existingChecklist: oldJson,
      });
    }

    // CSV 파싱 결과로 새 버전 저장
    const newChecklist = await prisma.evidenceChecklist.create({
      data: {
        chiefComplaint,
        version: nextVersion,
        checklistJson: parseResult.data as any,
      },
    });

    return NextResponse.json({
      success: true,
      checklist: {
        id: newChecklist.id,
        chiefComplaint: newChecklist.chiefComplaint,
        version: newChecklist.version,
        checklistJson: newChecklist.checklistJson,
        createdAt: newChecklist.createdAt,
      },
      warnings: parseResult.warnings,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `처리 실패: ${msg}` }, { status: 500 });
  }
}

/**
 * DELETE: 특정 버전 삭제
 */
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const chiefComplaint = searchParams.get("chiefComplaint");

    // ID로 삭제
    if (id) {
      const existing = await prisma.evidenceChecklist.findUnique({ where: { id } });
      if (!existing) {
        return NextResponse.json({ error: "체크리스트를 찾을 수 없습니다." }, { status: 404 });
      }

      await prisma.evidenceChecklist.delete({ where: { id } });
      return NextResponse.json({ success: true, message: "삭제되었습니다." });
    }

    // 주호소의 모든 버전 삭제
    if (chiefComplaint) {
      await prisma.evidenceChecklist.deleteMany({ where: { chiefComplaint } });
      return NextResponse.json({ success: true, message: `${chiefComplaint}의 모든 버전이 삭제되었습니다.` });
    }

    return NextResponse.json({ error: "id 또는 chiefComplaint가 필요합니다." }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `삭제 실패: ${msg}` }, { status: 500 });
  }
}
