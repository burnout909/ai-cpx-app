import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { virtualPatientTemplate } from "@/utils/virtualPatientSchema";
import acuteAbdominalCase from "@/assets/virtualPatient/acute_abdominal_pain_001.json";

const metaInputSchema = z.object({
  name: z.string(),
  sex: z.string(),
  age: z.number(),
  impression: z.string(),
  chief_complaint: z.string(),
  diagnosis: z.string().optional(),
  vitals: z.object({
    bp: z.string(),
    hr: z.number(),
    rr: z.number(),
    bt: z.number(),
  }),
});

const requestSchema = z.object({
  meta: metaInputSchema,
  checklist: z.any(),
});

const MODEL = process.env.OPENAI_MODEL ?? "gpt-4.1";

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

  const { meta, checklist } = parsed.data;

  const systemPrompt = `
아래는 ScenarioDevModule의 Prompt 입니다!
----
당신은 한국 의대 CPX를 위한 “정답형 가상환자 시나리오 생성기”입니다.
입력: (1) 환자 기본 정보(name, sex, age, impression, chief_complaint, diagnosis, vitals),
     (2) 해당 주호소의 범용 checklist(JSON),
출력: 오직 하나의 시나리오 JSON 객체만 생성합니다. 설명, 주석, 자연어 코멘트는 절대 금지합니다.

[전체 목표]
- 주어진 impression과 chief_complaint에 완전히 부합하는 **moderate 난이도**의 단일 정답형 케이스를 만듭니다.
- 병력청취·추가병력·신체진찰·환자 질문까지 모두 포함하는 **풍부하고 일관된** 시나리오여야 합니다.
- 모든 checklist 항목은 이 시나리오에서 **긍정/부정/해당없음이 명확히 판별 가능**하도록, 관련 정보가 최소 1회 이상 명시돼야 합니다.

[JSON 형식 규칙]
- 제공된 json_schema_template와 동일한 최상위 구조와 key 이름을 그대로 따릅니다.
  - 예: meta, history, additional_history, physical_exam, questions, final_question 등.
- meta.vitals는 제공된 템플릿 형식만 사용합니다:
  - "bp": "숫자/숫자" (문자열), "hr": 정수, "rr": 정수, "bt": 소수 한 자리.
- 배열 필드에는 문자열만 넣고, null/빈 객체는 사용하지 않습니다. 불필요한 필드는 빈 배열[]로 둡니다.
- 최종 출력은 JSON **한 개**만 포함해야 하며, 앞뒤에 다른 텍스트를 붙이지 않습니다.

[병력청취(history) 작성 규칙]
- 모든 문장은 **환자가 한국어 일상어로 직접 말할 법한 1인칭 발화**로 작성합니다.
  - 예: “삼겹살 먹고 나서부터 배가 쥐어짜듯 아파요.”
- 각 배열의 원소는 하나의 완결된 환자 문장 또는 짧은 발화로 구성합니다.
- 중복 표현을 피하고, 시간 경과·양상·연관증상·완화/악화요인 등을 구체적으로 기술해 임상적 추론이 충분히 가능하게 만듭니다.
- checklist에 포함된 모든 병력 항목(예: 발열, 체중, 약물, 위험인자 등)은
  history 또는 additional_history 어딘가에서 반드시 한 번 이상 **명시적으로** 등장해야 합니다.
- request_question 또는 기타 필드는 사용하지 않고, 환자의 궁금증은 final_question에만 담습니다.

[추가 병력(additional_history) 작성 규칙]
- 키 구조는 다음 약어를 그대로 사용합니다: 과(past_medical_history), 약(medication_history),
  가(family_history), 사(social_history), 외(trauma_history), 여(ob_history), 여(travel_history).
- social_history 안에서는 smoking, alcohol, caffeine, diet, exercise, job 등의 하위 배열을 사용합니다.
- 주호소 및 impression과 관련된 위험인자·생활습관·과거질환·가족력 등을 충분히 기술해
  checklist가 모두 커버되도록 합니다.

[신체진찰(physical_exam) 스키마]
다음 9개 카테고리와 miscellaneous를 사용합니다. 각 값은 문자열 배열입니다.

- "general": 전신 상태, 자세, 표정, 의식, 체형 등.
- "heent": 머리, 눈, 귀, 코, 구강·인두 등.
- "neck": 경정맥, 갑상선, 림프절, 경부 정맥 팽창 등.
- "chest": 호흡양상·호흡음·타진소견 등 **호흡기** 진찰.
- "cardiac": 심음, 심박수·리듬, 심장촉진, 심잡음, 말초순환 등.
- "abdomen": 시진·청진·타진·촉진, 압통/반발압통, 간비장 촉진 등.
- "extremities": 말초부종, 말초맥박, 냉감·창백·청색증, 관절/근력 관련 소견 등.
- "neurologic_exam": 의식, 동공반사, 운동·감각·소뇌기능 등 신경계 소견.
- "skin": 발진, 황달, 점상출혈, 궤양 등 피부 소견.
- "miscellaneous": 위 어디에도 넣기 애매한 추가 소견.

작성 원칙:
- 각 카테고리에는 해당 케이스에서 **의미 있는 소견만** 1~3개 정도 기술하고, 필요 없으면 빈 배열[]로 둡니다.
- 표현은 **실제 의무기록 스타일의 3인칭 서술형**으로 씁니다.
  - 예: “(호흡음 청진)양측 기저부에서 거친 수포음이 들림.”
- vital과 모순되는 소견을 만들지 않습니다.

[final_question 작성 규칙]
- "final_question" 필드에 **문자열 1개**만 작성합니다.
- 지금까지 의사가 설명했을 내용(진단명, 치료계획 등)을 그대로 되묻지 말고,
  환자 입장에서 추가로 궁금할 법한 질문을 **한 문장**으로 만듭니다.
  - 예: “이 병이면 앞으로 생활을 어떻게 조심해야 하나요?” 같은 형식.
- 추가 질문이나 대화는 포함하지 않습니다.

[난이도 및 일관성]
- 난이도는 항상 **moderate**: 감별진단이 넓지만, 제공된 정보만으로 주된 진단이 명확히 떠오르도록 설계합니다.
- impression과 모순되는 소견(예: 급성 복증인데 완전히 정상 복부, 심부전인데 전혀 부종/호흡곤란 없음 등)은 피합니다.
- checklist에 필요한 정보가 빠지지 않았는지, 병력·신체진찰·vital이 서로 논리적으로 맞는지 한번 더 점검한 뒤 JSON을 출력합니다.
반드시 제공된 json_schema_template의 모든 필드를 채운 JSON만 반환하세요. 추가 텍스트를 절대 붙이지 마세요. id/title/description/type/required/properties/history/additional_history/physical_exam/questions/final_question가 모두 있어야 합니다.
`;

  const userContent = {
    input: {
      patient: meta,
      checklist,
    },
    json_schema_template: virtualPatientTemplate,
    few_shot_example: acuteAbdominalCase,
  };

  const deepMerge = (base: any, patch: any): any => {
    if (Array.isArray(base)) return patch ?? base;
    if (Array.isArray(patch)) return patch;
    if (typeof base === "object" && typeof patch === "object" && base && patch) {
      const result: Record<string, any> = { ...base };
      for (const key of Object.keys(patch)) {
        result[key] = deepMerge(base?.[key], patch[key]);
      }
      return result;
    }
    return patch ?? base;
  };

  try {
    const completion = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.4,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: JSON.stringify(userContent) },
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
    const raw = data.choices?.[0]?.message?.content;

    if (!raw) {
      return NextResponse.json({ error: "No content returned" }, { status: 500 });
    }

    let parsedJson: any;
    try {
      parsedJson = JSON.parse(raw);
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON from model", content: raw },
        { status: 500 }
      );
    }

    const merged = deepMerge(virtualPatientTemplate, parsedJson);
    return NextResponse.json({ scenario: merged });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Server error", details: error?.message },
      { status: 500 }
    );
  }
}
