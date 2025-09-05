"use client";

import { transcodeToWav16kMono } from "@/utils/transcribe";
import { useEffect, useRef, useState } from "react";

export default function Page() {
  // 설정
  const [openaiKey, setOpenaiKey] = useState("");
  const [setStatus, setSetStatus] = useState("");

  // 전사
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [transStatus, setTransStatus] = useState("");
  const [transcriptText, setTranscriptText] = useState("");

  // 클린업
  const [cleanupStatus, setCleanupStatus] = useState("");
  const [cleanText, setCleanText] = useState("");

  // 체크리스트
  const [checkerJson, setCheckerJson] = useState("");
  const [checkerStatus, setCheckerStatus] = useState("");

  // 채점
  const [scoreStatus, setScoreStatus] = useState("");
  const [gradingJson, setGradingJson] = useState("");
  const [summaryHtml, setSummaryHtml] = useState<string>("");

  // Auto-resize helpers
  const refTranscript = useRef<HTMLTextAreaElement | null>(null);
  const refClean = useRef<HTMLTextAreaElement | null>(null);
  const refChecker = useRef<HTMLTextAreaElement | null>(null);
  const refGrading = useRef<HTMLTextAreaElement | null>(null);

  function autoResize(el: HTMLTextAreaElement | null) {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200000) + "px";
  }

  useEffect(() => { autoResize(refTranscript.current); }, [transcriptText]);
  useEffect(() => { autoResize(refClean.current); }, [cleanText]);
  useEffect(() => { autoResize(refChecker.current); }, [checkerJson]);
  useEffect(() => { autoResize(refGrading.current); }, [gradingJson]);

  async function readJsonOrText(res: Response): Promise<any> {
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      try { return await res.json(); } catch { return null; }
    }
    try { return await res.text(); } catch { return null; }
  }

  function ensureOkOrThrow(res: Response, data: any) {
    if (!res.ok) {
      const message = typeof data === "string" && data
        ? data
        : (data?.detail || data?.message || `${res.status} ${res.statusText}`);
      throw new Error(message);
    }
  }

  async function saveConfig() {
    try {
      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ openai_api_key: openaiKey }),
      });
      const data = await readJsonOrText(res);
      ensureOkOrThrow(res, data);
      setSetStatus("✅ 설정이 저장되었습니다.");
    } catch (e: any) {
      setSetStatus(`❌ ${e.message || e}`);
    }
  }

  async function doTranscribe() {
    if (!audioFile) {
      setTransStatus("오디오를 선택하세요.");
      return;
    }
    setTransStatus("전사 중...");

    try {
      let toSend: File = audioFile;

      // m4a면 브라우저에서 16kHz mono WAV로 변환
      const isM4A = /\.m4a$/i.test(audioFile.name) || /audio\/x-m4a|audio\/m4a/i.test(audioFile.type);
      if (isM4A) {
        try {
          toSend = await transcodeToWav16kMono(audioFile);
        } catch (e) {
          console.warn("m4a 변환 실패, 원본으로 시도:", e);
        }
      }

      const fd = new FormData();
      fd.append("audio", toSend);

      const res = await fetch("/api/transcribe", { method: "POST", body: fd });
      const data = await readJsonOrText(res);
      ensureOkOrThrow(res, data);

      const text = (typeof data === "string") ? "" : (data?.text || "");
      setTranscriptText(text);
      setTransStatus("✅ 전사 완료 (화자표기는 클린업에서 반영)");
    } catch (e: any) {
      setTransStatus(`❌ 실패: ${e.message || e}`);
    }
  }

  async function doCleanup() {
    setCleanupStatus("클린업 중...");
    try {
      const res = await fetch("/api/cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: transcriptText }),
      });
      const data = await readJsonOrText(res);
      ensureOkOrThrow(res, data);
      const txt = (typeof data === "string") ? transcriptText : (data?.text || "");
      setCleanText(txt);
      setCleanupStatus("✅ 클린업 완료");
    } catch (e: any) {
      setCleanupStatus(`⚠️ 클린업 경고: ${e.message || e}`);
      setCleanText(transcriptText);
    }
  }

  async function loadSampleChecker() {
    setCheckerStatus("로딩...");
    try {
      const res = await fetch("/api/sample-checker");
      const data = await readJsonOrText(res);
      ensureOkOrThrow(res, data);
      setCheckerJson(JSON.stringify(data, null, 2));
      setCheckerStatus("✅ 체크리스트 로드됨");
    } catch (e: any) {
      setCheckerStatus(`❌ 실패: ${e.message || e}`);
    }
  }

  async function doScore() {
    setScoreStatus("채점 중...");
    try {
      const checker = checkerJson ? JSON.parse(checkerJson) : null;
      const res = await fetch("/api/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: cleanText || transcriptText, checker }),
      });
      const data = await readJsonOrText(res);
      ensureOkOrThrow(res, data);
      const payload = (typeof data === "string") ? {} : (data || {});
      setGradingJson(JSON.stringify(payload, null, 2));
      const total = (payload as any)?.scores?.total ?? 0;
      const dom = (payload as any)?.scores?.domain ?? {};
      const list = Object.entries(dom).map(([k, v]: any) =>
        `<li>${k}: raw ${v.raw?.toFixed(2)} → weighted ${v.weighted?.toFixed(2)}</li>`
      ).join("");
      setSummaryHtml(`<h3 class="font-semibold">총점: ${total} / 100</h3><ul class="list-disc pl-5 space-y-1">${list}</ul>`);
      setScoreStatus("✅ 채점 완료");
    } catch (e: any) {
      setScoreStatus(`❌ 채점 실패: ${e.message || e}`);
    }
  }

  async function downloadPdf() {
    try {
      const checker = checkerJson ? JSON.parse(checkerJson) : null;
      const grading = gradingJson ? JSON.parse(gradingJson) : null;
      const res = await fetch("/api/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checker, grading }),
      });
      if (!res.ok) {
        const err = await readJsonOrText(res);
        const msg = typeof err === "string" ? err : (err?.detail || `HTTP ${res.status}`);
        throw new Error(msg);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "ai-cpx-report.pdf"; a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert(`PDF 실패: ${e.message || e}`);
    }
  }

  const commonCard = "rounded-2xl border bg-white/60 dark:bg-zinc-900/60 border-zinc-200 dark:border-zinc-800 p-6 shadow-sm";
  const labelCls = "block text-sm font-medium text-zinc-700 dark:text-zinc-300";
  const inputCls = "mt-2 w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none ring-0 focus:border-zinc-500";
  const btnCls = "inline-flex items-center gap-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 active:translate-y-px transition";
  const primaryBtn = "inline-flex items-center gap-2 rounded-lg bg-zinc-900 text-white px-3 py-2 text-sm hover:bg-black/90 active:translate-y-px transition";
  const badge = "inline-flex items-center rounded-md bg-zinc-100 dark:bg-zinc-800 px-2 py-1 text-xs text-zinc-700 dark:text-zinc-300";

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-white dark:from-black dark:to-zinc-950 text-zinc-900 dark:text-zinc-100">
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">ai-cpx — CPX 자동 채점 데모</h1>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">전사 → 클린업 → 체크리스트 → 채점 → PDF</p>
        </header>

        {/* 설정 */}
        <section className={`${commonCard} mb-6`}>
          <h2 className="text-lg font-semibold">설정</h2>
          <div className="mt-4">
            <label className={labelCls}>OpenAI API Key</label>
            <input
              className={inputCls}
              type="password"
              placeholder="sk-..."
              value={openaiKey}
              onChange={(e) => setOpenaiKey(e.target.value)}
            />
            <div className="mt-3 flex items-center gap-2">
              <button className={primaryBtn} onClick={saveConfig}>설정 저장</button>
              {setStatus && <span className={`${badge}`}>{setStatus}</span>}
            </div>
          </div>
        </section>

        {/* 전사 */}
        <section className={`${commonCard} mb-6`}>
          <h2 className="text-lg font-semibold">전사 & 텍스트 기반 화자표기</h2>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              className="block w-full cursor-pointer text-sm file:mr-3 file:rounded-md file:border file:border-zinc-300 dark:file:border-zinc-700 file:bg-white dark:file:bg-zinc-900 file:px-3 file:py-2 file:text-sm file:text-zinc-900 dark:file:text-zinc-100 hover:file:bg-zinc-50 dark:hover:file:bg-zinc-800"
              type="file"
              accept="audio/*"
              onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
            />
            <button className={btnCls} onClick={doTranscribe}>전사 실행</button>
            {transStatus && <span className={badge}>{transStatus}</span>}
          </div>

          <div className="mt-4">
            <label className={labelCls}>원문 전사</label>
            <textarea
              ref={refTranscript}
              className={`${inputCls} mt-2 h-auto min-h-[200px] resize-none whitespace-pre-wrap`}
              onInput={(e) => autoResize(e.currentTarget)}
              value={transcriptText}
              onChange={(e) => setTranscriptText(e.target.value)}
            />
          </div>

          <div className="mt-6 space-y-3">
            <button className={btnCls} onClick={doCleanup}>오탈자/표현 클린업 (gpt-4o)</button>
            {cleanupStatus && <div className={badge}>{cleanupStatus}</div>}
            <div>
              <label className={labelCls}>클린 전사</label>
              <textarea
                ref={refClean}
                className={`${inputCls} mt-2 h-auto min-h-[200px] resize-none whitespace-pre-wrap`}
                onInput={(e) => autoResize(e.currentTarget)}
                value={cleanText}
                onChange={(e) => setCleanText(e.target.value)}
                placeholder="클린 전사 텍스트"
              />
            </div>
          </div>
        </section>

        {/* 체크리스트 */}
        <section className={`${commonCard} mb-6`}>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">체크리스트</h2>
            <button className={btnCls} onClick={loadSampleChecker}>샘플 불러오기</button>
          </div>
          {checkerStatus && <div className="mt-3">{checkerStatus && <span className={badge}>{checkerStatus}</span>}</div>}
          <div className="mt-4">
            <label className={labelCls}>체크리스트 JSON</label>
            <textarea
              ref={refChecker}
              className={`${inputCls} mt-2 h-auto min-h-[240px] resize-none font-mono`}
              onInput={(e) => autoResize(e.currentTarget)}
              value={checkerJson}
              onChange={(e) => setCheckerJson(e.target.value)}
              placeholder="체크리스트 JSON"
            />
          </div>
        </section>

        {/* 채점 & 리포트 */}
        <section className={`${commonCard}`}>
          <h2 className="text-lg font-semibold">채점 & 리포트</h2>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button className={primaryBtn} onClick={doScore}>채점하기 (o3)</button>
            {scoreStatus && <span className={badge}>{scoreStatus}</span>}
            <button className={btnCls} onClick={downloadPdf}>PDF 생성/다운로드</button>
          </div>

          <div className="mt-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 p-4">
            <div
              className="prose prose-zinc dark:prose-invert max-w-none text-sm"
              dangerouslySetInnerHTML={{ __html: summaryHtml }}
            />
          </div>

          <div className="mt-4">
            <label className={labelCls}>채점 JSON</label>
            <textarea
              ref={refGrading}
              className={`${inputCls} mt-2 h-auto min-h-[240px] resize-none font-mono`}
              onInput={(e) => autoResize(e.currentTarget)}
              value={gradingJson}
              readOnly
              placeholder="채점 JSON"
            />
          </div>
        </section>

        <footer className="mt-10 text-center text-xs text-zinc-500 dark:text-zinc-400">
          © {new Date().getFullYear()} ai-cpx
        </footer>
      </div>
    </div>
  );
}
