import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { DEFAULT_COMMENTARY_PROMPT } from "@/constants/defaultPrompts";
import { logger } from "@/lib/logger";

const requestSchema = z.object({
  scenario: z.any(),
  customPrompt: z.string().optional(),
});

const MODEL = process.env.OPENAI_MODEL ?? "gpt-4.1";

const DEFAULT_SYSTEM_PROMPT = DEFAULT_COMMENTARY_PROMPT;

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
    logger.error(`commentary-generate POST failed: ${message}`, {
      source: "api/commentary-generate",
      stackTrace: error instanceof Error ? error.stack : undefined,
      metadata: { hasScenario: !!scenario, hasCustomPrompt: !!customPrompt },
    });
    return NextResponse.json(
      { error: "Server error", details: message },
      { status: 500 }
    );
  }
}
