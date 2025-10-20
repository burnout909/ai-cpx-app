// /app/api/collectEvidence/route.ts
import { NextResponse } from "next/server";
import { getOpenAIClient } from "../_lib";

/* =========================
   Types (DTO)
========================= */
export type SectionId = "history" | "physical_exam" | "education" | "ppi";

export type TranscriptInput =
  | string
  | {
    text?: string;
    segments?: Array<{
      id?: number;
      start?: number;
      end?: number;
      text?: string;
      speaker?: string;
    }>;
  };

export interface EvidenceChecklistItem {
  id: string; // e.g., "HX-01"
  title: string; // display label
  criteria: string; // what to verify in transcript
}

/** Request DTO */
export interface CollectEvidenceRequest {
  transcript: TranscriptInput;
  evidenceChecklist?: EvidenceChecklistItem[];
  sectionId: SectionId; // 섹션 구분
}

export interface EvidenceListItem {
  id: string;
  evidence: string[];
}

/** Success Response DTO */
export interface CollectEvidenceResponse {
  evidenceList: EvidenceListItem[];
}

/** Error Response DTO */
export interface CollectEvidenceError {
  detail: string;
}

/** 내부 LLM 파싱용 */
interface LLMResponseShape {
  evidence: Array<{ id?: unknown; evidence?: unknown }>;
}

/* =========================
   Helpers
========================= */
function normalizeTranscriptToText(transcript: TranscriptInput): string {
  if (typeof transcript === "string") return transcript;
  if (!transcript) return "";
  if (Array.isArray(transcript.segments) && transcript.segments.length > 0) {
    return transcript.segments
      .map((s, idx) => {
        const turn = s?.id ?? idx + 1;
        const who = s?.speaker ? `[${s.speaker}] ` : "";
        const txt = (s?.text ?? "").trim();
        return `Turn ${turn}: ${who}${txt}`;
      })
      .join("\n");
  }
  return transcript.text ?? "";
}

