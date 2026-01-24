import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ScenarioStatus } from "@prisma/client";

export const runtime = "nodejs";

/**
 * GET: 시나리오 목록 조회 또는 단일 조회
 *
 * Query params:
 * - id: 특정 시나리오 조회
 * - chiefComplaint: 주호소 필터
 * - caseName: 케이스명 필터
 * - status: DRAFT | PUBLISHED | LEGACY
 * - includeAll: true면 LEGACY 포함
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const chiefComplaint = searchParams.get("chiefComplaint");
    const caseName = searchParams.get("caseName");
    const status = searchParams.get("status") as ScenarioStatus | null;
    const includeAll = searchParams.get("includeAll") === "true";

    // 단일 조회: 버전 히스토리 포함
    if (id) {
      const scenario = await prisma.scenario.findUnique({
        where: { id },
        include: {
          previousScenario: true,
          nextVersions: {
            orderBy: { versionNumber: "desc" },
          },
        },
      });

      if (!scenario) {
        return NextResponse.json(
          { error: "시나리오를 찾을 수 없습니다." },
          { status: 404 }
        );
      }

      // 버전 히스토리 조회 (같은 chiefComplaint + caseName)
      const versionHistory = await prisma.scenario.findMany({
        where: {
          chiefComplaint: scenario.chiefComplaint,
          caseName: scenario.caseName,
        },
        orderBy: { versionNumber: "desc" },
        select: {
          id: true,
          versionNumber: true,
          status: true,
          createdAt: true,
          publishedAt: true,
        },
      });

      return NextResponse.json({ scenario, versionHistory });
    }

    // 목록 조회: (주호소 + caseName) 그룹별 최신 레코드
    const where: Record<string, unknown> = {};
    if (chiefComplaint) where.chiefComplaint = chiefComplaint;
    if (caseName) where.caseName = caseName;
    if (status) {
      where.status = status;
    } else if (!includeAll) {
      where.status = { not: "LEGACY" as ScenarioStatus };
    }

    // 모든 시나리오 조회
    const allScenarios = await prisma.scenario.findMany({
      where,
      orderBy: [
        { chiefComplaint: "asc" },
        { caseName: "asc" },
        { versionNumber: "desc" },
      ],
    });

    // (chiefComplaint + caseName) 그룹별 최신 버전만 추출
    const groupMap = new Map<
      string,
      {
        latest: (typeof allScenarios)[0];
        totalVersions: number;
      }
    >();

    for (const scenario of allScenarios) {
      const key = `${scenario.chiefComplaint}::${scenario.caseName}`;
      const existing = groupMap.get(key);
      if (!existing) {
        groupMap.set(key, { latest: scenario, totalVersions: 1 });
      } else {
        existing.totalVersions += 1;
        // versionNumber가 더 높으면 latest 교체
        if (scenario.versionNumber > existing.latest.versionNumber) {
          existing.latest = scenario;
        }
      }
    }

    const scenarios = Array.from(groupMap.values()).map(
      ({ latest, totalVersions }) => ({
        ...latest,
        totalVersions,
      })
    );

    // 주호소별 그룹핑
    const grouped: Record<string, typeof scenarios> = {};
    for (const s of scenarios) {
      const cc = s.chiefComplaint || "미분류";
      if (!grouped[cc]) grouped[cc] = [];
      grouped[cc].push(s);
    }

    const chiefComplaints = Object.keys(grouped).filter((k) => k !== "미분류").sort();

    return NextResponse.json({
      scenarios,
      grouped,
      chiefComplaints,
      total: scenarios.length,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `조회 실패: ${msg}` }, { status: 500 });
  }
}

/**
 * POST: 새 시나리오 생성 또는 업데이트 (항상 새 레코드 생성)
 *
 * Body:
 * - chiefComplaint: 주호소
 * - caseName: 케이스명
 * - previousScenarioId?: 수정 시 이전 버전 참조
 * - scenarioContent?: 시나리오 JSON
 * - checklistIncludedMap?: 체크리스트 포함 맵
 * - commentaryContent?: 해설 JSON
 * - action: "draft" | "publish"
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      chiefComplaint,
      caseName,
      previousScenarioId,
      scenarioContent,
      checklistIncludedMap,
      commentaryContent,
      action = "draft",
    } = body;

    if (!chiefComplaint || !caseName) {
      return NextResponse.json(
        { error: "주호소와 케이스명이 필요합니다." },
        { status: 400 }
      );
    }

    // 배포 시 3종 필수 확인
    if (action === "publish") {
      if (!scenarioContent) {
        return NextResponse.json(
          { error: "배포하려면 시나리오가 필요합니다." },
          { status: 400 }
        );
      }
      if (!checklistIncludedMap) {
        return NextResponse.json(
          { error: "배포하려면 체크리스트 확정이 필요합니다." },
          { status: 400 }
        );
      }
      if (!commentaryContent) {
        return NextResponse.json(
          { error: "배포하려면 해설이 필요합니다." },
          { status: 400 }
        );
      }
    }

    // 이전 버전 조회 (수정인 경우)
    let previousScenario = null;
    let versionNumber = 0.1;
    let checklistSourceVersionId: string | null = null;
    let checklistItemsSnapshot: unknown = null;

    // 버전 0.1씩 증가 (부동소수점 오차 방지를 위해 반올림)
    const incrementVersion = (v: number) => Math.round((v + 0.1) * 10) / 10;

    if (previousScenarioId) {
      previousScenario = await prisma.scenario.findUnique({
        where: { id: previousScenarioId },
      });
      if (!previousScenario) {
        return NextResponse.json(
          { error: "이전 버전을 찾을 수 없습니다." },
          { status: 404 }
        );
      }
      versionNumber = incrementVersion(previousScenario.versionNumber);
      // 이전 체크리스트 스냅샷 계승
      checklistSourceVersionId = previousScenario.checklistSourceVersionId;
      checklistItemsSnapshot = previousScenario.checklistItemsSnapshot;
    } else {
      // 첫 생성: EvidenceChecklist 최신 버전 로드
      const latestChecklist = await prisma.evidenceChecklist.findFirst({
        where: { chiefComplaint },
        orderBy: { createdAt: "desc" },
      });

      if (latestChecklist) {
        checklistSourceVersionId = latestChecklist.id;
        checklistItemsSnapshot = latestChecklist.checklistJson;
      }

      // 같은 chiefComplaint + caseName의 기존 버전 확인
      const existingLatest = await prisma.scenario.findFirst({
        where: { chiefComplaint, caseName },
        orderBy: { versionNumber: "desc" },
      });
      if (existingLatest) {
        versionNumber = incrementVersion(existingLatest.versionNumber);
        // 기존 체크리스트 스냅샷 계승
        if (!checklistItemsSnapshot && existingLatest.checklistItemsSnapshot) {
          checklistSourceVersionId = existingLatest.checklistSourceVersionId;
          checklistItemsSnapshot = existingLatest.checklistItemsSnapshot;
        }
      }
    }

    const status: ScenarioStatus = action === "publish" ? "PUBLISHED" : "DRAFT";

    // 배포 시 기존 PUBLISHED → LEGACY 전환
    if (action === "publish") {
      await prisma.scenario.updateMany({
        where: {
          chiefComplaint,
          caseName,
          status: "PUBLISHED",
        },
        data: {
          status: "LEGACY",
        },
      });
    }

    // 새 시나리오 생성
    const newScenario = await prisma.scenario.create({
      data: {
        chiefComplaint,
        caseName,
        previousScenarioId: previousScenarioId || null,
        versionNumber,
        status,
        publishedAt: action === "publish" ? new Date() : null,
        scenarioContent: scenarioContent || null,
        checklistSourceVersionId,
        checklistItemsSnapshot: checklistItemsSnapshot ?? undefined,
        checklistIncludedMap: checklistIncludedMap || null,
        checklistConfirmedAt: checklistIncludedMap ? new Date() : null,
        commentaryContent: commentaryContent || null,
        commentaryUpdatedAt: commentaryContent ? new Date() : null,
      },
    });

    return NextResponse.json({ success: true, scenario: newScenario });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `생성 실패: ${msg}` }, { status: 500 });
  }
}

/**
 * PATCH: 시나리오 수정 (DRAFT만 수정 가능, 기존 레코드 업데이트)
 * 중요: PUBLISHED/LEGACY는 수정 불가, 새 버전으로 생성해야 함
 */
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const {
      id,
      scenarioContent,
      checklistIncludedMap,
      commentaryContent,
      action,
    } = body;

    if (!id) {
      return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });
    }

    const existing = await prisma.scenario.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "시나리오를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // DRAFT만 수정 가능
    if (existing.status !== "DRAFT") {
      return NextResponse.json(
        { error: "PUBLISHED 또는 LEGACY 시나리오는 수정할 수 없습니다. 새 버전을 생성하세요." },
        { status: 400 }
      );
    }

    // 배포 시 3종 필수 확인
    const finalScenarioContent = scenarioContent ?? existing.scenarioContent;
    const finalChecklistMap = checklistIncludedMap ?? existing.checklistIncludedMap;
    const finalCommentary = commentaryContent ?? existing.commentaryContent;

    if (action === "publish") {
      if (!finalScenarioContent) {
        return NextResponse.json(
          { error: "배포하려면 시나리오가 필요합니다." },
          { status: 400 }
        );
      }
      if (!finalChecklistMap) {
        return NextResponse.json(
          { error: "배포하려면 체크리스트 확정이 필요합니다." },
          { status: 400 }
        );
      }
      if (!finalCommentary) {
        return NextResponse.json(
          { error: "배포하려면 해설이 필요합니다." },
          { status: 400 }
        );
      }
    }

    // 배포 시 기존 PUBLISHED → LEGACY 전환
    if (action === "publish") {
      await prisma.scenario.updateMany({
        where: {
          chiefComplaint: existing.chiefComplaint,
          caseName: existing.caseName,
          status: "PUBLISHED",
          id: { not: id },
        },
        data: {
          status: "LEGACY",
        },
      });
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (scenarioContent !== undefined) {
      updateData.scenarioContent = scenarioContent;
    }
    if (checklistIncludedMap !== undefined) {
      updateData.checklistIncludedMap = checklistIncludedMap;
      updateData.checklistConfirmedAt = new Date();
    }
    if (commentaryContent !== undefined) {
      updateData.commentaryContent = commentaryContent;
      updateData.commentaryUpdatedAt = new Date();
    }
    if (action === "publish") {
      updateData.status = "PUBLISHED";
      updateData.publishedAt = new Date();
    }

    const updated = await prisma.scenario.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ success: true, scenario: updated });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `수정 실패: ${msg}` }, { status: 500 });
  }
}

/**
 * DELETE: 시나리오 삭제 (DRAFT만 삭제 허용)
 */
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "id가 필요합니다." }, { status: 400 });
    }

    const existing = await prisma.scenario.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "시나리오를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    if (existing.status !== "DRAFT") {
      return NextResponse.json(
        { error: "PUBLISHED 또는 LEGACY 시나리오는 삭제할 수 없습니다." },
        { status: 400 }
      );
    }

    await prisma.scenario.delete({ where: { id } });

    return NextResponse.json({
      success: true,
      message: "시나리오가 삭제되었습니다.",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `삭제 실패: ${msg}` }, { status: 500 });
  }
}
