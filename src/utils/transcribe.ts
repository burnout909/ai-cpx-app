export function floatTo16BitPCM(input: Float32Array) {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return output;
}


/**
 * 브라우저에서 File(Audio: m4a/mp3/wav 등)을 16kHz 모노 WAV로 트랜스코딩
 * - decode 실패/브라우저 호환(webkitAudioContext) 처리
 * - OfflineAudioContext로 리샘플/다운믹스
 * - 선택적 peak 정규화(클리핑 방지)
 * - AbortSignal 지원(취소 가능)
 */
export async function transcodeToWav16kMono(
  inputFile: File,
  opts: {
    normalize?: boolean;   // true면 피크 정규화
    targetPeak?: number;   // 정규화 목표 피크(0~1), 기본 0.98
    signal?: AbortSignal;  // 취소 시그널
  } = {}
): Promise<File> {
  const { normalize = true, targetPeak = 0.98, signal } = opts;

  // 취소 체크
  if (signal?.aborted) throw new DOMException("Operation aborted", "AbortError");
  const onAbort = () => { throw new DOMException("Operation aborted", "AbortError"); };
  signal?.addEventListener("abort", onAbort, { once: true });

  // 1) 파일 디코드 (WebAudio)
  const arrayBuffer = await inputFile.arrayBuffer();

  // Safari 호환 (webkitAudioContext)
  const AudioContextCtor: typeof AudioContext =
    (window as any).AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextCtor) {
    throw new Error("WebAudio AudioContext를 사용할 수 없습니다.");
  }

  const audioCtx = new AudioContextCtor();
  try {
    // iOS 사파리 등: decode 전에 resume 필요할 수 있음(무해)
    if (audioCtx.state === "suspended") {
      await audioCtx.resume().catch(() => { });
    }

    const decoded: AudioBuffer = await safeDecodeAudioData(audioCtx, arrayBuffer);

    // 2) OfflineAudioContext로 16kHz 모노 리샘플/다운믹스
    const targetSampleRate = 16000;
    const length = Math.max(1, Math.ceil(decoded.duration * targetSampleRate));
    const offline = new OfflineAudioContext({
      numberOfChannels: 1,
      length,
      sampleRate: targetSampleRate,
    });

    const src = offline.createBufferSource();
    src.buffer = decoded;              // 채널 수 달라도 연결 시 자동 downmix 규격 적용
    src.connect(offline.destination);
    src.start();

    const rendered = await offline.startRendering(); // 16kHz, 1ch AudioBuffer

    // 3) (선택) 정규화 — 클리핑 방지 + 볼륨 확보
    const normalizedBuffer =
      normalize ? normalizePeak(rendered, targetPeak) : rendered;

    // 4) WAV로 인코딩(16-bit PCM)
    const wavBlob = audioBufferToWav(normalizedBuffer);
    const outName =
      (inputFile.name || "audio").replace(/\.[^.]+$/, "") + ".wav";

    return new File([wavBlob], outName, { type: "audio/wav" });
  } finally {
    // 리소스 정리
    try { await audioCtx.close(); } catch { }
    signal?.removeEventListener("abort", onAbort);
  }
}

/** decodeAudioData 브라우저 차이 안전 래퍼 */
async function safeDecodeAudioData(ctx: BaseAudioContext, data: ArrayBuffer): Promise<AudioBuffer> {
  // 최신 크롬/파폭은 promise 반환, 사파리는 콜백 버전 필요할 수 있음
  // @ts-ignore - 타입 불일치 무시
  if (ctx.decodeAudioData.length === 1) {
    // promise style
    return await (ctx as AudioContext).decodeAudioData(data);
  }
  return await new Promise<AudioBuffer>((resolve, reject) => {
    // @ts-ignore - 콜백 시그니처
    ctx.decodeAudioData(
      data,
      (buf: AudioBuffer) => resolve(buf),
      (err: any) => reject(err || new Error("decodeAudioData failed"))
    );
  });
}

/** 피크 정규화: 최대 절대값을 targetPeak로 맞춤(클리핑 방지) */
function normalizePeak(buffer: AudioBuffer, targetPeak = 0.98): AudioBuffer {
  const ch = 0; // mono 보장
  const input = buffer.getChannelData(ch);
  let peak = 0;
  for (let i = 0; i < input.length; i++) {
    const v = Math.abs(input[i]);
    if (v > peak) peak = v;
  }
  if (!peak || peak <= 0) return buffer; // 무음/NaN 방지

  const gain = Math.min(1, targetPeak / peak);
  if (Math.abs(gain - 1) < 1e-6) return buffer; // 실질 변화 없으면 복사 비용 절약

  // 새 버퍼에 적용
  const out = new AudioBuffer({
    numberOfChannels: 1,
    length: buffer.length,
    sampleRate: buffer.sampleRate,
  });
  const o = out.getChannelData(0);
  for (let i = 0; i < input.length; i++) {
    o[i] = input[i] * gain;
  }
  return out;
}

/** AudioBuffer → 16-bit PCM WAV Blob (RIFF/WAVE, mono) */
function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = 1; // mono
  const sampleRate = buffer.sampleRate;
  const samples = buffer.getChannelData(0);
  const bytesPerSample = 2; // 16-bit
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples.length * bytesPerSample;
  const headerSize = 44;
  const totalSize = headerSize + dataSize;

  const buf = new ArrayBuffer(totalSize);
  const view = new DataView(buf);

  let offset = 0;
  // "RIFF"
  writeString(view, offset, "RIFF"); offset += 4;
  view.setUint32(offset, 36 + dataSize, true); offset += 4; // file size - 8
  writeString(view, offset, "WAVE"); offset += 4;

  // fmt chunk
  writeString(view, offset, "fmt "); offset += 4;
  view.setUint32(offset, 16, true); offset += 4;          // PCM chunk size
  view.setUint16(offset, 1, true); offset += 2;           // PCM format
  view.setUint16(offset, numChannels, true); offset += 2; // channels
  view.setUint32(offset, sampleRate, true); offset += 4;  // sample rate
  view.setUint32(offset, byteRate, true); offset += 4;    // byte rate
  view.setUint16(offset, blockAlign, true); offset += 2;  // block align
  view.setUint16(offset, 16, true); offset += 2;          // bits per sample

  // data chunk
  writeString(view, offset, "data"); offset += 4;
  view.setUint32(offset, dataSize, true); offset += 4;

  // samples: float(-1..1) → int16 LE (간단 클리핑 + 양자화)
  for (let i = 0; i < samples.length; i++, offset += 2) {
    let s = Math.max(-1, Math.min(1, samples[i]));
    // 가벼운 TPDF dither를 원하면 아래 2줄 추가:
    // s += (Math.random() - Math.random()) * (1 / 32768);
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
  }

  return new Blob([view], { type: "audio/wav" });
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
}
