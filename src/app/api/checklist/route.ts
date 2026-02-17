import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public GET: 체크리스트 목록 조회 (인증 불필요)
 *
 * 주호소별 최신 버전 목록만 반환 (관리용 상세 조회는 /api/admin/checklist 사용)
 */
export async function GET() {
  try {
    const allChecklists = await prisma.evidenceChecklist.findMany({
      orderBy: [{ chiefComplaint: "asc" }, { version: "desc" }],
      select: {
        id: true,
        chiefComplaint: true,
        version: true,
      },
    });

    // 주호소별 최신 버전만 추출
    const seen = new Set<string>();
    const latestVersions = [];
    for (const checklist of allChecklists) {
      if (!seen.has(checklist.chiefComplaint)) {
        seen.add(checklist.chiefComplaint);
        latestVersions.push({
          chiefComplaint: checklist.chiefComplaint,
          latestVersion: checklist.version,
          id: checklist.id,
        });
      }
    }

    return NextResponse.json({ checklists: latestVersions });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `조회 실패: ${msg}` }, { status: 500 });
  }
}
