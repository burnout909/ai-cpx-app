"use client";

import { transcodeToWav16kMono } from "@/utils/transcribe";
import { JSX, useEffect, useRef, useState } from "react";
import {
  EducationEvidenceChecklist,
  EvidenceChecklist,
  HistoryEvidenceChecklist,
  PhysicalexamEvidenceChecklist,
  PpiEvidenceChecklist,
} from "./assets/evidenceChecklist";
import {
  EducationScoreChecklist,
  HistoryScoreChecklist,
  PhysicalExamScoreChecklist,
  PpiScoreChecklist,
  ScoreChecklist,
} from "./assets/scoreChecklist";
import { EvidenceListItem } from "./api/collectEvidence/route";
import { acuteStomachache } from "./assets/exampleTranscribeText";
import { exampleCleanupText } from "./assets/exampleCleanupText";

/* =========================
   Types
========================= */
export interface GradeItem {
  id: string;
  title: string;
  criteria: string;
  evidence: string[];
  max_evidence_count: number;
  point: number; // min(evidence.length, max_evidence_count)
}

type TabKey = "history" | "physical_exam" | "education" | "ppi";

const PART_LABEL: Record<TabKey, string> = {
  history: "History",
  physical_exam: "Physical-exam",
  education: "Education",
  ppi: "Ppi",
};

