import { NextResponse } from "next/server";
import { getOpenAIClient, extractTextFromResponses } from "../_lib";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

// ----- Types -----
type SegmentLike = string | { text?: string };
type TranscriptInput =
  | string
  | { text?: string; segments?: SegmentLike[] };

interface CleanupPayload {
  transcript: TranscriptInput;
}

// ----- Helpers -----
function buildUserText(transcript: TranscriptInput): string {
  if (typeof transcript === "string") return transcript.trim();

  const t = (transcript?.text ?? "").trim();
  if (t) return t;

  const segs = transcript?.segments ?? [];
  const parts = segs
    .map((s) => (typeof s === "string" ? s : s?.text ?? ""))
    .filter((v) => v);
  return parts.join("\n").trim();
}

// ----- Route -----
export async function POST(req: Request) {
  try {
    const payload = (await req.json()) as CleanupPayload;
    const raw = buildUserText(payload?.transcript);
    if (!raw) return NextResponse.json({ text: "" });

    const sys =
      "당신은 한국어 의무기록용 대화 전사 교정기입니다.\n" +
      "원칙:\n" +
      "1) 한국어 오탈자/띄어쓰기를 교정하되 의학용어는 보수적으로 유지.\n" +
      "2) 딱 2명만 존재: 각 발화 맨 앞에 '의사:' 또는 '환자:'를 붙이기.\n" +
      "3) 음성 단서 없음 → 내용으로 추론. 질문/설명/검사·처치=의사, 증상/과거력/동의=환자 경향.\n" +
      "4) 불확실해도 한쪽 선택(UNKNOWN 금지), 의미 추가/삭제 금지.\n" +
      "5) 출력은 순수 텍스트만. 각 발화를 줄바꿈으로 구분. 따옴표/코드블록/JSON 금지.\n";

    const user =
      "다음 대화 원문을 교정하고 화자를 추론해 '의사:' 또는 '환자:'를 붙여주세요.\n\n[원문]\n" +
      raw;

    const openai = await getOpenAIClient();

    // Responses API 시도
    try {
      const resp = await openai.responses.create({
        model: "gpt-4o",
        reasoning: { effort: "medium" },
        temperature: 0.2,
        max_output_tokens: 16384,
        input: [
          { role: "system", content: [{ type: "input_text", text: sys }] },
          { role: "user", content: [{ type: "input_text", text: user }] },
        ],
      });
      const txt = extractTextFromResponses(resp).replace(/^["'`]+|["'`]+$/g, "").trim();
      return NextResponse.json({ text: txt || raw });
    } catch (fallbackErr) {
      // Chat Completions fallback
      logger.warn("Responses API failed, falling back to Chat Completions", {
        source: "api/cleanup",
        stackTrace: fallbackErr instanceof Error ? fallbackErr.stack : undefined,
        metadata: { transcriptLength: raw.length },
      });
      const chat = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.2,
        max_tokens: 16384,
        messages: [
          { role: "system", content: sys },
          { role: "user", content: user },
        ],
      });
      const txt = (chat.choices?.[0]?.message?.content || "")
        .replace(/^["'`]+|["'`]+$/g, "")
        .trim();
      return NextResponse.json({ text: txt || raw });
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.error("Cleanup failed", {
      source: "api/cleanup",
      stackTrace: e instanceof Error ? e.stack : undefined,
      metadata: {},
    });
    return NextResponse.json({ detail: `Cleanup failed: ${msg}` }, { status: 500 });
  }
}
