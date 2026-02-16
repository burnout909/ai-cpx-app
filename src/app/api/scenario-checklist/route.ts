import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { EvidenceModule } from "@/utils/loadChecklist";

export const runtime = "nodejs";

export interface ScenarioChecklistResponse {
  checklist: EvidenceModule;
}

export interface ScenarioChecklistError {
  detail: string;
}

/**
 * GET: PUBLISHED 시나리오의 checklistItemsSnapshot을 checklistIncludedMap으로 필터링하여 반환
 *
 * Query params:
 * - id: 시나리오 ID (필수)
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json<ScenarioChecklistError>(
        { detail: "scenario-checklist failed: id가 필요합니다." },
        { status: 400 },
      );
    }

    const scenario = await prisma.scenario.findUnique({
      where: { id },
      select: {
        status: true,
        checklistItemsSnapshot: true,
        checklistIncludedMap: true,
      },
    });

    if (!scenario) {
      return NextResponse.json<ScenarioChecklistError>(
        { detail: "scenario-checklist failed: 시나리오를 찾을 수 없습니다." },
        { status: 404 },
      );
    }

    if (scenario.status !== "PUBLISHED") {
      return NextResponse.json<ScenarioChecklistError>(
        { detail: "scenario-checklist failed: 배포된 시나리오만 조회할 수 있습니다." },
        { status: 403 },
      );
    }

    const snapshot = scenario.checklistItemsSnapshot as EvidenceModule | null;
    if (!snapshot) {
      return NextResponse.json<ScenarioChecklistError>(
        { detail: "scenario-checklist failed: 체크리스트 스냅샷이 없습니다." },
        { status: 404 },
      );
    }

    // checklistIncludedMap: Record<itemId, boolean> — false인 항목 제외
    const includedMap = (scenario.checklistIncludedMap ?? {}) as Record<string, boolean>;

    const filterItems = <T extends { id: string }>(items: T[] | undefined): T[] => {
      if (!items) return [];
      return items.filter((item) => includedMap[item.id] !== false);
    };

    // 스냅샷이 DB 키(HistoryEvidenceChecklist) 또는 UI 키(history)로 저장되어 있을 수 있음
    const raw = snapshot as unknown as Record<string, EvidenceModule[keyof EvidenceModule]>;
    const filtered: EvidenceModule = {
      HistoryEvidenceChecklist: filterItems(raw.HistoryEvidenceChecklist || raw.history),
      PhysicalexamEvidenceChecklist: filterItems(raw.PhysicalexamEvidenceChecklist || raw.physicalExam),
      EducationEvidenceChecklist: filterItems(raw.EducationEvidenceChecklist || raw.education),
      PpiEvidenceChecklist: filterItems(raw.PpiEvidenceChecklist || raw.ppi),
    };

    return NextResponse.json<ScenarioChecklistResponse>({ checklist: filtered });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json<ScenarioChecklistError>(
      { detail: `scenario-checklist failed: ${msg}` },
      { status: 500 },
    );
  }
}