/* =========================
   Component
========================= */
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

  // 채점 / 섹션 상태
  const [scoreStatus, setScoreStatus] = useState("");
  const [gradingJson, setGradingJson] = useState<string>("");

  const [historyGrades, setHistoryGrades] = useState<GradeItem[] | null>(null);
  const [physicalGrades, setPhysicalGrades] = useState<GradeItem[] | null>(null);
  const [educationGrades, setEducationGrades] = useState<GradeItem[] | null>(null);
  const [ppiGrades, setPpiGrades] = useState<GradeItem[] | null>(null);

  const [activeTab, setActiveTab] = useState<TabKey>("history"); // JSON 보기용 탭
  const [reportTab, setReportTab] = useState<TabKey>("history"); // Report 상세 테이블 탭

  // Auto-resize helpers
  const refTranscript = useRef<HTMLTextAreaElement | null>(null);
  const refClean = useRef<HTMLTextAreaElement | null>(null);
  const refGrading = useRef<HTMLTextAreaElement | null>(null);

  function autoResize(el: HTMLTextAreaElement | null) {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200000) + "px";
  }

  useEffect(() => { autoResize(refTranscript.current); }, [transcriptText]);
  useEffect(() => { autoResize(refClean.current); }, [cleanText]);
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
      const message =
        (typeof data === "string" && data) ||
        data?.detail ||
        data?.message ||
        `${res.status} ${res.statusText}`;
      throw new Error(message);
    }
  }

  // async function saveConfig() {
  //   try {
  //     const res = await fetch("/api/config", {
  //       method: "POST",
  //       headers: { "Content-Type": "application/json" },
  //       body: JSON.stringify({ openai_api_key: openaiKey }),
  //     });
  //     const data = await readJsonOrText(res);
  //     ensureOkOrThrow(res, data);
  //     setSetStatus("✅ 설정이 저장되었습니다.");
  //   } catch (e: any) {
  //     setSetStatus(`❌ ${e.message || e}`);
  //   }
  // }

  // 30초 후 전사된 것처럼 하기
  function doTranscribe30Seconds() {
    setTransStatus('전사 실행중..')
    setTranscriptText("")
    setTimeout(() => {
      setTranscriptText(acuteStomachache)
      setTransStatus("전사 완료")
    }, 1000 * 30)
  }

  // async function doTranscribe() {
  //   if (!audioFile) {
  //     setTransStatus("오디오를 선택하세요.");
  //     return;
  //   }
  //   setTransStatus("전사 중...");

  //   try {
  //     let toSend: File = audioFile;

  //     // m4a면 브라우저에서 16kHz mono WAV로 변환
  //     const isM4A =
  //       /\.m4a$/i.test(audioFile.name) ||
  //       /audio\/x-m4a|audio\/m4a/i.test(audioFile.type);
  //     if (isM4A) {
  //       try {
  //         toSend = await transcodeToWav16kMono(audioFile);
  //       } catch (e) {
  //         console.warn("m4a 변환 실패, 원본으로 시도:", e);
  //       }
  //     }

  //     const fd = new FormData();
  //     fd.append("audio", toSend);

  //     const res = await fetch("/api/transcribe", { method: "POST", body: fd });
  //     const data = await readJsonOrText(res);
  //     ensureOkOrThrow(res, data);

  //     const text = typeof data === "string" ? "" : data?.text || "";
  //     setTranscriptText(text);
  //     setTransStatus("✅ 전사 완료 (화자표기는 클린업에서 반영)");
  //   } catch (e: any) {
  //     setTransStatus(`❌ 실패: ${e.message || e}`);
  //   }
  // }

  // async function doCleanup() {
  //   setCleanupStatus("클린업 중...");
  //   try {
  //     const res = await fetch("/api/cleanup", {
  //       method: "POST",
  //       headers: { "Content-Type": "application/json" },
  //       body: JSON.stringify({ transcript: transcriptText }),
  //     });
  //     const data = await readJsonOrText(res);
  //     ensureOkOrThrow(res, data);
  //     const txt = typeof data === "string" ? transcriptText : data?.text || "";
  //     setCleanText(txt);
  //     setCleanupStatus("✅ 클린업 완료");
  //   } catch (e: any) {
  //     setCleanupStatus(`⚠️ 클린업 경고: ${e.message || e}`);
  //     setCleanText(transcriptText);
  //   }
  // }

  function doCleanup30Seconds() {
    setCleanupStatus("클린업 중...");
    setCleanText("")
    setTimeout(() => {
      setCleanText(exampleCleanupText)
      setCleanupStatus("클린업 완료")
    }, 1000 * 30)
  }

  // Evidence 수집 (병렬 호출)
  async function doEvidence() {
    const [historyRes, physicalRes, educationRes, ppiRes] = await Promise.all([
      fetch("/api/collectEvidence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // transcript: cleanText || transcriptText,
          transcript: exampleCleanupText,
          evidenceChecklist: HistoryEvidenceChecklist,
          sectionId: "history",
        }),
      }),
      fetch("/api/collectEvidence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          //transcript: cleanText || transcriptText,
          transcript: exampleCleanupText,
          evidenceChecklist: PhysicalexamEvidenceChecklist,
          sectionId: "physical_exam",
        }),
      }),
      fetch("/api/collectEvidence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          //transcript: cleanText || transcriptText,
          transcript: exampleCleanupText,
          evidenceChecklist: EducationEvidenceChecklist,
          sectionId: "education",
        }),
      }),
      fetch("/api/collectEvidence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          //transcript: cleanText || transcriptText,
          transcript: exampleCleanupText,
          evidenceChecklist: PpiEvidenceChecklist,
          sectionId: "ppi",
        }),
      }),
    ]);

    const [historyJson, physcialjson, educationJson, ppiJson] =
      await Promise.all([
        historyRes.json(),
        physicalRes.json(),
        educationRes.json(),
        ppiRes.json(),
      ]);

    return {
      HistoryEvidenceList: historyJson,
      PhysicalExamEvidenceList: physcialjson,
      EducationEvidenceList: educationJson,
      PpiEvidenceList: ppiJson,
    };
  }

  /** evidence 입력을 배열/객체 모두 허용 */
  function normalizeEvidenceInput(
    input: EvidenceListItem[] | { evidenceList?: EvidenceListItem[] } | null | undefined
  ): EvidenceListItem[] {
    if (!input) return [];
    if (Array.isArray(input)) return input;
    if (Array.isArray(input.evidenceList)) return input.evidenceList;
    return [];
  }

  /**
   * doGrade
   * - id 기준으로 evidenceList, scoreChecklist, evidenceChecklist를 조인
   * - point = min(evidence.length, max_evidence_count)
   * - 반환 순서는 evidenceChecklist의 순서를 따름
   */
  function doGrade(
    evidenceInput: EvidenceListItem[] | { evidenceList?: EvidenceListItem[] },
    scoreChecklist: ScoreChecklist[],
    evidenceChecklist: EvidenceChecklist[]
  ): GradeItem[] {
    const evidenceList = normalizeEvidenceInput(evidenceInput);

    // 빠른 조인을 위한 맵 구성
    const evMap = new Map<string, EvidenceListItem>(
      evidenceList.map((e) => [e.id, e])
    );
    const scoreMap = new Map<string, number>(
      scoreChecklist.map((s) => [s.id, s.max_evidence_count])
    );

    // evidenceChecklist 순서대로 GradeItem 생성
    const result: GradeItem[] = evidenceChecklist.map((item) => {
      const ev = evMap.get(item.id);
      const evidence = ev?.evidence?.filter(Boolean) ?? [];
      const maxCnt = scoreMap.get(item.id) ?? 0;
      const point = Math.min(evidence.length, maxCnt);

      return {
        id: item.id,
        title: item.title,
        criteria: item.criteria,
        evidence,
        max_evidence_count: maxCnt,
        point,
      };
    });

    return result;
  }

  // JSON 보기 탭용 문자열
  function stringifyGradesForTab(tab: TabKey): string {
    const map: Record<TabKey, GradeItem[] | null> = {
      history: historyGrades,
      physical_exam: physicalGrades,
      education: educationGrades,
      ppi: ppiGrades,
    };
    const data = map[tab];
    return data ? JSON.stringify(data, null, 2) : "";
  }

  // 점수 합계 유틸
  function sumPoints(list: GradeItem[] | null) {
    if (!list) return { got: 0, max: 0 };
    return list.reduce(
      (acc, cur) => ({
        got: acc.got + (cur.point ?? 0),
        max: acc.max + (cur.max_evidence_count ?? 0),
      }),
      { got: 0, max: 0 }
    );
  }
  function getPartGrades(tab: TabKey): GradeItem[] | null {
    switch (tab) {
      case "history": return historyGrades;
      case "physical_exam": return physicalGrades;
      case "education": return educationGrades;
      case "ppi": return ppiGrades;
    }
  }
  function getAllTotals() {
    const H = sumPoints(historyGrades);
    const P = sumPoints(physicalGrades);
    const E = sumPoints(educationGrades);
    const I = sumPoints(ppiGrades);
    return {
      byPart: { history: H, physical_exam: P, education: E, ppi: I },
      overall: { got: H.got + P.got + E.got + I.got, max: H.max + P.max + E.max + I.max }
    };
  }

  async function doScore() {
    setScoreStatus("채점 중...");
    try {
      const {
        HistoryEvidenceList,
        PhysicalExamEvidenceList,
        EducationEvidenceList,
        PpiEvidenceList,
      } = await doEvidence();

      const h = doGrade(HistoryEvidenceList, HistoryScoreChecklist, HistoryEvidenceChecklist);
      const p = doGrade(PhysicalExamEvidenceList, PhysicalExamScoreChecklist, PhysicalexamEvidenceChecklist);
      const e = doGrade(EducationEvidenceList, EducationScoreChecklist, EducationEvidenceChecklist);
      const pp = doGrade(PpiEvidenceList, PpiScoreChecklist, PpiEvidenceChecklist);

      setHistoryGrades(h);
      setPhysicalGrades(p);
      setEducationGrades(e);
      setPpiGrades(pp);

      // 기본 탭은 History로 설정
      setActiveTab("history");
      setReportTab("history");
      setGradingJson(JSON.stringify(h, null, 2));

      setScoreStatus("✅ 채점 완료");
      return { HistoryGradeList: h, PhysicalExamGradeList: p, EducationGradeList: e, PpiGradeList: pp };
    } catch (e: any) {
      setScoreStatus(`❌ 채점 실패: ${e.message || e}`);
    }
  }

  // UI styles
  const commonCard = "rounded-2xl border bg-white/60 dark:bg-zinc-900/60 border-zinc-200 dark:border-zinc-800 p-6 shadow-sm";
  const labelCls = "block text-sm font-medium text-zinc-700 dark:text-zinc-300 ml";
  const inputCls = "mt-2 w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none ring-0 focus:border-zinc-500";
  const btnCls = "inline-flex items-center gap-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 active:translate-y-px transition";
  const primaryBtn = "inline-flex items-center gap-2 rounded-lg bg-zinc-900 text-white px-3 py-2 text-sm hover:bg-black/90 active:translate-y-px transition";
  const badge = "inline-flex items-center rounded-md bg-zinc-100 dark:bg-zinc-800 px-2 py-1 text-xs text-zinc-700 dark:text-zinc-300";

  const scorePill = (got: number, max: number) => (
    <span className="rounded-full px-2 py-1 text-xs bg-zinc-900 text-white dark:bg-white dark:text-zinc-900">
      {got} / {max}
    </span>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-white dark:from-black dark:to-zinc-950 text-zinc-900 dark:text-zinc-100">
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
        <header className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">[AI-CPX] Auto Evaluation</h1>
        </header>

        {/* 설정 */}
        {/* <section className={`${commonCard} mb-6`}>
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
        </section> */}

        {/* 전사 */}
        <section className={`${commonCard} mb-6`}>
          <h2 className="text-lg font-semibold">Transcribe</h2>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            {/* <input
              className="block w-full cursor-pointer text-sm file:mr-3 file:rounded-md file:border file:border-zinc-300 dark:file:border-zinc-700 file:bg-white dark:file:bg-zinc-900 file:px-3 file:py-2 file:text-sm file:text-zinc-900 dark:file:text-zinc-100 hover:file:bg-zinc-50 dark:hover:file:bg-zinc-800"
              type="file"
              accept="audio/*"
              onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
            />
            <button className={btnCls} onClick={doTranscribe}>전사 실행</button> */}
            {/* 임시추가 */}
            <button className={primaryBtn} onClick={doTranscribe30Seconds}>전사 실행</button>
            <div>급성 복통 환자.m4a</div>
            {transStatus && <span className={badge}>{transStatus}</span>}
          </div>

          <div className="mt-4">
            <label className={labelCls}>원문 전사</label>
            <textarea
              ref={refTranscript}
              className={`${inputCls} mt-2 max-h-[300px] min-h-[200px] resize-none whitespace-pre-wrap`}
              onInput={(e) => autoResize(e.currentTarget)}
              value={transcriptText}
              onChange={(e) => setTranscriptText(e.target.value)}
              placeholder="원문 전사 텍스트"
            />
          </div>

          <div className="mt-6 space-y-3">
            {/* <button className={btnCls} onClick={doCleanup}>표현 클린업</button> */}
            <div className="flex gap-3">
              <button className={primaryBtn} onClick={doCleanup30Seconds}>표현 클린업</button>
              {cleanupStatus && <div className={badge + 'h-fit'}>{cleanupStatus}</div>}
            </div>
            <div>
              <label className={labelCls}>클린 전사</label>
              <textarea
                ref={refClean}
                className={`${inputCls} mt-2 h-auto min-h-[200px] max-h-[300px] resize-none whitespace-pre-wrap`}
                onInput={(e) => autoResize(e.currentTarget)}
                value={cleanText}
                onChange={(e) => setCleanText(e.target.value)}
                placeholder="클린 전사 텍스트"
              />
            </div>
          </div>
        </section>

        {/* 채점 & JSON 보기 */}
        <section className={`${commonCard} mb-6`}>
          <h2 className="text-lg font-semibold">Grading</h2>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button className={primaryBtn} onClick={doScore}>채점하기</button>
            {scoreStatus && <span className={badge}>{scoreStatus}</span>}
          </div>

          {/* 섹션 토글 (JSON 미리보기) */}
          <div className="mt-4 flex flex-wrap gap-2">
            {(["history", "physical_exam", "education", "ppi"] as TabKey[]).map((k) => {
              const isActive = activeTab === k;
              return (
                <button
                  key={k}
                  onClick={() => { setActiveTab(k); setGradingJson(stringifyGradesForTab(k)); }}
                  className={
                    isActive
                      ? "inline-flex items-center gap-2 rounded-lg bg-zinc-900 text-white px-3 py-1 text-sm hover:bg-black/90 active:translate-y-px transition"
                      : "inline-flex items-center gap-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 active:translate-y-px transition"
                  }
                >
                  {PART_LABEL[k]}
                </button>
              );
            })}
          </div>

          <div className="mt-4">
            <label className={labelCls}>채점 JSON</label>
            <textarea
              ref={refGrading}
              className={`${inputCls} mt-2 h-auto min-h-[240px] max-h-[300px] resize-none font-mono`}
              onInput={(e) => autoResize(e.currentTarget)}
              value={gradingJson}
              readOnly
              placeholder="채점 JSON"
            />
          </div>
        </section>

        {/* Report 섹션 */}
        <section className={`${commonCard}`}>
          <h2 className="text-lg font-semibold">Report</h2>

          {/* 총점 & 파트별 점수 요약 */}
          <ReportSummary
            getAllTotals={getAllTotals}
            reportTab={reportTab}
            setReportTab={setReportTab}
            PART_LABEL={PART_LABEL}
            scorePill={scorePill}
          />

          {/* 선택된 파트의 체크리스트 상세 (points / max_evidence_count) */}
          <ReportDetailTable grades={getPartGrades(reportTab)} emptyMsg="아직 채점 결과가 없습니다. 상단에서 ‘채점하기’를 먼저 실행하세요." />
        </section>

        <footer className="mt-10 text-center text-xs text-zinc-500 dark:text-zinc-400">
          © {new Date().getFullYear()} ai-cpx
        </footer>
      </div>
    </div>
  );
}

