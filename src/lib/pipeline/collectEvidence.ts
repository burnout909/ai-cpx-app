// src/lib/pipeline/collectEvidence.ts
// Extracted core logic from /api/collectEvidence/route.ts

import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { logger } from "@/lib/logger";
import { retryWithBackoff } from "./retryWithBackoff";
import type OpenAI from "openai";

/* =========================
   Types
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
  id: string;
  title: string;
  criteria: string;
}

export interface EvidenceListItem {
  id: string;
  title?: string;
  criteria?: string;
  evidence: string[];
}

/* =========================
   Helpers
========================= */
export function normalizeTranscriptToText(transcript: TranscriptInput): string {
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

export function normalizeEvidence(x: unknown): string[] {
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

// Structured Output schema (Zod)
const EvidenceSchema = z.object({
  evidenceList: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      criteria: z.string(),
      evidence: z.array(z.string()),
    })
  ),
});

const SYSTEM_PROMPT = `
당신은 한국 의대 CPX 자동 채점기를 위한 "증거 수집기(Evidence Collector)"입니다. 입력으로
(1) 대화 전사 텍스트(의사/환자 발화 구분 없이 시간 순서로 포함)와
(2) 특정 섹션(sectionId)에 해당하는 체크리스트(각 항목: id, title, criteria, example)를 받습니다.
당신의 목표는 각 항목의 criteria를 충족한다고 판단되는 "증거 문장"을 전사문에서 직접 인용으로 수집하여 evidence 배열로 반환하는 것입니다. 이 프롬프트는 병력청취/신체진찰/환자교육/PPI 네 섹션에 모두 사용됩니다(실행 시 sectionId로 주어짐). 다양한 임상 표현형(총 50여개)과 무관하게 동작해야 합니다.

핵심 원칙

1. 의미 동등성 허용: criteria와 문장 구조가 달라도 임상적으로 동등한 의미면 인정합니다(예: "언제부터 아팠나요?" ≈ "통증은 언제 시작되었나요?").
2. 의사/환자 발화 모두 인정: 환자의 자발적 정보 누설(예: 환자가 스스로 과거력을 언급)도 해당 항목의 근거로 인정합니다.
3. 다항목 중복 허용: 같은 문장이 여러 항목의 criteria를 만족하면 각 항목에 중복 인용해도 됩니다.
4. 충분 근거 수집: 한 항목에 해당하는 증거가 여러 개라고 판단이 들면, 2개 이상의 다양한 발화를 근거를 수집하도록 노력합니다. 과도한 중복은 제거합니다.
5. 과거력/음주력/흡연력/식단 등 광범위 항목: 부분 일치라도 임상적 관행상 해당 항목을 충족한다고 판단되면 근거로 인정합니다(예: "고혈압/당뇨/결핵 있으세요?" 중 하나만 물어봐도 '과거력 확인'의 근거가 될 수 있음). 단, 내용 불일치 인용은 절대 금지합니다.
6. 과소평가 방지: 한 문장 안에 다양한 지시 사항이나 질문이 있다면 쪼개서 셈으로서 과소평가를 방지합니다.


출력 형식(절대 준수)
반드시 아래 JSON 스키마만 출력하세요. 불필요한 코멘트/설명/추가 필드는 금지합니다.
{
  "evidenceList":[
    {
      "id": "체크리스트 항목 id",
      "title": "체크리스트 제목",
      "criteria": "체크리스트 평가 기준",
      "evidence": ["전사문에서의 직접 인용 1", "직접 인용 2", ...]
    },
...
  ]
}
`;

/* =========================
   Core function
========================= */
export async function collectEvidenceForSection(
  openai: OpenAI,
  transcriptText: string,
  checklist: EvidenceChecklistItem[],
  sectionId: SectionId,
): Promise<EvidenceListItem[]> {
  const userMsg = {
    transcript: transcriptText,
    evidenceChecklist: checklist,
    sectionId,
  };

  try {
    const resp = await retryWithBackoff(
      () => openai.responses.parse({
        model: "gpt-5.1-2025-11-13",
        input: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: JSON.stringify(userMsg) },
        ],
        text: {
          format: zodTextFormat(EvidenceSchema, "evidence_list_schema"),
        },
        max_output_tokens: 4096,
      }),
      { label: `collectEvidence(${sectionId})` },
    );

    const data = resp.output_parsed;
    return (
      data?.evidenceList?.map((row) => ({
        id: row.id,
        title: String(row.title ?? "").trim(),
        criteria: String(row.criteria ?? "").trim(),
        evidence: normalizeEvidence(row.evidence),
      })) ?? []
    );
  } catch (error) {
    console.error(error);
    logger.warn("gpt-5.1 structured output failed, falling back to gpt-4o-mini", {
      source: "pipeline/collectEvidence",
      stackTrace: error instanceof Error ? error.stack : undefined,
      metadata: { sectionId },
    });

    const fallback = await retryWithBackoff(
      () => openai.chat.completions.create({
        model: "gpt-4o-mini",
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT + "\n반드시 JSON만 출력하세요(마크다운 금지)." },
          { role: "user", content: JSON.stringify(userMsg) },
        ],
        temperature: 0.2,
        max_tokens: 3000,
      }),
      { label: `collectEvidence-fallback(${sectionId})` },
    );

    const parsed = JSON.parse(fallback.choices?.[0]?.message?.content ?? "{}");

    return (parsed?.evidenceList ?? []).map((row: any) => ({
      id: String(row?.id ?? ""),
      title: String(row?.title ?? "").trim(),
      criteria: String(row?.criteria ?? "").trim(),
      evidence: normalizeEvidence(row?.evidence),
    }));
  }
}
