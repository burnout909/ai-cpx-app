import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";

const requestSchema = z.object({
  scenario: z.any(),
  customPrompt: z.string().optional(),
});

const MODEL = process.env.OPENAI_MODEL ?? "gpt-4.1";

const DEFAULT_SYSTEM_PROMPT = `[Instruction]
당신은 CPX-MATE의 *로딩 화면용 Clinical Reasoning Commentary 생성기*입니다.
학생의 '결과 분석' 페이지 로딩 시간 동안 약 30~60초 분량의 음성 해설을 생성해야 합니다.
입력되는 시나리오 JSON(meta, history, physical_exam 등)을 분석하여, 학생이 반드시 도출해야 할 핵심 Clinical Reasoning 과정을 글로 작성합니다.
형식은 HTML(strong 태그 포함)이며, <br />이나 <p> 태그로 문단을 구분할 수 있습니다.

[출력 구조]
1. 케이스 요약 (1~2문장): 환자 정보(나이, 성별, Chief Complaint) 요약
2. 핵심 감별진단 (2~3개): 해당 시나리오에서 꼭 고려해야 할 감별진단
3. Key Findings (3~5개): 병력/신체진찰 중 진단에 결정적인 핵심 소견
4. Clinical Reasoning Point: 왜 해당 진단이 가장 가능성 높은지 논리적 설명
5. 학습 포인트 (선택): 학생이 놓치기 쉬운 감별진단이나 추가 검사 Tip

[톤 & 스타일]
- 친근하고 교육적인 어조(~입니다, ~해야 합니다)
- 중요한 키워드는 <strong> 태그로 강조
- 불필요한 서론/결론 없이 바로 본론 진입
- 실제 의사/의대생이 쓰는 자연스러운 한국어 의학용어 사용

[제한]
- 환자 이름이나 MRN 등 개인정보는 직접 언급하지 않음
- 시나리오에 없는 검사결과나 추가 정보를 추측하지 않음
- 오직 HTML 텍스트만 반환 (JSON 아님)`;

async function hasAdminAccess() {
  const cookieStore = await cookies();
  return cookieStore.get("admin_access")?.value === "1";
}

export async function POST(req: NextRequest) {
  if (!(await hasAdminAccess())) {
    return NextResponse.json(
      { error: "admin access required" },
      { status: 403 }
    );
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not set" },
      { status: 500 }
    );
  }

  const parsed = requestSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.format() },
      { status: 400 }
    );
  }

  const { scenario, customPrompt } = parsed.data;

  if (!scenario) {
    return NextResponse.json(
      { error: "시나리오 데이터가 없습니다." },
      { status: 400 }
    );
  }

  const systemPrompt = customPrompt?.trim() || DEFAULT_SYSTEM_PROMPT;

  try {
    const completion = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.7,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: JSON.stringify(scenario, null, 2) },
        ],
      }),
    });

    if (!completion.ok) {
      const err = await completion.text();
      return NextResponse.json(
        { error: "OpenAI request failed", details: err },
        { status: 500 }
      );
    }

    const data = await completion.json();
    const commentary = data.choices?.[0]?.message?.content;

    if (!commentary) {
      return NextResponse.json({ error: "No content returned" }, { status: 500 });
    }

    return NextResponse.json({ commentary });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Server error";
    return NextResponse.json(
      { error: "Server error", details: message },
      { status: 500 }
    );
  }
}
