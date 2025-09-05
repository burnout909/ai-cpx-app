import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { openai_api_key } = (await req.json()) as { openai_api_key?: string };
    if (!openai_api_key || typeof openai_api_key !== "string") {
      return NextResponse.json(
        { ok: false, message: "유효한 키를 입력하세요." },
        { status: 400 }
      );
    }

    const res = NextResponse.json({ ok: true });
    res.cookies.set("openai_api_key", openai_api_key, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24, // 1 day
    });
    return res;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, message: msg }, { status: 500 });
  }
}
