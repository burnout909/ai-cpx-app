import { NextResponse } from "next/server";
import { getOpenAIClient } from "../_lib";
import { toFile } from "openai/uploads";
import { extname } from "path";

export const runtime = "nodejs";
export const maxDuration = 60;

// ---- Types ----
interface WhisperSegment {
  start?: number;
  end?: number;
  text?: string;
}

interface WhisperVerbose {
  text?: string;
  segments?: WhisperSegment[];
}

interface ApiSegment {
  id: number;
  start: number;
  end: number;
  text: string;
}

// ---- Utils ----
function guessMimeByExt(name: string, fallback?: string): string {
  const ext = (extname(name || "").slice(1) || "").toLowerCase();
  if (ext === "m4a") return "audio/m4a";
  if (ext === "mp3") return "audio/mpeg";
  if (ext === "wav") return "audio/wav";
  if (ext === "ogg" || ext === "oga") return "audio/ogg";
  if (ext === "webm") return "audio/webm";
  if (ext === "mp4") return "audio/mp4";
  if (ext === "flac") return "audio/flac";
  return fallback || "application/octet-stream";
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const audio = form.get("audio");

    if (!(audio instanceof Blob)) {
      return NextResponse.json({ detail: "audio 파일이 필요합니다." }, { status: 400 });
    }

    const asFile = audio instanceof File ? audio : undefined;
    const filename = asFile?.name || "audio.wav"; // (클라에서 변환됐으면 .wav일 가능성 높음)
    const buffer = Buffer.from(await audio.arrayBuffer());
    const type = guessMimeByExt(filename, asFile?.type || undefined);

    const openai = await getOpenAIClient();
    const file = await toFile(buffer, filename, { type });

    const tr = (await openai.audio.transcriptions.create({
      model: "whisper-1",
      file,
      response_format: "verbose_json",
    })) as unknown as WhisperVerbose;

    const segments: ApiSegment[] =
      (tr.segments ?? []).map((s, i) => ({
        id: i + 1,
        start: Number(s.start ?? 0),
        end: Number(s.end ?? 0),
        text: String(s.text ?? "").trim(),
      })) ?? [];

    const text =
      segments.length > 0
        ? segments.map((s) => s.text).join("\n")
        : String(tr.text ?? "").trim();

    return NextResponse.json({ backend: "openai", segments, text });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ detail: `Transcribe failed: ${msg}` }, { status: 500 });
  }
}
