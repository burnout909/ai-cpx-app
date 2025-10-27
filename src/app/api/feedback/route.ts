import { NextResponse } from "next/server";
import { getOpenAIClient } from "../_lib";
import { GradeItem } from "@/types/score";
import z from "zod";
import { zodTextFormat } from "openai/helpers/zod.mjs";

/* =========================
   Types (DTO)
========================= */
export interface FeedbackRequest {
    chief_complaint: string;
    transcript: string;
    graded: Record<'history' | 'physical_exam' | 'education' | 'ppi', GradeItem[]>
}

/** Success Response DTO */
export interface FeedbackResponse {
    history_taking_feedback: string;
    physical_exam_feedback: string;
    patient_education_feedback: string;
    ppi_feedback: string;
    overall_summary: string;
}

/** Error DTO */
export interface FeedbackError {
    detail: string;
}

/* =========================
   Zod Schema (Structured Output)
========================= */
const FeedbackSchema = z.object({
    history_taking_feedback: z.string(),
    physical_exam_feedback: z.string(),
    patient_education_feedback: z.string(),
    ppi_feedback: z.string(),
    overall_summary: z.string(),
});

/* =========================
   Route
========================= */
export async function POST(
    req: Request
): Promise<NextResponse<FeedbackResponse | FeedbackError>> {
    try {
        const payload = (await req.json()) as FeedbackRequest;

        if (!payload?.transcript || !payload?.graded) {
            return NextResponse.json<FeedbackError>(
                { detail: "Invalid payload: transcript and checklist are required." },
                { status: 400 }
            );
        }

        const openai = await getOpenAIClient();

        /* =========================
           JSON Schema
        ========================== */
        const jsonSchema = {
            name: "feedback_schema",
            schema: {
                type: "object",
                additionalProperties: false,
                properties: {
                    history_taking_feedback: { type: "string" },
                    physical_exam_feedback: { type: "string" },
                    patient_education_feedback: { type: "string" },
                    ppi_feedback: { type: "string" },
                    overall_summary: { type: "string" },
                },
                required: [
                    "history_taking_feedback",
                    "physical_exam_feedback",
                    "patient_education_feedback",
                    "ppi_feedback",
                    "overall_summary",
                ],
            },
            strict: true,
        } as const;

        /* =========================
           System Prompt
        ========================== */
        const sys = `
시스템 지시]
너는 의과대학 CPX 평가위원이며, 표준화환자와 학생 간의 대화 전사문과 체크리스트 결과를 분석하여
학생에게 따뜻하고 구체적인 피드백을 제공하는 역할을 맡고 있다.
피드백은 교수님처럼 자연스럽지만 무겁지 않게, 😊🌿💬 같은 이모티콘을 약간 곁들여 격려하는 말투로 작성한다. 

[주의]

음성 인식된 텍스트이기 때문에 전사문에는 오타가 있을 수 있다. 따라서 유두리 있게 오타를 교정해야 한다.

[목표]

너의 목표는 아래 네 가지 기준에서 만점 수준의 피드백을 생성하는 것이다:

1. Evidence-Based: 실제 학생의 발화(evidence)에 근거하여 강점과 약점을 지적한다.
2. Actionable: 개선점마다 실행 가능한 구체적 제안을 포함한다.
3. Connected: 지적의 근거와 제안이 논리적으로 연결되어 있다.
4. Balanced: 칭찬과 제안을 균형 있게 제시한다.

---

[입력 형식] 
{
"chief_complaint": "복통",
"transcript": "**학생과 SP의 실제 대화 전사문 전체**",
"checklist": {
"history_taking": [
{“item”: , “title”:, “criteria”}
],
"physical_exam": [...],
"patient_education": [...],
"ppi": [...]
}
}

---

[출력 형식]
{
"history_taking_feedback": "string",
"physical_exam_feedback": "string",
"patient_education_feedback": "string",
"ppi_feedback": "string",
"overall_summary": "string"
}

---

[작성 규칙]

1️⃣ **케이스 인식**

- 전사문을 통해 어떤 임상 상황(예: 충수염, 위염, 산부인과적 복통 등)인지 스스로 추론한다.
- 피드백 내용은 해당 시나리오의 임상적 맥락에 맞게 조정한다.

2️⃣ **피드백 구성 원칙**

- 각 영역별로 2~3문단 이내, 학생의 구체적 행동을 근거로 작성.
- 잘한 점 → 행동 근거 포함 → 부드러운 칭찬 😊
- 개선점 → 이유 + 구체적 행동 제안 (“다음엔 ~을 물어보면 좋겠어요🌱”).
- 중요도가 낮은 항목의 누락은 언급하지 않는다.
- 전문용어는 그대로 사용하되, 설명은 부드럽게 덧붙인다.

3️⃣ **언어 스타일**

- 교수의 코멘트처럼 존중·격려 어조.
- 문장은 짧고 자연스럽게.
- emoji 예시: 😊🌿💬✨👍
- “다음엔~” “좋았습니다!” “한 단계 더 발전할 수 있겠어요” 등의 표현 활용.

4️⃣ **논리 구조**

- Evidence-Based → Actionable → Connected → Balanced 순으로 자연스럽게 녹여라.
- 각 문단은 실제 대화(evidence)에 근거한 칭찬 또는 제안이어야 한다.
- 피드백이 실제 교육 현장에서 바로 읽힐 수 있도록 작성한다.

---

[출력 예시]

{
"history_taking_feedback": "통증의 위치와 지속 기간을 명확히 확인한 점이 좋았습니다😊 다만 통증의 양상(찌르는 통증인지, 둔한 통증인지)을 묻지 않아 감별 범위가 넓어질 수 있었습니다. 다음엔 통증의 성격과 악화·완화 요인을 함께 물어보면 더 정확한 판단이 가능할 거예요🌿",

"physical_exam_feedback": "복부 진찰 시 환자의 불편을 최소화하려는 태도가 인상적이었습니다✨ 촉진 전 검사 과정을 간단히 설명하거나 손을 따뜻하게 해주는 작은 배려가 더해진다면 환자 신뢰를 높일 수 있겠어요💬",

"patient_education_feedback": "복통 원인과 향후 검사 계획을 잘 설명했어요👍 다만 식이 조절과 약물 복용법에 대해 조금 더 구체적인 안내가 있었다면 환자가 더 안심했을 거예요😊",

"ppi_feedback": "차분하고 공감 어린 태도로 환자의 이야기를 경청한 점이 아주 좋았습니다🌿 간혹 의학 용어가 그대로 사용되어 환자가 이해하기 어려웠을 수도 있으니, 다음엔 평이한 표현으로 풀어주면 좋겠어요✨",

"overall_summary": "전반적으로 매우 따뜻하고 체계적인 진료 태도를 보여주었습니다😊 작은 부분만 다듬으면 실제 진료에서도 환자와 신뢰감 있는 관계를 형성할 수 있을 거예요🌿"
}
`;

        /* =========================
           OpenAI 호출
        ========================== */
        const userMsg = {
            chief_complaint: payload.chief_complaint,
            transcript: payload.transcript,
            graded: payload.graded,
        };

        /* =========================
        ✅ Structured Output 호출
     ========================== */
        try {
            const resp = await openai.responses.parse({
                model: "gpt-5-2025-08-07",
                input: [
                    { role: "system", content: sys },
                    { role: "user", content: JSON.stringify(userMsg) },
                ],
                text: {
                    format: zodTextFormat(FeedbackSchema, "feedback_schema"),
                },
                temperature: 0,
                max_output_tokens: 4096,
            });

            const data = resp.output_parsed ?? {
                history_taking_feedback: "",
                physical_exam_feedback: "",
                patient_education_feedback: "",
                ppi_feedback: "",
                overall_summary: "",
            };

            return NextResponse.json<FeedbackResponse>(data);
        } catch (error) {
            /* fallback */
            const fallback = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                response_format: { type: "json_object" },
                messages: [
                    {
                        role: "system",
                        content: sys + "\n\n반드시 JSON만 출력하세요 (마크다운 금지).",
                    },
                    { role: "user", content: JSON.stringify(userMsg) },
                ],
                temperature: 0.3,
                max_tokens: 3500,
            });

            const parsed = JSON.parse(
                fallback.choices?.[0]?.message?.content ?? "{}"
            );

            return NextResponse.json<FeedbackResponse>({
                history_taking_feedback: parsed.history_taking_feedback ?? "",
                physical_exam_feedback: parsed.physical_exam_feedback ?? "",
                patient_education_feedback: parsed.patient_education_feedback ?? "",
                ppi_feedback: parsed.ppi_feedback ?? "",
                overall_summary: parsed.overall_summary ?? "",
            });
        }
    } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        return NextResponse.json<FeedbackError>(
            { detail: `feedback generation failed: ${msg}` },
            { status: 500 }
        );
    }
}