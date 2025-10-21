'use client';

import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

let ffmpeg: FFmpeg | null = null;

/**
 * Blob → 표준화된 고품질 MP3로 변환 (브라우저/Next.js 호환)
 */
export async function standardizeToMP3(fileBlob: Blob): Promise<Blob> {
    // FFmpeg 초기화 (한 번만)
    if (!ffmpeg) {
        ffmpeg = new FFmpeg();
        await ffmpeg.load();
    }

    const inputName = 'input';
    const outputName = 'output.mp3';

    // 입력 파일 로드
    const fileData = await fetchFile(fileBlob);
    await ffmpeg.writeFile(inputName, fileData);

    // 변환 실행
    await ffmpeg.exec([
        '-i', inputName,
        '-vn',
        '-acodec', 'libmp3lame',
        '-q:a', '0',
        '-ar', '48000',
        '-ac', '2',
        outputName,
    ]);

    // 변환 결과 읽기
    const mp3Data = await ffmpeg.readFile(outputName);

    if (typeof mp3Data === 'string') {
        throw new Error('Unexpected string output from ffmpeg.readFile()');
    }

    // 타입 안전 변환 (핵심 부분)
    // Uint8Array → ArrayBuffer (slice로 SharedArrayBuffer 방지)
    const safeBuffer = mp3Data.slice().buffer as ArrayBuffer;

    // Blob 생성
    const mp3Blob = new Blob([safeBuffer], { type: 'audio/mpeg' });

    return mp3Blob;
}
