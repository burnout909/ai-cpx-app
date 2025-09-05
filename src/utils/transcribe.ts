export function floatTo16BitPCM(input: Float32Array) {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return output;
}

export function audioBufferToWav(abuf: AudioBuffer) {
  const numChannels = 1; // mono
  const sampleRate = abuf.sampleRate;
  const channelData = abuf.getChannelData(0);
  const pcm16 = floatTo16BitPCM(channelData);
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = pcm16.length * bytesPerSample;

  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  // RIFF header
  let offset = 0;
  function writeString(s: string) {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
    offset += s.length;
  }

  writeString("RIFF");
  view.setUint32(offset, 36 + dataSize, true); offset += 4;
  writeString("WAVE");

  // fmt chunk
  writeString("fmt ");
  view.setUint32(offset, 16, true); offset += 4; // PCM chunk size
  view.setUint16(offset, 1, true); offset += 2;  // audio format=1 (PCM)
  view.setUint16(offset, numChannels, true); offset += 2;
  view.setUint32(offset, sampleRate, true); offset += 4;
  view.setUint32(offset, byteRate, true); offset += 4;
  view.setUint16(offset, blockAlign, true); offset += 2;
  view.setUint16(offset, 16, true); offset += 2; // bits per sample

  // data chunk
  writeString("data");
  view.setUint32(offset, dataSize, true); offset += 4;

  // PCM samples
  new Int16Array(buffer, 44).set(pcm16);

  return new Blob([buffer], { type: "audio/wav" });
}

export async function transcodeToWav16kMono(inputFile: File): Promise<File> {
  // 1) 브라우저가 m4a를 디코드할 수 있는지: 보통 가능(AAC)
  const arrayBuffer = await inputFile.arrayBuffer();
  const audioCtx = new AudioContext();
  const decoded = await audioCtx.decodeAudioData(arrayBuffer); // AudioBuffer (원 샘플레이트/채널)

  // 2) OfflineAudioContext로 16kHz mono 렌더링
  const targetSampleRate = 16000;
  const offline = new OfflineAudioContext({
    numberOfChannels: 1,
    length: Math.ceil((decoded.duration || 0) * targetSampleRate),
    sampleRate: targetSampleRate,
  });

  const src = offline.createBufferSource();
  // downmix: 여러 채널이면 자동으로 mono로 섞이도록 연결
  // (source → destination 연결 시 채널 수가 다르면 표준 downmix가 적용됨)
  src.buffer = decoded;
  src.connect(offline.destination);
  src.start();

  const rendered = await offline.startRendering(); // AudioBuffer @16k mono

  // 3) WAV로 포맷팅
  const wavBlob = audioBufferToWav(rendered);
  // 4) File로 감싸서 반환
  return new File([wavBlob], (inputFile.name || "audio").replace(/\.[^.]+$/, "") + ".wav", { type: "audio/wav" });
}