/* =========================
   Report UI Subcomponents
========================= */

// 총점 & 파트별 카드 요약
function ReportSummary({
  getAllTotals,
  reportTab,
  setReportTab,
  PART_LABEL,
  scorePill,
}: {
  getAllTotals: () => {
    byPart: Record<"history" | "physical_exam" | "education" | "ppi", { got: number; max: number }>;
    overall: { got: number; max: number };
  };
  reportTab: TabKey;
  setReportTab: (k: TabKey) => void;
  PART_LABEL: Record<TabKey, string>;
  scorePill: (got: number, max: number) => JSX.Element;
}) {
  const { byPart, overall } = getAllTotals();

  return (
    <>
      {/* Overall */}
      <div className="mt-4 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 bg-white/70 dark:bg-zinc-900/70">
        <div className="flex items-center justify-between">
          <div className="text-base font-medium">총점</div>
          <div className="text-base font-semibold">{overall.got} / {overall.max}</div>
        </div>
      </div>

      {/* Per-part cards */}
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {(Object.keys(byPart) as (keyof typeof byPart)[]).map((k) => (
          <button
            key={k}
            onClick={() => setReportTab(k as TabKey)}
            className={`text-left rounded-xl border p-4 transition ${reportTab === k
              ? "border-zinc-900 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
              : "border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/60 hover:bg-zinc-100/60 dark:hover:bg-zinc-800/60"
              }`}
          >
            <div className="flex items-center justify-between">
              <div className="text-sm opacity-80">{PART_LABEL[k as TabKey]}</div>
              {scorePill(byPart[k].got, byPart[k].max)}
            </div>
          </button>
        ))}
      </div>
    </>
  );
}

