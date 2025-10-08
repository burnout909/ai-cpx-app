import { NextResponse } from "next/server";
import { getOpenAIClient } from "../_lib";
import { toFile } from "openai/uploads";
import { extname } from "path";
import { generateDownloadUrl } from "../s3/s3";

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
    // 클라이언트에서 JSON으로 s3_key 받기
    const { s3_key } = await req.json();
    if (!s3_key) {
      return NextResponse.json({ detail: "s3_key is required" }, { status: 400 });
    }

    const bucket = process.env.NEXT_PUBLIC_S3_BUCKET_NAME!;
    const presignedUrl = await generateDownloadUrl(bucket, s3_key);
    // ✅ S3에서 오디오 파일 다운로드
    const audioRes = await fetch(presignedUrl);
    if (!audioRes.ok) throw new Error("S3 파일 다운로드 실패");
    const audioBlob = await audioRes.blob();
    const arrayBuffer = await audioBlob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const filename = s3_key.split("/").pop() || "audio.mp3";
    const type = guessMimeByExt(filename, audioBlob.type);
    
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
