"use client";

import React, { useCallback } from "react";
import Spinner from "@/component/Spinner";
import { EditableSection } from "./EditableSection";
import { ChecklistJson, VirtualPatient } from "@/types/dashboard";

interface ScenarioDevModuleProps {
  scenarioJson: VirtualPatient;
  onChange: (next: VirtualPatient) => void;
  disabled?: boolean;
  contextLabel?: string;
  checklistJson: ChecklistJson;
  caseName?: string;
  onCaseNameChange?: (next: string) => void;
}

export const inputBase =
  "w-full border border-[#E4DEF9] rounded-lg px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-[#B9A8FF]";

export const ScenarioPannel: React.FC<ScenarioDevModuleProps> = ({
  scenarioJson,
  onChange,
  disabled = false,
  contextLabel,
  checklistJson,
  caseName,
  onCaseNameChange,
}) => {
  const meta = scenarioJson.meta || scenarioJson.properties?.meta || {
    name: "",
    sex: "",
    age: 0,
    chief_complaint: "",
    mrn: 0,
    vitals: { bp: "", hr: 0, rr: 0, bt: 0 },
    attitude: "",
    hybrid_skill: "",
  };
  const [generated, setGenerated] = React.useState<VirtualPatient | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [isSaving, setIsSaving] = React.useState(false);
  const [saveStatus, setSaveStatus] = React.useState<{
    kind: "success" | "error";
    message: string;
  } | null>(null);

  const updateGenerated = (vp: VirtualPatient) => {
    setGenerated(vp);
  };

  const autoResize = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    e.target.style.height = "auto";
    e.target.style.height = `${e.target.scrollHeight}px`;
  }, []);

  const allFilled =
    meta.name.trim() !== "" &&
    meta.sex.trim() !== "" &&
    meta.chief_complaint.trim() !== "" &&
    scenarioJson.title.trim() !== "" &&
    meta.vitals.bp.trim() !== "" &&
    Number.isFinite(meta.age) &&
    Number.isFinite(meta.vitals.hr) &&
    Number.isFinite(meta.vitals.rr) &&
    Number.isFinite(meta.vitals.bt) &&
    meta.age > 0 &&
    meta.vitals.hr > 0 &&
    meta.vitals.rr > 0 &&
    meta.vitals.bt > 0;

  const updateMeta = (field: keyof typeof meta, value: any) => {
    onChange({
      ...scenarioJson,
      properties: {
        ...scenarioJson.properties,
        meta: {
          ...meta,
          [field]: value,
        },
      },
    });
  };

  const handleSave = async () => {
    if (!generated || isSaving || disabled) return;
    const trimmedCaseName = (caseName ?? "").trim();
    if (!trimmedCaseName) {
      setSaveStatus({ kind: "error", message: "케이스명을 입력해주세요." });
      return;
    }

    setIsSaving(true);
    setSaveStatus(null);
    try {
      const generatedMeta = generated.meta || generated.properties?.meta || {};
      const mergedMeta = { ...generatedMeta, ...meta };
      const scenarioToSave: VirtualPatient = {
        ...generated,
        solution: scenarioJson.solution ?? generated.solution,
        meta: mergedMeta,
        properties: {
          ...generated.properties,
          meta: mergedMeta,
        },
      };

      const res = await fetch("/api/admin/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseName: trimmedCaseName,
          diagnosis: meta.diagnosis?.trim() || "",
          scenarioJson: scenarioToSave,
          checklistJson,
          description:
            typeof scenarioToSave.description === "string"
              ? scenarioToSave.description
              : undefined,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "DB 저장에 실패했습니다.");
      }

      setSaveStatus({ kind: "success", message: "DB 저장 완료" });
    } catch (err: any) {
      setSaveStatus({
        kind: "error",
        message: err?.message || "DB 저장 중 오류가 발생했습니다.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerate = () => {
    if (disabled || !allFilled || isLoading) return;
    setGenerated(null);
    setIsLoading(true);
    setError(null);
    setSaveStatus(null);
    (async () => {
      try {
        const res = await fetch("/api/scenario-generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            meta: {
              name: meta.name.trim(),
              sex: meta.sex.trim(),
              age: meta.age,
              impression: scenarioJson.title.trim(),
              chief_complaint: meta.chief_complaint.trim(),
              diagnosis: meta.diagnosis?.trim() || "",
              vitals: meta.vitals,
            },
            checklist: checklistJson,
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

        const scenarioMeta = data.scenario.meta || data.scenario.properties?.meta || {};
        const mergedMeta = {
          ...scenarioMeta,
          name: meta?.name,
          sex: meta?.sex,
          age: meta?.age,
          chief_complaint: meta?.chief_complaint,
          diagnosis: meta?.diagnosis,
          vitals: meta?.vitals,
        };
        const mergedScenario: VirtualPatient = {
          ...data.scenario,
          title: scenarioJson.title,
          meta: mergedMeta,
          properties: {
            ...data.scenario.properties,
            meta: mergedMeta,
          },
        };

        updateGenerated(mergedScenario);
      } catch (err: any) {
        setError(err?.message || "시나리오 생성 중 오류가 발생했습니다.");
      } finally {
        setIsLoading(false);
      }
    })();
  };

  return (
    <section className="flex flex-1 min-w-0 flex-col h-[calc(100vh-120px)] overflow-y-scroll rounded-2xl border border-[#D8D2F5] bg-white shadow-sm pb-5">
      <div className="shrink-0">
        <header className="px-4 py-4">
          <h2 className="text-xl font-semibold text-[#210535]">시나리오 생성기</h2>
          {contextLabel && (
            <p className="text-base text-gray-900 font-semibold mt-2">
              {contextLabel}
            </p>
          )}
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 text-base">
          <div>
            <div className="grid grid-cols-12 gap-2 mb-2 text-[15px] font-semibold text-[#4A3C85]">
              <div className="col-span-3">이름</div>
              <div className="col-span-3">성별</div>
              <div className="col-span-2">나이</div>
              <div className="col-span-4">CC</div>
            </div>
            <div className="grid grid-cols-12 gap-2 mb-3">
              <input
                className={`${inputBase} col-span-3`}
                value={meta.name}
                onChange={(e) => updateMeta("name", e.target.value)}
                placeholder="예: 이춘배"
                disabled={disabled}
              />
              <select
                className={`${inputBase} col-span-3`}
                value={meta.sex}
                onChange={(e) => updateMeta("sex", e.target.value)}
                disabled={disabled}
              >
                <option value="">성별 선택</option>
                <option value="남성">남성</option>
                <option value="여성">여성</option>
              </select>
              <input
                className={`${inputBase} col-span-2`}
                type="number"
                value={meta.age}
                onChange={(e) => updateMeta("age", Number(e.target.value) || 0)}
                placeholder="예: 48"
                disabled={disabled}
              />
              <input
                className={`${inputBase} col-span-4`}
                value={meta.chief_complaint}
                onChange={(e) => updateMeta("chief_complaint", e.target.value)}
                placeholder="예: 윗배 통증"
                disabled={disabled}
              />
            </div>

            <div className="mb-3">
              <div className="text-[15px] font-semibold text-[#4A3C85] mb-1">
                Case name
              </div>
              <input
                className={inputBase}
                value={caseName ?? ""}
                onChange={(e) => onCaseNameChange?.(e.target.value)}
                placeholder="예: 급성복통"
                disabled={disabled}
              />
            </div>

            <div className="mb-3">
              <div className="text-[15px] font-semibold text-[#4A3C85] mb-1">
                Impression
              </div>
              <textarea
                className={`${inputBase} min-h-[60px] h-full`}
                value={scenarioJson.title}
                onChange={(e) =>
                  onChange({
                    ...scenarioJson,
                    title: e.target.value,
                  })
                }
                placeholder="예: 충수돌기염이 급성 체장염인지 헷갈리는 moderate 중증도의 환자"
                disabled={disabled}
                onInput={autoResize}
              />
            </div>

            <div className="mb-3">
              <div className="text-[15px] font-semibold text-[#4A3C85] mb-1">
                Diagnosis
              </div>
              <input
                className={inputBase}
                value={meta.diagnosis ?? ""}
                onChange={(e) => updateMeta("diagnosis", e.target.value)}
                placeholder="예: 급성 충수돌기염"
                disabled={disabled}
              />
            </div>

            <div className="pt-3 border-t border-dashed border-[#E0DAFA]">
              <h3 className="text-base font-semibold text-[#210535] mb-2">
                Vital sign
              </h3>
              <div className="grid grid-cols-4 gap-2">
                <div className="space-y-1">
                  <div className="text-sm ml-1 text-[#6F659C]">혈압</div>
                  <input
                    className={inputBase}
                    value={meta.vitals.bp ?? ""}
                    onChange={(e) =>
                      updateMeta("vitals", { ...meta.vitals, bp: e.target.value })
                    }
                    placeholder="120/60"
                    disabled={disabled}
                  />
                </div>
                <div className="space-y-1">
                  <div className="text-sm ml-1 text-[#6F659C]">맥박</div>
                  <input
                    className={inputBase}
                    value={meta.vitals.hr || ""}
                    onChange={(e) =>
                      updateMeta("vitals", {
                        ...meta.vitals,
                        hr: Number(e.target.value) || 0,
                      })
                    }
                    placeholder="80"
                    disabled={disabled}
                  />
                </div>
                <div className="space-y-1">
                  <div className="text-sm ml-1 text-[#6F659C]">호흡수</div>
                  <input
                    className={inputBase}
                    value={meta.vitals.rr || ""}
                    onChange={(e) =>
                      updateMeta("vitals", {
                        ...meta.vitals,
                        rr: Number(e.target.value) || 0,
                      })
                    }
                    placeholder="18"
                    disabled={disabled}
                  />
                </div>
                <div className="space-y-1">
                  <div className="text-sm text-[#6F659C] ml-1">체온</div>
                  <input
                    className={inputBase}
                    type="number"
                    step="0.1"
                    value={meta.vitals.bt || ""}
                    onChange={(e) =>
                      updateMeta("vitals", {
                        ...meta.vitals,
                        bt: Number(e.target.value) || 0,
                      })
                    }
                    placeholder="36.7"
                    disabled={disabled}
                  />
                </div>
              </div>
            </div>

            <button
              type="button"
              className={`mt-4 w-full rounded-2xl text-white text-lg font-semibold py-3 shadow-sm transition-opacity ${
                disabled || !allFilled
                  ? "bg-[#C4B8F6] opacity-70 cursor-not-allowed"
                  : "bg-[#7553FC]"
              }`}
              disabled={disabled || !allFilled || isLoading}
              onClick={handleGenerate}
            >
              {isLoading ? (
                <Spinner size={18} borderClassName="border-white" />
              ) : (
                "시나리오 초안 생성하기"
              )}
            </button>
          </div>
        </div>
      </div>

      {generated && (
        <div className="border-t border-[#D8D2F5] px-4 py-3 bg-[#F9F8FF] space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-[#210535]">생성된 시나리오</h3>
            <button
              type="button"
              onClick={handleSave}
              disabled={disabled || isSaving}
              className={`rounded-lg px-3 py-2 text-sm font-semibold transition-opacity ${
                disabled || isSaving
                  ? "bg-[#E7E2FA] text-[#7D70B5] cursor-not-allowed"
                  : "bg-[#7553FC] text-white"
              }`}
            >
              {isSaving ? "저장 중..." : "DB 저장"}
            </button>
          </div>

          <div className="rounded-xl bg-white border border-[#E4DEF9] p-3 space-y-3">
            <div className="text-sm font-semibold text-[#210535]">기본 정보</div>
            <div className="grid grid-cols-12 gap-2 text-[15px] font-semibold text-[#4A3C85]">
              <div className="col-span-3">이름</div>
              <div className="col-span-3">성별</div>
              <div className="col-span-2">나이</div>
              <div className="col-span-4">CC</div>
            </div>
            <div className="grid grid-cols-12 gap-2 text-base text-[#1F2430]">
              <div className="col-span-3 rounded-lg bg-[#F8F7FF] border border-[#E4DEF9] px-3 py-2">
                {meta.name}
              </div>
              <div className="col-span-3 rounded-lg bg-[#F8F7FF] border border-[#E4DEF9] px-3 py-2">
                {meta.sex}
              </div>
              <div className="col-span-2 rounded-lg bg-[#F8F7FF] border border-[#E4DEF9] px-3 py-2">
                {meta.age}
              </div>
              <div className="col-span-4 rounded-lg bg-[#F8F7FF] border border-[#E4DEF9] px-3 py-2">
                {meta.chief_complaint}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold text-[#6F659C] mb-1">
                Impression
              </div>
              <div className="rounded-lg bg-[#F8F7FF] border border-[#E4DEF9] px-3 py-2 text-base text-[#1F2430]">
                {scenarioJson.title}
              </div>
            </div>
            {meta.diagnosis && (
              <div>
                <div className="text-xs font-semibold text-[#6F659C] mb-1">
                  Diagnosis
                </div>
                <div className="rounded-lg bg-[#F8F7FF] border border-[#E4DEF9] px-3 py-2 text-base text-[#1F2430]">
                  {meta.diagnosis}
                </div>
              </div>
            )}

            <div className="grid grid-cols-4 gap-2">
              {[
                { label: "혈압", value: meta.vitals.bp },
                { label: "맥박", value: meta.vitals.hr },
                { label: "호흡수", value: meta.vitals.rr },
                { label: "체온", value: meta.vitals.bt },
              ].map((item, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="text-sm ml-1 text-[#6F659C]">{item.label}</div>
                  <div className="rounded-lg bg-[#F8F7FF] border border-[#E4DEF9] px-3 py-2 text-base text-[#1F2430]">
                    {item.value as any}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3">
            <EditableSection
              title="병력 청취"
              data={generated.history}
              onChange={(next) =>
                updateGenerated({ ...generated, history: next as any })
              }
              onInput={autoResize}
            />
            <EditableSection
              title="추가 병력"
              data={generated.additional_history}
              onChange={(next) =>
                updateGenerated({ ...generated, additional_history: next as any })
              }
              onInput={autoResize}
            />
            <EditableSection
              title="신체 진찰"
              data={generated.physical_exam}
              onChange={(next) =>
                updateGenerated({ ...generated, physical_exam: next as any })
              }
              onInput={autoResize}
            />
          </div>
        </div>
      )}
      {error && <div className="px-4 pb-3 text-sm text-red-600">{error}</div>}
      {saveStatus && (
        <div
          className={`px-4 pb-3 text-sm ${
            saveStatus.kind === "success" ? "text-emerald-600" : "text-red-600"
          }`}
        >
          {saveStatus.message}
        </div>
      )}
    </section>
  );
};
