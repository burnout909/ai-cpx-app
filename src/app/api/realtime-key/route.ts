import { NextResponse } from "next/server";

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
                    model: "gpt-realtime-mini-2025-10-06",
                },
            }),
        });

        const data = await response.json();
        return NextResponse.json(data);
    } catch (err) {
        console.error("❌ Failed to fetch from OpenAI:", err);
        return NextResponse.json({ error: "Failed to fetch from OpenAI" }, { status: 500 });
    }
}
