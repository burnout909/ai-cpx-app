// src/lib/pipeline/transcribe.ts
// Extracted core logic from /api/transcribe/route.ts

import { toFile } from "openai/uploads";
import { extname } from "path";
import { generateDownloadUrl } from "@/app/api/s3/s3";
import type OpenAI from "openai";

export interface TranscribeSegment {
  id: number;
  start: number;
  end: number;
  text: string;
}

export interface TranscribeResult {
  segments: TranscribeSegment[];
  text: string;
}

interface WhisperVerbose {
  text?: string;
  segments?: Array<{ start?: number; end?: number; text?: string }>;
}

export function guessMimeByExt(name: string, fallback?: string): string {
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

export async function transcribeFromS3(
  openai: OpenAI,
  s3Key: string,
  bucket: string,
): Promise<TranscribeResult> {
  const presignedUrl = await generateDownloadUrl(bucket, s3Key);
  const audioRes = await fetch(presignedUrl);
  if (!audioRes.ok) throw new Error("S3 파일 다운로드 실패");

  const audioBlob = await audioRes.blob();
  const arrayBuffer = await audioBlob.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const filename = s3Key.split("/").pop() || "audio.mp3";
  const type = guessMimeByExt(filename, audioBlob.type);

  const file = await toFile(buffer, filename, { type });

  const tr = (await openai.audio.transcriptions.create({
    model: "whisper-1",
    file,
    response_format: "verbose_json",
  })) as unknown as WhisperVerbose;

  const segments: TranscribeSegment[] =
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

  return { segments, text };
}
