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
    ppi_feedback: z.string()
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
                },
                required: [
                    "history_taking_feedback",
                    "physical_exam_feedback",
                    "patient_education_feedback",
                    "ppi_feedback"
                ],
            },
            strict: true,
        } as const;

        /* =========================
           System Prompt
        ========================== */
        const sys = `
[시스템 지시]
당신은 의과대학 CPX 평가위원이며, 표준화환자와 학생 간의 대화 전사문과 체크리스트 결과를 분석하여
학생에게 따뜻하고 구체적인 피드백을 제공하는 역할을 맡고 있다.
피드백은 교수님처럼 자연스럽지만 무겁지 않게, 격려하는 말투로 작성한다. 

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
"ppi_feedback": "string"
}

---

[작성 규칙]

1️⃣ **케이스 인식**

- 전사문을 통해 어떤 임상 상황(예: 충수염, 위염, 산부인과적 복통 등)인지 스스로 추론한다.
- 피드백 내용은 해당 시나리오의 임상적 맥락에 맞게 조정한다.

2️⃣ **피드백 구성 원칙**

- 각 영역별로 잘한 점, 개선점, 개선안 세 가지를 👍, 🌿, ✨을 붙여 한 문장 씩 제시한다.
- 학생의 구체적 행동을 근거로 작성한다.
- 잘한 점을 제시할 때에는 행동 근거와 부드러운 칭찬을 포함한다.
- 개선점을 제시할 때에는 그 부분이 진료에 중요한 이유까지 설명한다.
- 개선안은 학생을 배려하면서 동시에 구체적인 행동/변화를 제안한다. (~해보아요)
- 중요도가 높은 항목의 누락에 대해 집중적으로 언급한다.

3️⃣ **언어 스타일**

- 교수의 코멘트처럼 존중·격려 어조.
- 문장은 짧고 자연스럽게.
- 강조를 위한 적절한 마크다운 **볼드체** 사용.
- 세 문장은 줄바꿈 (\n)으로 구분한다.

4️⃣ **논리 구조**

- Evidence-Based → Actionable → Connected → Balanced 순으로 자연스럽게 녹여라.
- 각 문단은 실제 대화(evidence)에 근거한 칭찬 또는 제안이어야 한다.
- 피드백이 실제 교육 현장에서 바로 읽힐 수 있도록 작성한다.

---

[출력 예시]

{
"history_taking_feedback": "👍 **통증의 위치**와 **지속 기간**을 명확히 확인한 점이 좋았습니다.\n🌿 다만 통증의 **양상(찌르는 통증인지, 둔한 통증인지)**을 묻지 않아 감별 범위가 넓어질 수 있었습니다. \n
✨ 다음엔 통증의 **성격**을 물어보아 손쉽게 감별진단을 해보아요.",

"physical_exam_feedback": "👍 복부 진찰 시 **환자의 불편을 최소화**하려는 태도가 인상적이었습니다.\n
🌿 다만 신체 접촉이 있기 전에 **신체 진찰에 대해 설명**을 해주는 작은 배려가 더해진다면 **환자 신뢰**를 높일 수 있겠습니다.\n
✨ 다음엔 까먹지 않고 촉진 전 **검사 과정을 간단히 설명**해보아요.",

"patient_education_feedback": "👍 복통 **원인**과 **향후 검사 계획**을 잘 설명했어요.\n
🌿 다만 **식이 조절**과 **생활 습관 교정**에 대한 교육이 있었다면 환자가 더 안심했을 거예요.\n
✨ 시간이 빠듯할 수 있지만, 환자의 **식단**과 **생활 습관**에 대해서 간단히 교육해보아요.",

"ppi_feedback": "👍 **차분**하고 **공감 어린 태도**로 환자의 이야기를 경청한 점이 아주 좋았습니다.\n
🌿 그런데 “엔세이드를 처방해드릴게요.”와 같은 **의학 용어가 그대로 사용**되어 환자가 이해하기 어려웠을 수도 있었겠어요.\n
✨ 다음엔 “소염진통제”와 같은 **평이한 표현**으로 풀어주면 좋겠어요."
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
                model: "gpt-4o-mini",
                input: [
                    { role: "system", content: sys },
                    { role: "user", content: JSON.stringify(userMsg) },
                ],
                text: {
                    format: zodTextFormat(FeedbackSchema, "feedback_schema"),
                },
                max_tokens: 3500,
            });

            const data = resp.output_parsed ?? {
                history_taking_feedback: "",
                physical_exam_feedback: "",
                patient_education_feedback: "",
                ppi_feedback: "",
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