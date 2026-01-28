"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import ChecklistConfirmPanel from "./ChecklistConfirmPanel";
import PatientImagePanel from "./PatientImagePanel";
import ScenarioSectionEditor from "./ScenarioSectionEditor";
import PhysicalExamEditor from "./PhysicalExamEditor";
import CommentaryPromptModal, { DEFAULT_PROMPT, PromptVersion } from "./CommentaryPromptModal";
import { DEFAULT_ROLE_PROMPT_TEMPLATE } from "@/app/(main)/live-select/cpx/buildPrompt";
import { VirtualPatient, VirtualPatientMeta, PhysicalExamData, ChecklistJson } from "@/types/dashboard";
import Spinner from "@/component/Spinner";

type RightTabType = "checklist" | "commentary" | "patientImage";

interface ChecklistSnapshot {
  history: { id: string; title: string; criteria: string }[];
  physicalExam: { id: string; title: string; criteria: string }[];
  education: { id: string; title: string; criteria: string }[];
  ppi: { id: string; title: string; criteria: string }[];
}

interface ChecklistIncludedMap {
  [itemId: string]: boolean;
}

interface ScenarioDetailTabsProps {
  // 시나리오 데이터 (전체 VirtualPatient JSON)
  scenarioContent: VirtualPatient | null;
  onScenarioChange: (content: VirtualPatient) => void;

  // 체크리스트 데이터
  checklistSnapshot: ChecklistSnapshot | null;
  checklistIncludedMap: ChecklistIncludedMap;
  onChecklistMapChange: (map: ChecklistIncludedMap) => void;
  checklistSourceVersionId?: string;
  checklistConfirmedAt?: string | null;

  // AI 생성용 체크리스트 (ChecklistJson 형식)
  checklistForAI?: ChecklistJson | null;

  // 해설 데이터
  commentaryContent: string;
  onCommentaryChange: (content: string) => void;

  // 환자 이미지
  scenarioId?: string;
  onPatientImageGenerated?: (imageUrl: string, imageId: string) => void;

  // 공통
  disabled?: boolean;
  caseName: string;
  onCaseNameChange: (name: string) => void;
}

const RIGHT_TABS: { key: RightTabType; label: string }[] = [
  { key: "checklist", label: "체크리스트" },
  { key: "commentary", label: "해설" },
  { key: "patientImage", label: "환자 이미지" },
];

const inputBase =
  "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-500";

