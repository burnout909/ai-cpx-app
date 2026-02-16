import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { ScenarioStatus } from "@prisma/client";

export const runtime = "nodejs";

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
  const auth = await requireAdmin();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

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
          createdBy: {
            select: {
              id: true,
              displayName: true,
              email: true,
              users: { select: { raw_user_meta_data: true } },
            },
          },
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

    // 목록 조회: (주호소 + caseName) 그룹별 모든 버전 반환 (LEGACY 포함)
    const where: Record<string, unknown> = {};
    if (chiefComplaint) where.chiefComplaint = chiefComplaint;
    if (caseName) where.caseName = caseName;
    if (status) {
      where.status = status;
    }
    // LEGACY도 항상 포함 (토글에서 표시)

    // 모든 시나리오 조회
    const allScenarios = await prisma.scenario.findMany({
      where,
      include: {
        createdBy: {
            select: {
              id: true,
              displayName: true,
              email: true,
              users: { select: { raw_user_meta_data: true } },
            },
          },
      },
      orderBy: [
        { chiefComplaint: "asc" },
        { caseName: "asc" },
        { versionNumber: "desc" },
      ],
    });

    // (chiefComplaint + caseName) 그룹별로 모든 버전 수집
    const groupMap = new Map<
      string,
      {
        primary: (typeof allScenarios)[0]; // PUBLISHED가 있으면 PUBLISHED, 없으면 최고 버전
        versions: (typeof allScenarios)[0][];
      }
    >();

    for (const scenario of allScenarios) {
      const key = `${scenario.chiefComplaint}::${scenario.caseName}`;
      const existing = groupMap.get(key);
      if (!existing) {
        groupMap.set(key, { primary: scenario, versions: [scenario] });
      } else {
        existing.versions.push(scenario);
        // PUBLISHED가 있으면 primary로 설정
        if (scenario.status === "PUBLISHED" && existing.primary.status !== "PUBLISHED") {
          existing.primary = scenario;
        }
      }
    }

    // 각 그룹에서 primary와 나머지 버전들로 구성
    const scenarios = Array.from(groupMap.values()).map(
      ({ primary, versions }) => ({
        ...primary,
        totalVersions: versions.length,
        // 모든 버전 정보 (PUBLISHED 우선, 그 다음 버전 내림차순)
        allVersions: versions.sort((a, b) => {
          // PUBLISHED 우선
          if (a.status === "PUBLISHED" && b.status !== "PUBLISHED") return -1;
          if (b.status === "PUBLISHED" && a.status !== "PUBLISHED") return 1;
          // 그 다음 버전 내림차순
          return b.versionNumber - a.versionNumber;
        }),
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
  const auth = await requireAdmin();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await req.json();
    const {
      chiefComplaint,
      caseName,
      previousScenarioId,
      scenarioContent,
      checklistItemsSnapshot: clientChecklistSnapshot,
      checklistIncludedMap,
      commentaryContent,
      rolePromptSnapshot,
      commentaryPromptSnapshot,
      promptSourceVersionId,
      action = "draft",
      pendingImageId, // 새 시나리오 생성 전에 만들어진 이미지 ID
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

    // 버전 0.1씩 증가 (부동소수점 오차 방지를 위해 반올림)
    const incrementVersion = (v: number) => Math.round((v + 0.1) * 10) / 10;

    // 이전 버전 조회 (수정인 경우)
    let previousScenario = null;
    let checklistSourceVersionId: string | null = null;
    let checklistItemsSnapshot: unknown = clientChecklistSnapshot || null;

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
    }

    // 항상 DB에서 가장 높은 버전 번호를 조회하여 새 버전 생성
    const existingLatest = await prisma.scenario.findFirst({
      where: { chiefComplaint, caseName },
      orderBy: { versionNumber: "desc" },
    });

    let versionNumber = 0.1;
    if (existingLatest) {
      versionNumber = incrementVersion(existingLatest.versionNumber);
      // 체크리스트 스냅샷이 없으면 기존 것 계승
      if (!checklistItemsSnapshot && existingLatest.checklistItemsSnapshot) {
        checklistSourceVersionId = existingLatest.checklistSourceVersionId;
        checklistItemsSnapshot = existingLatest.checklistItemsSnapshot;
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
        createdById: auth.user.id,
        publishedAt: action === "publish" ? new Date() : null,
        scenarioContent: scenarioContent || null,
        checklistSourceVersionId,
        checklistItemsSnapshot: checklistItemsSnapshot ?? undefined,
        checklistIncludedMap: checklistIncludedMap || null,
        checklistConfirmedAt: checklistIncludedMap ? new Date() : null,
        commentaryContent: commentaryContent || null,
        commentaryUpdatedAt: commentaryContent ? new Date() : null,
        rolePromptSnapshot: rolePromptSnapshot || null,
        commentaryPromptSnapshot: commentaryPromptSnapshot || null,
        promptSourceVersionId: promptSourceVersionId || null,
      },
    });

    // 이미지 처리
    if (pendingImageId) {
      // 새로 업로드된 이미지가 있으면 연결
      try {
        await prisma.patientImage.update({
          where: { id: pendingImageId },
          data: { scenarioId: newScenario.id },
        });

        await prisma.scenario.update({
          where: { id: newScenario.id },
          data: { activeImageId: pendingImageId },
        });

        console.log("[scenario POST] Linked new image:", pendingImageId, "to scenario:", newScenario.id);
      } catch (imgErr) {
        console.warn("[scenario POST] Failed to link image:", imgErr);
      }
    } else if (previousScenario?.activeImageId) {
      // 이전 버전에 이미지가 있으면 복사하여 새 시나리오에 연결
      try {
        const previousImage = await prisma.patientImage.findUnique({
          where: { id: previousScenario.activeImageId },
        });

        if (previousImage) {
          // 새 PatientImage 레코드 생성 (같은 s3Key 사용)
          const newImage = await prisma.patientImage.create({
            data: {
              scenarioId: newScenario.id,
              sex: previousImage.sex,
              age: previousImage.age,
              chiefComplaint: previousImage.chiefComplaint,
              s3Key: previousImage.s3Key,
              prompt: previousImage.prompt,
              model: previousImage.model,
              sizeBytes: previousImage.sizeBytes,
            },
          });

          // 새 시나리오의 activeImageId 업데이트
          await prisma.scenario.update({
            where: { id: newScenario.id },
            data: { activeImageId: newImage.id },
          });

          console.log("[scenario POST] Copied image from previous scenario:", previousImage.id, "-> new image:", newImage.id);
        }
      } catch (imgErr) {
        console.warn("[scenario POST] Failed to copy image from previous version:", imgErr);
      }
    } else if (existingLatest?.activeImageId && !previousScenarioId) {
      // previousScenarioId 없이 기존 버전이 있는 경우 (같은 chiefComplaint + caseName)
      // 가장 최신 버전의 이미지를 복사
      try {
        const latestImage = await prisma.patientImage.findUnique({
          where: { id: existingLatest.activeImageId },
        });

        if (latestImage) {
          const newImage = await prisma.patientImage.create({
            data: {
              scenarioId: newScenario.id,
              sex: latestImage.sex,
              age: latestImage.age,
              chiefComplaint: latestImage.chiefComplaint,
              s3Key: latestImage.s3Key,
              prompt: latestImage.prompt,
              model: latestImage.model,
              sizeBytes: latestImage.sizeBytes,
            },
          });

          await prisma.scenario.update({
            where: { id: newScenario.id },
            data: { activeImageId: newImage.id },
          });

          console.log("[scenario POST] Copied image from latest version:", latestImage.id, "-> new image:", newImage.id);
        }
      } catch (imgErr) {
        console.warn("[scenario POST] Failed to copy image from latest version:", imgErr);
      }
    }

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
  const auth = await requireAdmin();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const body = await req.json();
    const {
      id,
      scenarioContent,
      checklistItemsSnapshot,
      checklistIncludedMap,
      commentaryContent,
      rolePromptSnapshot,
      commentaryPromptSnapshot,
      promptSourceVersionId,
      action,
      pendingImageId, // 시나리오 저장 전에 만들어진 이미지 ID
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
    if (checklistItemsSnapshot !== undefined) {
      updateData.checklistItemsSnapshot = checklistItemsSnapshot;
    }
    if (checklistIncludedMap !== undefined) {
      updateData.checklistIncludedMap = checklistIncludedMap;
      updateData.checklistConfirmedAt = new Date();
    }
    if (commentaryContent !== undefined) {
      updateData.commentaryContent = commentaryContent;
      updateData.commentaryUpdatedAt = new Date();
    }
    if (rolePromptSnapshot !== undefined) {
      updateData.rolePromptSnapshot = rolePromptSnapshot;
    }
    if (commentaryPromptSnapshot !== undefined) {
      updateData.commentaryPromptSnapshot = commentaryPromptSnapshot;
    }
    if (promptSourceVersionId !== undefined) {
      updateData.promptSourceVersionId = promptSourceVersionId;
    }
    if (action === "publish") {
      updateData.status = "PUBLISHED";
      updateData.publishedAt = new Date();
    }

    const updated = await prisma.scenario.update({
      where: { id },
      data: updateData,
    });

    // pendingImageId가 있으면 이미지를 시나리오에 연결
    if (pendingImageId) {
      try {
        // 이미지의 scenarioId 업데이트
        await prisma.patientImage.update({
          where: { id: pendingImageId },
          data: { scenarioId: id },
        });

        // 시나리오의 activeImageId 업데이트
        await prisma.scenario.update({
          where: { id },
          data: { activeImageId: pendingImageId },
        });

        console.log("[scenario PATCH] Linked image:", pendingImageId, "to scenario:", id);
      } catch (imgErr) {
        console.warn("[scenario PATCH] Failed to link image:", imgErr);
        // 이미지 연결 실패해도 시나리오 수정은 성공으로 처리
      }
    }

    return NextResponse.json({ success: true, scenario: updated });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `수정 실패: ${msg}` }, { status: 500 });
  }
}

/**
 * DELETE: 시나리오 삭제 (DRAFT, PUBLISHED 삭제 허용, LEGACY는 불가)
 */
export async function DELETE(req: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

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

    if (existing.status === "LEGACY") {
      return NextResponse.json(
        { error: "LEGACY 시나리오는 삭제할 수 없습니다." },
        { status: 400 }
      );
    }

    // 연결된 PatientImage가 있으면 연결 해제 (scenarioId를 null로)
    await prisma.patientImage.updateMany({
      where: { scenarioId: id },
      data: { scenarioId: null },
    });

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
