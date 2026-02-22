import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { virtualPatientTemplate } from "@/utils/virtualPatientSchema";
import acuteAbdominalCase from "@/assets/virtualPatient/acute_abdominal_pain_001.json";
import { logger } from "@/lib/logger";

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
  customPrompt: z.string().optional(),
});

const MODEL = process.env.OPENAI_MODEL ?? "gpt-4.1";

const DEFAULT_SCENARIO_PROMPT = `아래는 ScenarioDevModule의 Prompt 입니다!
----
당신은 한국 의대 CPX를 위한 "정답형 가상환자 시나리오 생성기"입니다.
입력: (1) 환자 기본 정보(name, sex, age, impression, chief_complaint, diagnosis, vitals),
     (2) 해당 주호소의 범용 checklist(JSON),
출력: 오직 하나의 시나리오 JSON 객체만 생성합니다. 설명, 주석, 자연어 코멘트는 절대 금지합니다.

[전체 목표]
- 주어진 impression과 chief_complaint에 완전히 부합하는 **moderate 난이도**의 단일 정답형 케이스를 만듭니다.
- 병력청취·추가병력·신체진찰·환자 질문까지 모두 포함하는 **풍부하고 일관된** 시나리오여야 합니다.
- 모든 checklist 항목은 이 시나리오에서 **긍정/부정/해당없음이 명확히 판별 가능**하도록, 관련 정보가 최소 1회 이상 명시돼야 합니다.

[description 생성 규칙]
- 최상위에 "description" 키를 반드시 포함합니다.
- description은 CPX 시험 상황을 1~2문장으로 요약한 한국어 문장입니다.
- 형식: "{나이}세 {성별} {환자이름}씨가 {주호소/상황}(으)로 {내원 경위}하였다."
- 예: "48세 남성 이춘배씨가 갑자기 배가 심하게 아파 응급실로 내원하였다."
- 환자의 name, age, sex, chief_complaint, impression을 활용하여 자연스럽게 작성합니다.

[JSON 형식 규칙]
- 제공된 json_schema_template와 동일한 최상위 구조와 key 이름을 그대로 따릅니다.
  - 최상위 키는 description, meta, history, additional_history, physical_exam 입니다.
- meta.vitals는 제공된 템플릿 형식만 사용합니다:
  - "bp": "숫자/숫자" (문자열), "hr": 정수, "rr": 정수, "bt": 소수 한 자리.
- null/빈 객체는 사용하지 않습니다.
- 배열 필드의 원소 타입은 스키마를 따릅니다:
  - history 및 additional_history의 배열 필드에는 문자열만 넣습니다.
  - physical_exam에서 pe_observation 배열에는 객체만 넣습니다: {"maneuver": string, "result": string}
- 불필요한 정보는 빈 배열[]로 둡니다(단, 스키마에서 required인 object/필드는 반드시 존재해야 하며, 그 내부의 배열을 []로 둡니다).
- 최종 출력은 JSON **한 개**만 포함해야 하며, 앞뒤에 다른 텍스트를 붙이지 않습니다.

[병력청취(history) 작성 규칙]
- 모든 문장은 **환자가 한국어 일상어로 직접 말할 법한 1인칭 발화**로 작성합니다.
  - 예: "삼겹살 먹고 나서부터 배가 쥐어짜듯 아파요."
- 각 배열의 원소는 하나의 완결된 환자 문장 또는 짧은 발화로 구성합니다.
- 중복 표현을 피하고, 시간 경과·양상·연관증상·완화/악화요인 등을 구체적으로 기술해 임상적 추론이 충분히 가능하게 만듭니다.
- checklist에 포함된 모든 병력 항목(예: 발열, 체중, 약물, 위험인자 등)은
  history 또는 additional_history 어딘가에서 반드시 한 번 이상 **명시적으로** 등장해야 합니다.
- request_question 또는 기타 필드는 사용하지 않습니다.

[추가 병력(additional_history) 작성 규칙]
- 키 구조는 스키마를 그대로 사용합니다: 과(past_medical_history), 약(medication_history),
  가(family_history), 사(social_history), 외(trauma_history), 여(ob_history), 여(travel_history), miscellaneous_history.
  - 여(ob_history)와 여(travel_history)는 서로 다른 키이며 둘 다 반드시 포함합니다.
- social_history 안에서는 smoking, alcohol, caffeine, diet, exercise, job 등의 하위 배열을 사용합니다.
- 주호소 및 impression과 관련된 위험인자·생활습관·과거질환·가족력 등을 충분히 기술해
  checklist가 모두 커버되도록 합니다.

[신체진찰(physical_exam) 스키마]
- physical_exam은 제공된 스키마 구조를 그대로 따릅니다(중첩 object 포함).
- physical_exam에서 배열의 원소는 문자열이 아니라 pe_observation 객체입니다:
  - {"maneuver": "...", "result": "..."}
- 표현 원칙:
  - maneuver: 실제로 시행한 진찰/검사(무엇을 했는지)
  - result: **실제 의무기록 스타일의 3인칭 서술형 결과**로 씁니다.
    - 예: "(복부 촉진) RUQ 압통(+), 반발압통(-)."
- vital과 모순되는 소견을 만들지 않습니다.

[난이도 및 일관성]
- 난이도는 항상 **moderate**: 감별진단이 넓지만, 제공된 정보만으로 주된 진단이 명확히 떠오르도록 설계합니다.
- impression과 모순되는 소견(예: 급성 복증인데 완전히 정상 복부, 심부전인데 전혀 부종/호흡곤란 없음 등)은 피합니다.
- checklist에 필요한 정보가 빠지지 않았는지, 병력·신체진찰·vital이 서로 논리적으로 맞는지 한번 더 점검한 뒤 JSON을 출력합니다.
반드시 제공된 json_schema_template를 만족하는 "케이스 데이터 JSON"만 반환하세요. 추가 텍스트를 절대 붙이지 마세요.`;

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

  const { meta, checklist, customPrompt } = parsed.data;

  const systemPrompt = customPrompt?.trim() || DEFAULT_SCENARIO_PROMPT;

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
    } catch (parseErr) {
      logger.warn(`scenario-generate: Invalid JSON from model`, {
        source: "api/scenario-generate",
        stackTrace: parseErr instanceof Error ? parseErr.stack : undefined,
        metadata: { chiefComplaint: meta.chief_complaint, diagnosis: meta.diagnosis },
      });
      return NextResponse.json(
        { error: "Invalid JSON from model", content: raw },
        { status: 500 }
      );
    }

    const merged = deepMerge(virtualPatientTemplate, parsedJson);
    return NextResponse.json({ scenario: merged });
  } catch (error: any) {
    logger.error(`scenario-generate POST failed: ${error?.message}`, {
      source: "api/scenario-generate",
      stackTrace: error instanceof Error ? error.stack : undefined,
      metadata: { chiefComplaint: meta.chief_complaint, diagnosis: meta.diagnosis, name: meta.name },
    });
    return NextResponse.json(
      { error: "Server error", details: error?.message },
      { status: 500 }
    );
  }
}