export default function ScenarioDetailTabs({
  scenarioContent,
  onScenarioChange,
  checklistSnapshot,
  checklistIncludedMap,
  onChecklistMapChange,
  checklistSourceVersionId,
  checklistConfirmedAt,
  checklistForAI,
  commentaryContent,
  onCommentaryChange,
  scenarioId,
  onPatientImageGenerated,
  disabled = false,
  caseName,
  onCaseNameChange,
}: ScenarioDetailTabsProps) {
  const [activeRightTab, setActiveRightTab] = useState<RightTabType>("checklist");
  const commentaryEditorRef = useRef<HTMLDivElement>(null);

  // AI 생성 상태
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // 해설 생성 상태
  const [isGeneratingCommentary, setIsGeneratingCommentary] = useState(false);
  const [commentaryError, setCommentaryError] = useState<string | null>(null);
  const [commentaryPrompt, setCommentaryPrompt] = useState(DEFAULT_PROMPT);
  const [commentaryPromptVersion, setCommentaryPromptVersion] = useState("0.1");
  const [commentaryPromptHistory, setCommentaryPromptHistory] = useState<PromptVersion[]>([]);
  const [isCommentaryPromptModalOpen, setIsCommentaryPromptModalOpen] = useState(false);

  // Role Prompt 상태 (SCENARIO_INSTRUCT)
  const [rolePrompt, setRolePrompt] = useState(DEFAULT_ROLE_PROMPT_TEMPLATE);
  const [rolePromptVersion, setRolePromptVersion] = useState("0.1");
  const [rolePromptHistory, setRolePromptHistory] = useState<PromptVersion[]>([]);
  const [isRolePromptModalOpen, setIsRolePromptModalOpen] = useState(false);

  // DB에서 프롬프트 버전 로드
  useEffect(() => {
    const loadAllPromptVersions = async () => {
      // SOLUTION (해설) 프롬프트 로드
      try {
        const res = await fetch("/api/prompt-versions?type=SOLUTION");
        if (res.ok) {
          const data = await res.json();
          const versions = data.versions || [];
          if (versions.length > 0) {
            const latest = versions[0];
            setCommentaryPrompt(latest.content);
            setCommentaryPromptVersion(latest.version);
            setCommentaryPromptHistory(
              versions.slice(1).map((v: { version: string; content: string; createdAt: string }) => ({
                version: v.version,
                prompt: v.content,
                createdAt: v.createdAt,
              }))
            );
          }
        }
      } catch (err) {
        console.error("Failed to load SOLUTION prompt versions:", err);
      }

      // SCENARIO_INSTRUCT (Role Prompt) 로드
      try {
        const res = await fetch("/api/prompt-versions?type=SCENARIO_INSTRUCT");
        if (res.ok) {
          const data = await res.json();
          const versions = data.versions || [];
          if (versions.length > 0) {
            const latest = versions[0];
            setRolePrompt(latest.content);
            setRolePromptVersion(latest.version);
            setRolePromptHistory(
              versions.slice(1).map((v: { version: string; content: string; createdAt: string }) => ({
                version: v.version,
                prompt: v.content,
                createdAt: v.createdAt,
              }))
            );
          }
        }
      } catch (err) {
        console.error("Failed to load SCENARIO_INSTRUCT prompt versions:", err);
      }
    };

    loadAllPromptVersions();
  }, []);

  // AI가 시나리오를 생성했는지 여부 (history가 있으면 생성됨으로 간주)
  const isAIGenerated = Boolean(
    scenarioContent?.history && Object.keys(scenarioContent.history).length > 0
  );

  // 환자 이미지 상태 (부모에서 전달받음)
  const [hasPatientImage, setHasPatientImage] = useState(false);

  // 탭별 완료 상태 체크
  const getRightTabStatus = useCallback(
    (tab: RightTabType): "complete" | "incomplete" | "empty" => {
      switch (tab) {
        case "checklist": {
          const hasChecklist = Object.keys(checklistIncludedMap).length > 0;
          return hasChecklist ? "complete" : "empty";
        }
        case "commentary": {
          const hasCommentary = commentaryContent && commentaryContent.trim() !== "";
          return hasCommentary ? "complete" : "empty";
        }
        case "patientImage": {
          return hasPatientImage ? "complete" : "empty";
        }
      }
    },
    [checklistIncludedMap, commentaryContent, hasPatientImage]
  );

  // 해설 에디터 동기화
  useEffect(() => {
    if (commentaryEditorRef.current && activeRightTab === "commentary") {
      if (commentaryEditorRef.current.innerHTML !== commentaryContent) {
        commentaryEditorRef.current.innerHTML = commentaryContent;
      }
    }
  }, [commentaryContent, activeRightTab]);

  // 메타 데이터 가져오기 (새 구조/구 구조 모두 지원)
  const getMeta = useCallback((): VirtualPatientMeta | undefined => {
    if (!scenarioContent) return undefined;
    // 새 스키마: meta가 루트에 직접 위치
    if (scenarioContent.meta) return scenarioContent.meta;
    // 구 스키마: properties.meta 구조
    if (scenarioContent.properties?.meta) return scenarioContent.properties.meta;
    return undefined;
  }, [scenarioContent]);

  // 시나리오 메타 업데이트 (새 구조 사용)
  const updateScenarioMeta = (field: string, value: unknown) => {
    if (!scenarioContent) return;
    const currentMeta = getMeta() || {} as VirtualPatientMeta;
    // 새 구조 사용
    onScenarioChange({
      ...scenarioContent,
      meta: {
        ...currentMeta,
        [field]: value,
      },
      // 구 구조도 동기화 (호환성)
      properties: scenarioContent.properties ? {
        ...scenarioContent.properties,
        meta: {
          ...currentMeta,
          [field]: value,
        },
      } : undefined,
    });
  };

  // 시나리오 필드 업데이트
  const updateScenarioField = (field: keyof VirtualPatient, value: unknown) => {
    if (!scenarioContent) return;
    onScenarioChange({
      ...scenarioContent,
      [field]: value,
    });
  };

  // AI 시나리오 생성 가능 여부 체크
  const canGenerate = useCallback(() => {
    if (!scenarioContent) return false;
    const meta = getMeta();
    return Boolean(
      meta?.name?.trim() &&
      meta?.sex?.trim() &&
      meta?.age &&
      meta?.chief_complaint?.trim() &&
      scenarioContent.title?.trim() &&
      meta?.vitals?.bp?.trim() &&
      meta?.vitals?.hr &&
      meta?.vitals?.rr &&
      meta?.vitals?.bt
    );
  }, [scenarioContent, getMeta]);

  // AI 시나리오 생성
  const handleGenerateScenario = async () => {
    if (disabled || !canGenerate() || isGenerating || !scenarioContent) return;

    setIsGenerating(true);
    setGenerateError(null);

    try {
      const meta = getMeta();
      if (!meta) throw new Error("메타 데이터가 없습니다.");

      // AI 생성용 체크리스트 데이터 준비
      const checklist = checklistForAI || checklistSnapshot || {
        history: [],
        physicalExam: [],
        education: [],
        ppi: [],
      };

      const res = await fetch("/api/scenario-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meta: {
            name: meta.name.trim(),
            sex: meta.sex.trim(),
            age: meta.age,
            impression: scenarioContent.title.trim(),
            chief_complaint: meta.chief_complaint.trim(),
            diagnosis: meta.diagnosis?.trim() || "",
            vitals: meta.vitals,
          },
          checklist,
        }),
      });

      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || "시나리오 생성에 실패했습니다.");
      }

      const data = await res.json();
      if (!data?.scenario) {
        throw new Error("응답에 scenario가 없습니다.");
      }

      // 생성된 시나리오와 기존 입력값 병합 (새 스키마 사용)
      const generatedMeta = data.scenario.meta || data.scenario.properties?.meta || {};
      const mergedMeta: VirtualPatientMeta = {
        ...generatedMeta,
        name: meta.name,
        sex: meta.sex,
        age: meta.age,
        chief_complaint: meta.chief_complaint,
        diagnosis: meta.diagnosis,
        vitals: meta.vitals,
        attitude: meta.attitude || generatedMeta.attitude || "",
        hybrid_skill: meta.hybrid_skill || generatedMeta.hybrid_skill || "",
      };

      const mergedScenario: VirtualPatient = {
        ...data.scenario,
        title: scenarioContent.title,
        meta: mergedMeta,
        // 구 구조도 동기화 (호환성)
        properties: {
          meta: mergedMeta,
        },
      };

      onScenarioChange(mergedScenario);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "시나리오 생성 중 오류가 발생했습니다.";
      setGenerateError(message);
    } finally {
      setIsGenerating(false);
    }
  };

  // 해설 생성 가능 여부 체크
  const canGenerateCommentary = useCallback(() => {
    return isAIGenerated && scenarioContent !== null;
  }, [isAIGenerated, scenarioContent]);

  // 해설 생성
  const handleGenerateCommentary = async (promptOverride?: string) => {
    if (disabled || !canGenerateCommentary() || isGeneratingCommentary || !scenarioContent) return;

    setIsGeneratingCommentary(true);
    setCommentaryError(null);

    try {
      const res = await fetch("/api/commentary-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenario: scenarioContent,
          customPrompt: promptOverride ?? commentaryPrompt,
        }),
      });

      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || "해설 생성에 실패했습니다.");
      }

      const data = await res.json();
      if (!data?.commentary) {
        throw new Error("응답에 commentary가 없습니다.");
      }

      onCommentaryChange(data.commentary);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "해설 생성 중 오류가 발생했습니다.";
      setCommentaryError(message);
    } finally {
      setIsGeneratingCommentary(false);
    }
  };

  // 프롬프트 저장 및 해설 생성
  const handleSavePromptAndGenerate = async (newPrompt: string, newVersion: string) => {
    try {
      // DB에 새 버전 저장
      const res = await fetch("/api/prompt-versions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "SOLUTION",
          version: newVersion,
          content: newPrompt,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "프롬프트 저장에 실패했습니다.");
      }

      // 현재 프롬프트를 히스토리에 추가
      setCommentaryPromptHistory((prev) => [
        {
          version: commentaryPromptVersion,
          prompt: commentaryPrompt,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
      // 새 프롬프트와 버전으로 업데이트
      setCommentaryPrompt(newPrompt);
      setCommentaryPromptVersion(newVersion);
      // 해설 생성
      handleGenerateCommentary(newPrompt);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "프롬프트 저장 중 오류가 발생했습니다.";
      setCommentaryError(message);
    }
  };

  // Role Prompt 저장 (SCENARIO_INSTRUCT)
  const handleSaveRolePrompt = async (newPrompt: string, newVersion: string) => {
    try {
      const res = await fetch("/api/prompt-versions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "SCENARIO_INSTRUCT",
          version: newVersion,
          content: newPrompt,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "프롬프트 저장에 실패했습니다.");
      }

      // 현재 프롬프트를 히스토리에 추가
      setRolePromptHistory((prev) => [
        {
          version: rolePromptVersion,
          prompt: rolePrompt,
          createdAt: new Date().toISOString(),
        },
        ...prev,
      ]);
      // 새 프롬프트와 버전으로 업데이트
      setRolePrompt(newPrompt);
      setRolePromptVersion(newVersion);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "프롬프트 저장 중 오류가 발생했습니다.";
      setGenerateError(message);
    }
  };

  const renderStatusIcon = (status: "complete" | "incomplete" | "empty") => {
    switch (status) {
      case "complete":
        return <span className="w-2 h-2 rounded-full bg-green-500" />;
      case "incomplete":
        return <span className="w-2 h-2 rounded-full bg-yellow-500" />;
      case "empty":
        return <span className="w-2 h-2 rounded-full bg-gray-300" />;
    }
  };

  // 현재 메타 데이터
  const meta = getMeta();

  return (
    <div className="flex h-full bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* 왼쪽: 시나리오 (고정) */}
      <div className="w-1/2 h-full flex flex-col border-r border-gray-200">
        <div className="h-[49px] px-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between shrink-0">
          <h2 className="text-sm font-semibold text-gray-800">시나리오</h2>
          <button
            type="button"
            onClick={() => setIsRolePromptModalOpen(true)}
            className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
          >
            Role Prompt 수정
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* AI 생성 전: 필수 입력 항목만 표시 */}
          {!isAIGenerated ? (
            <>
              {/* AI 생성에 필요한 필수 항목들 */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-gray-700">기본 정보 (필수)</h3>

                {/* Case Name */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Case Name *
                  </label>
                  <input
                    type="text"
                    className={inputBase}
                    value={caseName}
                    onChange={(e) => onCaseNameChange(e.target.value)}
                    placeholder="예: 급성복통 시나리오1"
                    disabled={disabled}
                  />
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      이름 *
                    </label>
                    <input
                      type="text"
                      className={inputBase}
                      value={meta?.name || ""}
                      onChange={(e) => updateScenarioMeta("name", e.target.value)}
                      placeholder="예: 이춘배"
                      disabled={disabled}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      성별 *
                    </label>
                    <select
                      className={inputBase}
                      value={meta?.sex || ""}
                      onChange={(e) => updateScenarioMeta("sex", e.target.value)}
                      disabled={disabled}
                    >
                      <option value="">선택</option>
                      <option value="남성">남성</option>
                      <option value="여성">여성</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      나이 *
                    </label>
                    <input
                      type="number"
                      className={inputBase}
                      value={meta?.age || ""}
                      onChange={(e) => updateScenarioMeta("age", Number(e.target.value) || 0)}
                      placeholder="예: 48"
                      disabled={disabled}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Chief Complaint (환자 호소) *
                  </label>
                  <input
                    type="text"
                    className={inputBase}
                    value={meta?.chief_complaint || ""}
                    onChange={(e) => updateScenarioMeta("chief_complaint", e.target.value)}
                    placeholder="예: 배가 너무 아파요"
                    disabled={disabled}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Title (Impression) *
                  </label>
                  <input
                    type="text"
                    className={inputBase}
                    value={scenarioContent?.title || ""}
                    onChange={(e) => updateScenarioField("title", e.target.value)}
                    placeholder="예: 배가 너무 아파요 (고령 남성)"
                    disabled={disabled}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Diagnosis (진단명)
                  </label>
                  <input
                    type="text"
                    className={inputBase}
                    value={meta?.diagnosis || ""}
                    onChange={(e) => updateScenarioMeta("diagnosis", e.target.value)}
                    placeholder="예: 급성 췌장염"
                    disabled={disabled}
                  />
                </div>
              </div>

              {/* Vital Signs */}
              <div className="space-y-3 pt-3 border-t border-gray-100">
                <h3 className="text-sm font-semibold text-gray-700">Vital Signs (필수)</h3>
                <div className="grid grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      혈압 (BP) *
                    </label>
                    <input
                      type="text"
                      className={inputBase}
                      value={meta?.vitals?.bp || ""}
                      onChange={(e) =>
                        updateScenarioMeta("vitals", {
                          ...meta?.vitals,
                          bp: e.target.value,
                        })
                      }
                      placeholder="95/60"
                      disabled={disabled}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      맥박 (HR) *
                    </label>
                    <input
                      type="number"
                      className={inputBase}
                      value={meta?.vitals?.hr || ""}
                      onChange={(e) =>
                        updateScenarioMeta("vitals", {
                          ...meta?.vitals,
                          hr: Number(e.target.value) || 0,
                        })
                      }
                      placeholder="110"
                      disabled={disabled}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      호흡수 (RR) *
                    </label>
                    <input
                      type="number"
                      className={inputBase}
                      value={meta?.vitals?.rr || ""}
                      onChange={(e) =>
                        updateScenarioMeta("vitals", {
                          ...meta?.vitals,
                          rr: Number(e.target.value) || 0,
                        })
                      }
                      placeholder="24"
                      disabled={disabled}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      체온 (BT) *
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      className={inputBase}
                      value={meta?.vitals?.bt || ""}
                      onChange={(e) =>
                        updateScenarioMeta("vitals", {
                          ...meta?.vitals,
                          bt: Number(e.target.value) || 0,
                        })
                      }
                      placeholder="37.8"
                      disabled={disabled}
                    />
                  </div>
                </div>
              </div>

              {/* AI 시나리오 생성 버튼 */}
              <div className="pt-4">
                <button
                  type="button"
                  onClick={handleGenerateScenario}
                  disabled={disabled || !canGenerate() || isGenerating}
                  className={`w-full rounded-xl text-white text-base font-semibold py-3 shadow-sm transition-all ${disabled || !canGenerate() || isGenerating
                    ? "bg-violet-300 cursor-not-allowed"
                    : "bg-violet-600 hover:bg-violet-700"
                    }`}
                >
                  {isGenerating ? (
                    <span className="flex items-center justify-center gap-2">
                      <Spinner size={18} borderClassName="border-white" />
                      AI 시나리오 생성 중
                    </span>
                  ) : (
                    "AI 시나리오 초안 생성하기"
                  )}
                </button>
                {generateError && (
                  <p className="mt-2 text-xs text-red-600 text-center">{generateError}</p>
                )}
              </div>
            </>
          ) : (
            <>
              {/* AI 생성 후: 전체 편집 UI */}
              {/* 기본 정보 */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-700">기본 정보</h3>
                  <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded">
                    AI 생성 완료
                  </span>
                </div>

                {/* Case Name */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Case Name *
                  </label>
                  <input
                    type="text"
                    className={inputBase}
                    value={caseName}
                    onChange={(e) => onCaseNameChange(e.target.value)}
                    placeholder="예: 급성복통 시나리오1"
                    disabled={disabled}
                  />
                </div>

                {/* ID */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    시나리오 ID
                  </label>
                  <input
                    type="text"
                    className={inputBase}
                    value={scenarioContent?.id || ""}
                    onChange={(e) => updateScenarioField("id", e.target.value)}
                    placeholder="예: acute_abdominal_pain_001"
                    disabled={disabled}
                  />
                </div>

                <div className="grid grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      이름 *
                    </label>
                    <input
                      type="text"
                      className={inputBase}
                      value={meta?.name || ""}
                      onChange={(e) => updateScenarioMeta("name", e.target.value)}
                      placeholder="예: 이춘배"
                      disabled={disabled}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      성별 *
                    </label>
                    <select
                      className={inputBase}
                      value={meta?.sex || ""}
                      onChange={(e) => updateScenarioMeta("sex", e.target.value)}
                      disabled={disabled}
                    >
                      <option value="">선택</option>
                      <option value="남성">남성</option>
                      <option value="여성">여성</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      나이 *
                    </label>
                    <input
                      type="number"
                      className={inputBase}
                      value={meta?.age || ""}
                      onChange={(e) => updateScenarioMeta("age", Number(e.target.value) || 0)}
                      placeholder="예: 48"
                      disabled={disabled}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      MRN
                    </label>
                    <input
                      type="number"
                      className={inputBase}
                      value={meta?.mrn || ""}
                      onChange={(e) => updateScenarioMeta("mrn", Number(e.target.value) || 0)}
                      placeholder="예: 965831"
                      disabled={disabled}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Chief Complaint (환자 호소) *
                    </label>
                    <input
                      type="text"
                      className={inputBase}
                      value={meta?.chief_complaint || ""}
                      onChange={(e) => updateScenarioMeta("chief_complaint", e.target.value)}
                      placeholder="예: 배가 너무 아파요"
                      disabled={disabled}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Diagnosis (진단명)
                    </label>
                    <input
                      type="text"
                      className={inputBase}
                      value={meta?.diagnosis || ""}
                      onChange={(e) => updateScenarioMeta("diagnosis", e.target.value)}
                      placeholder="예: 급성 췌장염"
                      disabled={disabled}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Title (시나리오 제목) *
                  </label>
                  <input
                    type="text"
                    className={inputBase}
                    value={scenarioContent?.title || ""}
                    onChange={(e) => updateScenarioField("title", e.target.value)}
                    placeholder="예: 배가 너무 아파요 (고령 남성)"
                    disabled={disabled}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">
                    Description (상황 설명)
                  </label>
                  <textarea
                    className={`${inputBase} min-h-[60px]`}
                    value={scenarioContent?.description || ""}
                    onChange={(e) => updateScenarioField("description", e.target.value)}
                    placeholder="예: 48세 남성 이춘배씨가 갑자기 배가 심하게 아파 응급실로 내원하였다."
                    disabled={disabled}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Attitude (태도)
                    </label>
                    <input
                      type="text"
                      className={inputBase}
                      value={meta?.attitude || ""}
                      onChange={(e) => updateScenarioMeta("attitude", e.target.value)}
                      placeholder="예: 매우 고통스러워하며 말함"
                      disabled={disabled}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Hybrid Skill
                    </label>
                    <input
                      type="text"
                      className={inputBase}
                      value={meta?.hybrid_skill || ""}
                      onChange={(e) => updateScenarioMeta("hybrid_skill", e.target.value)}
                      placeholder="예: 없음"
                      disabled={disabled}
                    />
                  </div>
                </div>
              </div>

              {/* Vital Signs */}
              <div className="space-y-3 pt-3 border-t border-gray-100">
                <h3 className="text-sm font-semibold text-gray-700">Vital Signs</h3>
                <div className="grid grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      혈압 (BP)
                    </label>
                    <input
                      type="text"
                      className={inputBase}
                      value={meta?.vitals?.bp || ""}
                      onChange={(e) =>
                        updateScenarioMeta("vitals", {
                          ...meta?.vitals,
                          bp: e.target.value,
                        })
                      }
                      placeholder="95/60"
                      disabled={disabled}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      맥박 (HR)
                    </label>
                    <input
                      type="number"
                      className={inputBase}
                      value={meta?.vitals?.hr || ""}
                      onChange={(e) =>
                        updateScenarioMeta("vitals", {
                          ...meta?.vitals,
                          hr: Number(e.target.value) || 0,
                        })
                      }
                      placeholder="110"
                      disabled={disabled}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      호흡수 (RR)
                    </label>
                    <input
                      type="number"
                      className={inputBase}
                      value={meta?.vitals?.rr || ""}
                      onChange={(e) =>
                        updateScenarioMeta("vitals", {
                          ...meta?.vitals,
                          rr: Number(e.target.value) || 0,
                        })
                      }
                      placeholder="24"
                      disabled={disabled}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      체온 (BT)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      className={inputBase}
                      value={meta?.vitals?.bt || ""}
                      onChange={(e) =>
                        updateScenarioMeta("vitals", {
                          ...meta?.vitals,
                          bt: Number(e.target.value) || 0,
                        })
                      }
                      placeholder="37.8"
                      disabled={disabled}
                    />
                  </div>
                </div>
              </div>

              {/* AI 재생성 버튼 */}
              <div className="pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={handleGenerateScenario}
                  disabled={disabled || !canGenerate() || isGenerating}
                  className={`w-full rounded-lg text-sm font-medium py-2 border transition-all ${disabled || !canGenerate() || isGenerating
                    ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                    : "bg-white text-violet-600 border-violet-300 hover:bg-violet-50"
                    }`}
                >
                  {isGenerating ? (
                    <span className="flex items-center justify-center gap-2">
                      <Spinner size={16} borderClassName="border-violet-600" />
                      재생성 중...
                    </span>
                  ) : (
                    "AI 시나리오 다시 생성하기"
                  )}
                </button>
                {generateError && (
                  <p className="mt-2 text-xs text-red-600 text-center">{generateError}</p>
                )}
              </div>

              {/* 시나리오 상세 섹션들 */}
              <div className="space-y-3 pt-3 border-t border-gray-100">
                <h3 className="text-sm font-semibold text-gray-700">시나리오 상세</h3>
                <div className="space-y-2">
                  <ScenarioSectionEditor
                    title="병력 청취 (History)"
                    data={scenarioContent?.history || {}}
                    onChange={(newData) => updateScenarioField("history", newData)}
                    disabled={disabled}
                  />
                  <ScenarioSectionEditor
                    title="추가 병력 (Additional History)"
                    data={scenarioContent?.additional_history || {}}
                    onChange={(newData) => updateScenarioField("additional_history", newData)}
                    disabled={disabled}
                  />
                  <PhysicalExamEditor
                    data={typeof scenarioContent?.physical_exam === "object" ? scenarioContent.physical_exam as PhysicalExamData : {}}
                    onChange={(newData) => updateScenarioField("physical_exam", newData)}
                    disabled={disabled}
                  />
                </div>
              </div>

              {/* 전체 JSON 미리보기 */}
              <div className="space-y-3 pt-3 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-gray-700">전체 JSON 미리보기</h3>
                  <button
                    type="button"
                    onClick={() => {
                      if (scenarioContent) {
                        navigator.clipboard.writeText(JSON.stringify(scenarioContent, null, 2));
                      }
                    }}
                    className="text-xs text-violet-600 hover:text-violet-700"
                  >
                    복사
                  </button>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 max-h-60 overflow-auto">
                  <pre className="text-xs text-gray-600 font-mono whitespace-pre-wrap">
                    {scenarioContent ? JSON.stringify(scenarioContent, null, 2) : "시나리오 없음"}
                  </pre>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 오른쪽: 탭 (체크리스트 / 해설 / 환자 이미지) */}
      <div className="w-1/2 h-full flex flex-col">
        {/* 오른쪽 탭 헤더 */}
        <div className="h-[49px] flex items-center border-b border-gray-200 px-4 bg-gray-50 shrink-0">
          {RIGHT_TABS.map((tab) => {
            const isActive = tab.key === activeRightTab;
            const status = getRightTabStatus(tab.key);
            return (
              <button
                key={tab.key}
                onClick={() => setActiveRightTab(tab.key)}
                className={`flex items-center gap-2 px-4 h-full text-sm font-medium border-b-2 -mb-px transition-colors ${isActive
                  ? "text-violet-600 border-violet-600"
                  : "text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300"
                  }`}
              >
                {renderStatusIcon(status)}
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* 오른쪽 탭 콘텐츠 */}
        <div className="flex-1 overflow-hidden">
          {/* 체크리스트 탭 */}
          {activeRightTab === "checklist" && (
            <div className="h-full overflow-hidden">
              <ChecklistConfirmPanel
                checklistSnapshot={checklistSnapshot}
                includedMap={checklistIncludedMap}
                onChange={onChecklistMapChange}
                disabled={disabled}
                sourceVersion={checklistSourceVersionId}
                confirmedAt={checklistConfirmedAt}
              />
            </div>
          )}

          {/* 해설 탭 */}
          {activeRightTab === "commentary" && (
            <div className="h-full flex flex-col p-4">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-700">해설 작성</h3>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCommentaryPromptModalOpen(true)}
                    className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    프롬프트 수정
                  </button>
                  <button
                    type="button"
                    onClick={() => handleGenerateCommentary()}
                    disabled={disabled || !canGenerateCommentary() || isGeneratingCommentary}
                    title={!canGenerateCommentary() ? "시나리오를 먼저 생성해주세요" : undefined}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${disabled || !canGenerateCommentary() || isGeneratingCommentary
                      ? "bg-violet-50 text-violet-300 border-violet-200 cursor-not-allowed"
                      : "bg-violet-600 text-white border-violet-600 hover:bg-violet-700"
                      }`}
                  >
                    {isGeneratingCommentary ? (
                      <span className="flex items-center gap-1.5">
                        <Spinner size={12} borderClassName="border-white" />
                        생성 중...
                      </span>
                    ) : (
                      "해설 생성하기"
                    )}
                  </button>
                </div>
              </div>
              {commentaryError && (
                <p className="mb-2 text-xs text-red-600">{commentaryError}</p>
              )}
              {!canGenerateCommentary() && (
                <p className="mb-2 text-xs text-amber-600">
                  시나리오를 먼저 생성해야 해설을 자동 생성할 수 있습니다.
                </p>
              )}
              <div className="flex-1 relative">
                {!commentaryContent && (
                  <div className="absolute top-3 left-3 text-sm text-gray-400 pointer-events-none z-10">
                    해설을 입력하세요. 중요한 문장은 **볼드** 처리할 수 있습니다.
                  </div>
                )}
                <div
                  ref={commentaryEditorRef}
                  className={`h-full w-full overflow-y-auto rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-500 ${disabled ? "opacity-60 cursor-not-allowed bg-gray-50" : ""
                    }`}
                  contentEditable={!disabled}
                  onInput={() => {
                    if (commentaryEditorRef.current) {
                      onCommentaryChange(commentaryEditorRef.current.innerHTML);
                    }
                  }}
                  onPaste={(e) => {
                    if (disabled) return;
                    e.preventDefault();
                    const text = e.clipboardData.getData("text/plain");
                    const html = text
                      .replace(/&/g, "&amp;")
                      .replace(/</g, "&lt;")
                      .replace(/>/g, "&gt;")
                      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
                      .replace(/\n/g, "<br />");

                    const selection = window.getSelection();
                    if (!selection || selection.rangeCount === 0) return;
                    const range = selection.getRangeAt(0);
                    range.deleteContents();
                    const fragment = range.createContextualFragment(html);
                    range.insertNode(fragment);
                    range.collapse(false);

                    if (commentaryEditorRef.current) {
                      onCommentaryChange(commentaryEditorRef.current.innerHTML);
                    }
                  }}
                  suppressContentEditableWarning
                  aria-label="해설 편집기"
                />
              </div>
            </div>
          )}

          {/* 환자 이미지 탭 */}
          {activeRightTab === "patientImage" && (
            <div className="h-full overflow-y-auto p-4">
              <div className="mb-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-1">환자 이미지</h3>
                <p className="text-xs text-gray-500">
                  AI가 환자 정보를 바탕으로 가상 환자 이미지를 생성합니다.
                </p>
              </div>

              {(() => {
                const hasSex = Boolean(meta?.sex);
                const hasAge = Boolean(meta?.age);
                const hasChiefComplaint = Boolean(meta?.chief_complaint);
                const canGenerateImage = hasSex && hasAge && hasChiefComplaint;

                if (!canGenerateImage) {
                  return (
                    <div className="flex items-center justify-center py-12">
                      <div className="text-center max-w-xs">
                        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gray-100 flex items-center justify-center">
                          <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <p className="text-xs text-gray-500 mb-3">
                          이미지 생성을 위해 왼쪽 시나리오에서<br />
                          <strong>성별, 나이, 주호소</strong>를 입력해주세요.
                        </p>
                        <div className="space-y-1 text-xs text-left inline-block">
                          <div className={`flex items-center gap-1.5 ${hasSex ? "text-green-600" : "text-gray-400"}`}>
                            {hasSex ? "✓" : "○"} 성별 {hasSex && `(${meta?.sex})`}
                          </div>
                          <div className={`flex items-center gap-1.5 ${hasAge ? "text-green-600" : "text-gray-400"}`}>
                            {hasAge ? "✓" : "○"} 나이 {hasAge && `(${meta?.age}세)`}
                          </div>
                          <div className={`flex items-center gap-1.5 ${hasChiefComplaint ? "text-green-600" : "text-gray-400"}`}>
                            {hasChiefComplaint ? "✓" : "○"} 주호소
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }

                return (
                  <PatientImagePanel
                    scenarioId={scenarioId}
                    sex={meta?.sex}
                    age={meta?.age}
                    chiefComplaint={meta?.chief_complaint}
                    onImageGenerated={(url, id) => {
                      setHasPatientImage(Boolean(url));
                      onPatientImageGenerated?.(url, id);
                    }}
                    disabled={disabled}
                  />
                );
              })()}
            </div>
          )}
        </div>
      </div>

      {/* 해설 프롬프트 수정 모달 */}
      <CommentaryPromptModal
        isOpen={isCommentaryPromptModalOpen}
        onClose={() => setIsCommentaryPromptModalOpen(false)}
        currentPrompt={commentaryPrompt}
        currentVersion={commentaryPromptVersion}
        promptHistory={commentaryPromptHistory}
        onSave={handleSavePromptAndGenerate}
      />

      {/* Role Prompt 수정 모달 */}
      <CommentaryPromptModal
        isOpen={isRolePromptModalOpen}
        onClose={() => setIsRolePromptModalOpen(false)}
        currentPrompt={rolePrompt}
        currentVersion={rolePromptVersion}
        promptHistory={rolePromptHistory}
        onSave={handleSaveRolePrompt}
      />
    </div>
  );
}
