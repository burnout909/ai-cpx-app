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
    id: string;       // e.g., "HX-01"
    title: string;    // display label
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
        return x.map(String).map((s) => s.trim()).filter(Boolean);
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
                { detail: "Invalid payload: transcript, evidenceChecklist, sectionId required." },
                { status: 400 }
            );
        }

        const sys =
            "당신은 한국 의대 CPX 자동 채점기를 위한 '증거 수집기' 역할입니다. " +
            "입력으로 전사 텍스트와 특정 섹션(sectionId)의 체크리스트(각 항목: id, title, criteria)를 받습니다. " +
            "각 항목의 criteria를 충족한다고 판단되는 transcript 내 근거 문장(세그먼트 단위 직접 인용)을 evidence 배열로 반환하세요. " +
            "출력은 반드시 JSON 스키마 형식만 따르세요.";

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

        let contentJSON: string | undefined;
        try {
            const resp = await openai.chat.completions.create({
                model: "o3",
                response_format: { type: "json_schema", json_schema: jsonSchema as any },
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
            (contentJSON && contentJSON.match(/\{[\s\S]*\}$/)?.[0]) || contentJSON || "{}";

        let data: LLMResponseShape;
        try {
            data = JSON.parse(jsonText) as LLMResponseShape;
        } catch {
            data = { evidence: [] };
        }

        // evidence를 항상 배열로 보정
        const finalEvidenceList: EvidenceListItem[] = (data?.evidence ?? []).map((row) => ({
            id: typeof row?.id === "string" ? row.id : "",
            evidence: normalizeEvidence(row?.evidence),
        }));

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
