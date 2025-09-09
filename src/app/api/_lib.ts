import { cookies } from "next/headers";
import OpenAI from "openai";

export const runtime = "nodejs";

export async function getOpenAIKey() {
  const key = process.env.OPENAI_API_KEY || "";
  if (!key) throw new Error("OpenAI API Key가 설정되지 않았습니다.");
  return key;
}

export async function getOpenAIClient() { // ✅ async
  return new OpenAI({ apiKey: await getOpenAIKey() });
}

/** 문자열만 깔끔하게 뽑아내기 (Responses API 우선, Chat fallback) */
export function extractTextFromResponses(resp: any): string {
  const txt = resp?.output_text;
  if (typeof txt === "string" && txt.trim()) return txt.trim();
  const chunks: string[] = [];
  for (const blk of resp?.output ?? []) {
    for (const c of blk?.content ?? []) {
      if (c?.type === "output_text" || c?.type === "text") {
        const t = c?.text?.value ?? c?.text;
        if (typeof t === "string") chunks.push(t);
      }
    }
  }
  return chunks.join("\n").trim();
}