// evidence를 무조건 string[]으로 강제 변환
function normalizeEvidence(x: unknown): string[] {
  if (Array.isArray(x)) {
    return x
      .map(String)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (typeof x === "string") {
    return [x.trim()].filter(Boolean);
  }
  return [];
}

/* =========================
   Route
========================= */
export async function POST(
  req: Request
): Promise<NextResponse<CollectEvidenceResponse | CollectEvidenceError>> {
  try {
    const payload = (await req.json()) as CollectEvidenceRequest;

    const transcriptText = normalizeTranscriptToText(payload?.transcript);
    const evidenceChecklist = payload?.evidenceChecklist ?? [];
    const sectionId = payload?.sectionId;

    if (!transcriptText || !sectionId) {
      return NextResponse.json<CollectEvidenceError>(
        {
          detail:
            "Invalid payload: transcript, evidenceChecklist, sectionId required.",
        },
        { status: 400 }
      );
    }

    const userMsg = {
      transcript: transcriptText,
      sectionId,
      evidence_checklist: evidenceChecklist,
    };

    const openai = await getOpenAIClient();

    const jsonSchema = {
      name: "evidence_list_schema",
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          evidenceList: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                evidence: { type: "array", items: { type: "string" } },
              },
              required: ["id", "evidence"],
              additionalProperties: false,
            },
          },
        },
        required: ["evidenceList"],
      },
      strict: true,
    } as const;

    const sys =
      `당신은 한국 의대 CPX 자동 채점기를 위한 “증거 수집기(Evidence Collector)”입니다. 입력으로 
(1) 대화 전사 텍스트(의사/환자 발화 구분 없이 시간 순서로 포함)와 
(2) 특정 섹션(sectionId)에 해당하는 체크리스트(각 항목: id, title, criteria)를 받습니다. 
당신의 목표는 각 항목의 criteria를 충족한다고 판단되는 “증거 문장”을 전사문에서 직접 인용으로 수집하여 evidence 배열로 반환하는 것입니다. 이 프롬프트는 병력청취/신체진찰/환자교육/PPI 네 섹션에 모두 사용됩니다(실행 시 sectionId로 주어짐). 다양한 임상 표현형(총 50여개)과 무관하게 동작해야 합니다.

출력 형식(절대 준수)
반드시 아래 JSON 스키마만 출력하세요. 불필요한 코멘트/설명/추가 필드는 금지합니다.
[
{
"id": "체크리스트 항목 id",
"evidence": ["전사에서의 직접 인용 1", "직접 인용 2", ...]
},
...
]
evidence에는 0개 이상을 담을 수 있습니다. 문자열은 전사문에서 그대로 따오되, 양끝 불필요 공백만 제거하세요.

핵심 원칙

1. 의미 동등성 허용: criteria와 문장 구조가 달라도 임상적으로 동등한 의미면 인정합니다(예: “언제부터 아팠나요?” ≈ “통증은 언제 시작되었나요?”).
2. 의사/환자 발화 모두 인정: 환자의 자발적 정보 누설(예: 환자가 스스로 과거력을 언급)도 해당 항목의 근거로 인정합니다.
3. 다항목 중복 허용: 같은 문장이 여러 항목의 criteria를 만족하면 각 항목에 중복 인용해도 됩니다.
4. 충분 근거 수집: 한 항목에 해당하는 증거가 여러 개라고 판단이 들면, 2개 이상의 다양한 발화를 근거를 수집하도록 노력합니다. 과도한 중복은 제거합니다.
5. 과거력/사회력 등 광범위 항목: 부분 일치라도 임상적 관행상 해당 항목을 충족한다고 판단되면 근거로 인정합니다(예: “고혈압/당뇨/결핵 있으세요?” 중 하나만 물어봐도 ‘과거력 확인’의 근거가 될 수 있음). 단, 내용 불일치 인용은 절대 금지합니다.
6. 과소/과대평가 방지: 한 문장 안의 다중 지시·정보는 쪼개서 셉니다(과소평가 방지). 반대로 의미가 같은 반복 질문은 하나로 칩니다(과대평가 방지).

증거 추출 절차(반드시 이 순서로 수행)
1. 입력 파악

* sectionId ∈ {history, physicalExam, education, ppi} 가 제공됩니다.
* checklist: [{id, title, criteria}, ...]
* transcript: 시간 순서의 두 명의 대화이며 의사/환자 구분이 되어 있지 않습니다. 문장부호가 불완전할 수 있습니다.

2. “미세 증거 단위(MEU)”로 세분화

* 기본 분할: “.”, “?”, “!” 및 한국어 연결어(그리고/고요/해서/하셔서/하시고/며/면서/지만 등)로 의미가 바뀌는 접속/연결 앞에서 분할.
* 나열 분할: 쉼표/‘그리고’/‘첫째·둘째·셋째’/‘~하시고요’로 나열된 서로 다른 지시·사실·질문은 각각 별도의 MEU로 분할.
* 예시(환자교육 전사): “먼저 실신할 것 같으시면 안전한 곳으로 이동하시고요, 주변 분들에게 머리 다치지 않게 받쳐달라고 알려주세요.”
  → MEU1: “실신할 것 같으면 안전한 곳으로 이동”
  → MEU2: “주변 사람들에게 머리 다치지 않게 받쳐 달라 알리기”
* 예시(중복 질문): “배가 어디가 아프시다 했죠? 어디가 아픈지 짚어보시겠어요?”
  → 의미 동일 판단 시 MEU 하나로 통합(아래 3단계).

3. 중복·반복 통합(De-duplication)

* 동일 의미 반복 규칙: 같은 화자 또는 문맥상 연속 구간에서 의미가 실질적으로 동일한 질문/지시/사실 진술은 하나의 MEU로만 유지.
* 유사도 판단: 동의어나 어순만 바뀐 경우, 의도·대상·임상적 기능(예: “통증 위치 확인”)이 동일하면 중복으로 간주.
* Q/A 결합 우선: “질문 MEU”와 그에 대한 즉시 응답 MEU가 페어인 경우, 둘 다 근거가 될 수 있으나 중복 카운트는 피합니다(아래 4단계 매핑에서 필요 시 둘 다 선택).

4. 체크리스트 매핑(Strict but fair)

* 각 MEU를 모든 criteria와 대조하여 의미 일치 시 후보로 등록.
* 내용 불일치 금지: criteria에 없는 개념을 억지로 끼워 맞추지 마세요.
* 부정/부재의 정확 처리: “없어요/아니요”는 ‘해당 증상/과거력 부재 확인’의 근거가 될 수 있습니다.
* 같은 의미의 표현이 여러 번 등장하면 가장 명확하고 온전한 한 번만 선택.
* 부분 일치 판정 규칙(예: 과거력/사회력/전신증상 묶음 항목):
  • 묶음 항목의 하위 요소 중 일부만 다뤄도 “해당 항목을 확인하려는 시도”로 인정.
  • 단, 내용 불일치(예: criteria가 ‘방사통’인데 단순 위치 질문만 한 경우)는 제외.
* 섹션별 유의:
  • history: 가급적이면 질문/응답 모두 하나의 MEU로 묶어서 evidence로 정리. 수치·기간·부위·양상·악화/완화 요인 등은 각각 독립 MEU. 
  • physicalExam: 순서/자세/기술(시진→청진→타진→촉진, 무릎 세우기 등)을 각각 MEU로 분할. 검사명 언급 없이 ‘들어볼게요/눌러볼게요’도 해당 검사 시행의 근거로 인정.
  • education: 하나의 발화에 다중 생활지도/검사·치료 계획/경고 사인이 섞여 있으면 각각 MEU로 분리(과소평가 방지).
  • ppi: 자기소개, 환자확인, 공감, 동의, 중간요약, 이해도 확인, 질문 기회 제공 등은 표현 다양성을 폭넓게 인정.
* 다중 항목 매핑 허용: 한 MEU가 여러 항목 criteria에 부합하면 모든 해당 항목의 후보에 올립니다.

5. 출력

* 각 checklist 항목마다 {id, evidence[]}를 생성합니다.
* evidence 배열에는 선택된 MEU “직접 인용 문자열”만 넣습니다(설명·근거유형·스코어 금지).
* 항목 순서는 원래 checklist 순서를 유지하고, evidence 내부는 시간 순으로 정렬합니다.

세부 판정 가이드(빈출 유형)

* 위치 확인(예: “어디가 아픈지 짚어보실까요?”) ↔ 환자 지시 준수(”이쪽이요”) 모두 근거 가능.
* 시간적 특성(시작 시점/지속/주기/과거 발생): “오늘 아침부터”, “예전에 두 번” 등 각각 MEU.
* 양상: “쥐어짜는 듯”, “찌릿찌릿”, “칼로 베는 듯” 등은 모두 양상 근거.
* 강도·영향: “0~10 중 6점”, “일상 지장”은 별도 MEU.
* 악화/완화: 음식/자세/운동/기침/알코올 등은 각각 MEU.
* 전신 증상: 열/오한/체중 변화/피로 각각 MEU.
* 동반 증상: 식욕/구역·구토/변비·설사/혈변/황달 등 각각 MEU.
* 과거력/약물/사회력/가족력/수술·입원력: 하위 요소 일부만 있어도 항목 인정하되, 서로 다른 하위 요소는 서로 다른 MEU.
* 신체진찰: “무릎 세워 눕히기”, “시진”, “청진”, “타진”, “촉진”, “반발통”, “간/비장 촉진”, “CVAT”, “충수 징후들” 각각 MEU.
* 환자교육: 원인·검사 필요성·치료 계획·생활습관·경고 사인·재방문/입원 필요성은 각각 MEU. 하나의 긴 문장에 섞여 있으면 반드시 분할하여 2개 이상으로 수집.
* PPI: 자기소개/환자확인/일상적 배려/공감/중간요약/진찰 전 설명·동의/진찰 후 배려/환자 걱정 파악/쉬운 설명/이해도 확인/질문 기회 제공은 표현 다양성을 넓게 인정.


출력 예시(형식 예; 실제 항목/문장은 입력에 맞춰 재구성)
[
{
"id": "HX-02",
"evidence": ["어디가 아픈지 한번 손을 정확히 짚어보실까요?"]
},
{
"id": "HX-03",
"evidence": ["언제부터 배가 아프셨나요?", "예전에도 이런 적이 있었나요?", "아침부터 계속 그랬어요"]
},
{
"id": "ED-05",
"evidence": ["술은 이러한 증상을 악화시킬 수 있어 가능하면 드시지 않는 게 좋습니다", "커피 또한 증상을 악화시킬 수 있어 웬만하면 피해주세요"]
}
]

주의

* 위 “출력 예시”는 형식만 보여주기 위한 것이며, 실제 실행에서는 반드시 제공된 checklist의 id 순서에 맞춰 결과를 생성하세요.
* JSON 외 다른 텍스트는 출력하지 마세요.
’’’json`

    let contentJSON: string | undefined;
    try {
      const resp = await openai.chat.completions.create({
        model: "gpt-5-2025-08-07",
        response_format: {
          type: "json_schema",
          json_schema: jsonSchema as any,
        },
        messages: [
          { role: "system", content: sys },
          { role: "user", content: JSON.stringify(userMsg) },
        ],
        temperature: 0,
        max_tokens: 3000,
      });
      contentJSON = resp.choices?.[0]?.message?.content ?? "";
    } catch {
      const resp = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: sys + "\n반드시 JSON만 출력하세요." },
          { role: "user", content: JSON.stringify(userMsg) },
        ],
        temperature: 0.2,
        max_tokens: 3000,
      });
      contentJSON = resp.choices?.[0]?.message?.content ?? "";
    }

    const jsonText =
      (contentJSON && contentJSON.match(/\{[\s\S]*\}$/)?.[0]) ||
      contentJSON ||
      "{}";

    let data: LLMResponseShape;
    try {
      data = JSON.parse(jsonText) as LLMResponseShape;
    } catch {
      data = { evidence: [] };
    }

    // evidence를 항상 배열로 보정
    const finalEvidenceList: EvidenceListItem[] = (data?.evidence ?? []).map(
      (row) => ({
        id: typeof row?.id === "string" ? row.id : "",
        evidence: normalizeEvidence(row?.evidence),
      })
    );

    return NextResponse.json<CollectEvidenceResponse>({
      evidenceList: finalEvidenceList,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json<CollectEvidenceError>(
      { detail: `collectEvidence failed: ${msg}` },
      { status: 500 }
    );
  }
}
