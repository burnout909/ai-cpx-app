import { NextResponse } from "next/server";
import { getOpenAIClient } from "../_lib";

export const runtime = "nodejs";

// ----- Types -----
type TranscriptInput =
  | string
  | { text?: string; segments?: Array<{ id?: number; start?: number; end?: number; text?: string }> };

interface CheckerWeights {
  history?: number;
  physical_exam?: number;
  education?: number;
  ppi?: number;
  [k: string]: number | undefined;
}

interface Checker {
  sections?: unknown;
  weights?: CheckerWeights;
}

interface ScorePayload {
  transcript?: TranscriptInput;
  checker?: Checker | null;
}

interface LLMItem {
  id?: string;
  label?: string;
}

interface LLMScoring {
  by_item?: LLMItem[];
  scores?: {
    domain?: Record<string, { raw: number; weighted: number }>;
    total?: number;
  };
  [k: string]: unknown;
}

function normalizePPI(v: number): number {
  return Math.max(0, Math.min(1, (v - 1) / 4));
}

function defaultChecker(): Checker {
  return { sections: {}, weights: { history: 40, physical_exam: 30, education: 20, ppi: 10 } };
}

export async function POST(req: Request) {
  try {
    const payload = (await req.json()) as ScorePayload;

    let transcript: { text?: string } | undefined =
      typeof payload?.transcript === "string"
        ? { text: payload.transcript }
        : (payload?.transcript as { text?: string } | undefined);

    const checker: Checker = payload?.checker || defaultChecker();

    const sys =
      "당신은 한국 의대 CPX 자동 채점기입니다. " +
      "입력으로 화자분리 전사(JSON)와 체크리스트(JSON)를 받습니다. " +
      "각 항목에 대해 다음을 산출하세요: " +
      " - history: binary(예/아니오 => 1/0) " +
      " - physical_exam: ternary_uap(우수/수행/미수행 => 1/0.5/0) " +
      " - education: ternary_uap(우수/수행/미수행 => 1/0.5/0) " +
      " - ppi: likert_1to5(1~5 정수) " +
      "판정 근거로 전사의 특정 구간을 인용하되, 세그먼트 단위(turn 번호와 텍스트 일부)를 evidence로 남기세요. " +
      "출력은 JSON만 반환하세요.";

    const openai = await getOpenAIClient();

    // JSON 모드 우선
    let txt = "";
    try {
      const resp = await openai.chat.completions.create({
        model: "o3", // 실패하면 아래 fallback
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: sys },
          { role: "user", content: JSON.stringify({ transcript, checker }) },
        ],
        max_tokens: 4000,
      });
      txt = resp.choices?.[0]?.message?.content || "";
    } catch {
      const resp = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: sys + "\n반드시 JSON만 출력하세요." },
          { role: "user", content: JSON.stringify({ transcript, checker }) },
        ],
        max_tokens: 4000,
      });
      txt = resp.choices?.[0]?.message?.content || "{}";
    }

    const jsonMatch = txt.match(/\{[\s\S]*\}/);
    const data: LLMScoring = JSON.parse(jsonMatch ? jsonMatch[0] : txt || "{}");

    const weights: Required<CheckerWeights> = {
      history: checker.weights?.history ?? 40,
      physical_exam: checker.weights?.physical_exam ?? 30,
      education: checker.weights?.education ?? 20,
      ppi: checker.weights?.ppi ?? 10,
    };

    const agg: Record<"history" | "physical_exam" | "education" | "ppi", number[]> = {
      history: [],
      physical_exam: [],
      education: [],
      ppi: [],
    };

    for (const item of data?.by_item ?? []) {
      const id = (item?.id ?? "").toString();
      const label = (item?.label ?? "").toString().trim();

      if (id.startsWith("HX")) {
        const val = ["예", "충족", "우수", "수행", "부분충족", "Yes", "True"].includes(label) ? 1 : 0;
        agg.history.push(val);
      } else if (id.startsWith("PE")) {
        const val = label === "우수" ? 1 : (["수행", "부분충족", "부분 수행"].includes(label) ? 0.5 : 0);
        agg.physical_exam.push(val);
      } else if (id.startsWith("ED")) {
        const val = label === "우수" ? 1 : (["수행", "부분충족", "부분 수행"].includes(label) ? 0.5 : 0);
        agg.education.push(val);
      } else if (id.startsWith("PPI")) {
        const m = label.match(/\d+/);
        const raw = m ? parseInt(m[0]!, 10) : 3;
        agg.ppi.push(normalizePPI(raw));
      }
    }

    const domain_scores: Record<"history" | "physical_exam" | "education" | "ppi", { raw: number; weighted: number }> = {
      history: { raw: 0, weighted: 0 },
      physical_exam: { raw: 0, weighted: 0 },
      education: { raw: 0, weighted: 0 },
      ppi: { raw: 0, weighted: 0 },
    };

    (["history", "physical_exam", "education", "ppi"] as const).forEach((dom) => {
      const arr = agg[dom];
      const raw = arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
      const weighted = raw * Number(weights[dom] || 0);
      domain_scores[dom] = { raw: Number(raw.toFixed(4)), weighted: Number(weighted.toFixed(2)) };
    });

    const total = Number(
      (Object.values(domain_scores) as Array<{ weighted: number }>)
        .reduce((s, v) => s + v.weighted, 0)
        .toFixed(2)
    );

    data.scores = { domain: domain_scores, total };
    return NextResponse.json(data);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ detail: `Scoring failed: ${msg}` }, { status: 500 });
  }
}
