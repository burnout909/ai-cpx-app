import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

export async function GET() {
    const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
    if (!OPENAI_API_KEY) {
        return NextResponse.json({ error: "Missing API key" }, { status: 500 });
    }

    try {
        const response = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${OPENAI_API_KEY}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                session: {
                    type: "realtime",
                    model: "gpt-realtime-2025-08-28",
                    audio: {
                        input: {
                            transcription: {
                                language: "ko",
                                "model": "whisper-1"
                            }
                        },
                    },
                },
            }),
        });

        const data = await response.json();
        return NextResponse.json(data);
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error(`realtime-key GET failed: ${msg}`, {
            source: "api/realtime-key",
            stackTrace: err instanceof Error ? err.stack : undefined,
            metadata: {},
        });
        return NextResponse.json({ error: "Failed to fetch from OpenAI" }, { status: 500 });
    }
}