// 파트 상세 테이블
function ReportDetailTable({
  grades,
  emptyMsg,
}: {
  grades: GradeItem[] | null;
  emptyMsg?: string;
}) {
  if (!grades || grades.length === 0) {
    return (
      <div className="mt-6 text-sm text-zinc-500 dark:text-zinc-400">
        {emptyMsg || "표시할 항목이 없습니다."}
      </div>
    );
  }

  return (
    <div className="mt-6 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
      <table className="min-w-full text-sm">
        <thead className="bg-zinc-100 dark:bg-zinc-800/60">
          <tr>
            <th className="px-4 py-3 text-left font-medium">ID</th>
            <th className="px-4 py-3 text-left font-medium">체크리스트</th>
            <th className="px-4 py-3 text-left font-medium whitespace-nowrap">점수</th>
            <th className="px-4 py-3 text-left font-medium">기준(criteria)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {grades.map((g) => (
            <tr key={g.id} className="align-top">
              <td className="px-4 py-3 font-mono text-xs">{g.id}</td>
              <td className="px-4 py-3">
                <div className="font-medium">{g.title}</div>
                {/* evidence 미리보기 (있으면 1~2개만) */}
                {g.evidence?.length > 0 && (
                  <ul className="mt-1 list-disc pl-4 space-y-0.5 text-xs text-zinc-600 dark:text-zinc-400">
                    {g.evidence.slice(0, 2).map((evi, i) => (
                      <li key={i} className="whitespace-pre-wrap">{evi}</li>
                    ))}
                    {g.evidence.length > 2 && (
                      <li className="opacity-60">… 외 {g.evidence.length - 2}개</li>
                    )}
                  </ul>
                )}
              </td>
              <td className="px-4 py-3 whitespace-nowrap">
                <span className="inline-flex items-center rounded-md bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 px-2 py-1 text-xs">
                  {g.point} / {g.max_evidence_count}
                </span>
              </td>
              <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap">
                {g.criteria}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
