'use client';

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

let ffmpeg: FFmpeg | null = null;

async function getFfmpegInstance(): Promise<FFmpeg> {
    if (!ffmpeg) {
        ffmpeg = new FFmpeg();
        await ffmpeg.load();
    }
    return ffmpeg;
}

function toBlob(data: Uint8Array, type: string) {
    const safeBuffer = data.slice().buffer as ArrayBuffer;
    return new Blob([safeBuffer], { type });
}

/**
 * Blob → 표준화된 고품질 MP3로 변환 (브라우저/Next.js 호환)
 */
export async function standardizeToMP3(fileBlob: Blob): Promise<Blob> {
    const ff = await getFfmpegInstance();
    const inputName = `input-${Date.now()}`;
    const outputName = `output-${Date.now()}.mp3`;

    const fileData = await fetchFile(fileBlob);
    await ff.writeFile(inputName, fileData);

    await ff.exec([
        '-i', inputName,
        '-vn',
        '-acodec', 'libmp3lame',
        '-q:a', '0',
        '-ar', '48000',
        '-ac', '2',
        outputName,
    ]);

    const mp3Data = await ff.readFile(outputName);
    if (typeof mp3Data === 'string') {
        throw new Error('Unexpected string output from ffmpeg.readFile()');
    }

    return toBlob(mp3Data, 'audio/mpeg');
}

export async function getAudioDurationInSeconds(fileBlob: Blob): Promise<number> {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(fileBlob);
        const audio = new Audio();
        audio.preload = 'metadata';
        audio.onloadedmetadata = () => {
            URL.revokeObjectURL(url);
            resolve(audio.duration);
        };
        audio.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Failed to read audio metadata'));
        };
        audio.src = url;
    });
}

/**
 * 8분 초과 → 2개, 12분 초과 → 3개로 분할. (그 외 단일 파일)
 */
export async function splitMp3ByDuration(mp3Blob: Blob, durationSec?: number): Promise<{ parts: Blob[]; partCount: number; durationSec: number }> {
    const totalDuration = durationSec ?? await getAudioDurationInSeconds(mp3Blob);
    const partCount = totalDuration > 12 * 60
        ? 3
        : totalDuration > 8 * 60
            ? 2
            : 1;

    if (partCount === 1) {
        return { parts: [mp3Blob], partCount, durationSec: totalDuration };
    }

    const ff = await getFfmpegInstance();
    const inputName = `split-input-${Date.now()}.mp3`;
    await ff.writeFile(inputName, await fetchFile(mp3Blob));

    const segmentLength = Math.ceil(totalDuration / partCount);
    const parts: Blob[] = [];

    for (let i = 0; i < partCount; i += 1) {
        const start = i * segmentLength;
        const remaining = Math.max(totalDuration - start, 0);
        if (remaining <= 0.5) break; // 남은 구간이 사실상 없으면 중단

        const durationForPart = i === partCount - 1
            ? remaining
            : segmentLength;

        const outputName = `split-output-${Date.now()}-${i}.mp3`;
        await ff.exec([
            '-ss', `${start}`,
            '-t', `${durationForPart}`,
            '-i', inputName,
            '-acodec', 'libmp3lame',
            '-q:a', '0',
            '-ar', '48000',
            '-ac', '2',
            outputName,
        ]);

        const chunkData = await ff.readFile(outputName);
        if (typeof chunkData === 'string') {
            throw new Error('Unexpected string output from ffmpeg.readFile() for split chunk');
        }
        parts.push(toBlob(chunkData, 'audio/mpeg'));
    }

    return { parts, partCount: parts.length, durationSec: totalDuration };
}
