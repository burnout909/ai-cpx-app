import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb, type PDFPage } from "pdf-lib";

export const runtime = "nodejs";

function textLines(text: string, maxChars = 90): string[] {
  const words = (text || "").split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = (line + " " + w).trim();
    if (test.length <= maxChars) line = test;
    else {
      if (line) lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

interface DomainScore {
  raw?: number;
  weighted?: number;
}

interface Grading {
  scores?: {
    total?: number;
    domain?: Record<string, DomainScore>;
  };
  feedback?: Record<string, string>;
}

interface Payload {
  checker?: { case?: Record<string, unknown> };
  case?: Record<string, unknown>;
  grading?: Grading;
}

export async function POST(req: Request) {
  try {
    const payload = (await req.json()) as Payload;
    const caseMeta = payload?.checker?.case || payload?.case || {};
    const grading = payload?.grading || {};
    const scores = grading?.scores || {};
    const domain = scores?.domain || {};
    const total = typeof scores?.total === "number" ? scores.total : 0;

    const pdf = await PDFDocument.create();
    let page = pdf.addPage([595.28, 841.89]); // A4
    const { height } = page.getSize();

    const fontBold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const font = await pdf.embedFont(StandardFonts.Helvetica);

    const x = 50;
    let y = height - 60;

    const draw = (txt: string, size = 12, bold = false, gap = 16) => {
      page.drawText(txt, {
        x,
        y,
        size,
        font: bold ? fontBold : font,
        color: rgb(0, 0, 0),
      });
      y -= gap;
    };

    draw("ai-cpx — 자동 채점 리포트", 16, true, 20);
    draw(new Date().toISOString().slice(0, 19).replace("T", " "), 10, false, 14);

    draw(
      `케이스: ${(caseMeta as any)?.title || "(제목 없음)"} / CC: ${(caseMeta as any)?.chief_complaint || "-"}`,
      12,
      true,
      18
    );

    draw(`총점: ${total.toFixed(1)} / 100`, 12, true, 18);

    for (const k of Object.keys(domain)) {
      const v = domain[k] as DomainScore;
      draw(
        `- ${k}: raw ${v.raw?.toFixed?.(2)} → weighted ${v.weighted?.toFixed?.(2)}`,
        10,
        false,
        14
      );
    }

    const fb = grading?.feedback || {};
    y -= 8;
    draw("피드백 요약", 12, true, 18);

    for (const key of ["history", "physical_exam", "education", "ppi", "summary"]) {
      if (!fb[key]) continue;
      const lines = textLines(`[${key}] ${fb[key]}`, 90);
      for (const ln of lines) {
        if (y < 70) {
          // 새 페이지
          const p2: PDFPage = pdf.addPage([595.28, 841.89]);
          page = p2; // 현재 페이지 교체
          y = p2.getSize().height - 60;
        }
        page.drawText(ln, { x, y, size: 10, font, color: rgb(0, 0, 0) });
        y -= 14;
      }
      y -= 6;
    }

    const bytes = await pdf.save();
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="ai-cpx-report.pdf"',
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ detail: `PDF failed: ${msg}` }, { status: 500 });
  }
}
