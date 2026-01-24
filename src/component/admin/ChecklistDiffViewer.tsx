"use client";

import { useState, useMemo, useCallback } from "react";
import { DiffItem, EvidenceChecklistItem, ChecklistJson } from "@/utils/checklistCsvParser";

interface ChecklistDiffViewerProps {
  diff: DiffItem[];
  existingChecklist: ChecklistJson | null;
  newChecklist: ChecklistJson;
  onApplySelections: (result: ChecklistJson) => void;
  nextVersion?: string;
  isLoading?: boolean;
}

type SelectionState = {
  // added: id -> true(포함) / false(제외)
  added: Record<string, boolean>;
  // removed: id -> true(삭제) / false(유지)
  removed: Record<string, boolean>;
  // modified: id -> 'new'(새 버전) / 'old'(기존 버전)
  modified: Record<string, "new" | "old">;
};

const SECTION_LABELS: Record<string, { label: string; color: string; bgColor: string }> = {
  history: { label: "병력청취", color: "text-gray-700", bgColor: "bg-gray-100" },
  physicalexam: { label: "신체진찰", color: "text-gray-700", bgColor: "bg-gray-100" },
  education: { label: "환자교육", color: "text-gray-700", bgColor: "bg-gray-100" },
  ppi: { label: "PPI", color: "text-gray-700", bgColor: "bg-gray-100" },
};

const SECTION_KEY_MAP: Record<string, keyof ChecklistJson> = {
  history: "HistoryEvidenceChecklist",
  physicalexam: "PhysicalexamEvidenceChecklist",
  education: "EducationEvidenceChecklist",
  ppi: "PpiEvidenceChecklist",
};

export default function ChecklistDiffViewer({
  diff,
  existingChecklist,
  newChecklist,
  onApplySelections,
  nextVersion,
  isLoading = false,
}: ChecklistDiffViewerProps) {
  // 초기 선택 상태: 모든 변경사항 적용
  const [selections, setSelections] = useState<SelectionState>(() => ({
    added: Object.fromEntries(
      diff.filter((d) => d.type === "added").map((d) => [d.id, true])
    ),
    removed: Object.fromEntries(
      diff.filter((d) => d.type === "removed").map((d) => [d.id, true])
    ),
    modified: Object.fromEntries(
      diff.filter((d) => d.type === "modified").map((d) => [d.id, "new" as const])
    ),
  }));

  const added = diff.filter((d) => d.type === "added");
  const removed = diff.filter((d) => d.type === "removed");
  const modified = diff.filter((d) => d.type === "modified");

  // 섹션별 그룹화
  const groupBySection = useCallback((items: DiffItem[]) => {
    const grouped: Record<string, DiffItem[]> = {};
    for (const item of items) {
      if (!grouped[item.section]) {
        grouped[item.section] = [];
      }
      grouped[item.section].push(item);
    }
    return grouped;
  }, []);

  const addedBySection = useMemo(() => groupBySection(added), [added, groupBySection]);
  const removedBySection = useMemo(() => groupBySection(removed), [removed, groupBySection]);
  const modifiedBySection = useMemo(() => groupBySection(modified), [modified, groupBySection]);

  // 전체 선택/해제
  const handleSelectAll = () => {
    setSelections({
      added: Object.fromEntries(added.map((d) => [d.id, true])),
      removed: Object.fromEntries(removed.map((d) => [d.id, true])),
      modified: Object.fromEntries(modified.map((d) => [d.id, "new" as const])),
    });
  };

  const handleDeselectAll = () => {
    setSelections({
      added: Object.fromEntries(added.map((d) => [d.id, false])),
      removed: Object.fromEntries(removed.map((d) => [d.id, false])),
      modified: Object.fromEntries(modified.map((d) => [d.id, "old" as const])),
    });
  };

  // 최종 체크리스트 생성 및 적용
  const handleApply = () => {
    const result: ChecklistJson = {
      HistoryEvidenceChecklist: [],
      PhysicalexamEvidenceChecklist: [],
      EducationEvidenceChecklist: [],
      PpiEvidenceChecklist: [],
    };

    // 각 섹션 처리
    for (const [sectionLabel, key] of Object.entries(SECTION_KEY_MAP)) {
      const existingItems = existingChecklist?.[key] ?? [];
      const newItems = newChecklist[key];

      // 기존 항목 중 삭제되지 않은 것들
      const removedIds = new Set(
        removed
          .filter((d) => d.section === sectionLabel && selections.removed[d.id])
          .map((d) => d.id)
      );

      // 수정된 항목 매핑
      const modifiedMap = new Map<string, EvidenceChecklistItem>();
      for (const m of modified.filter((d) => d.section === sectionLabel)) {
        if (selections.modified[m.id] === "new" && m.newValue) {
          modifiedMap.set(m.id, m.newValue);
        } else if (selections.modified[m.id] === "old" && m.oldValue) {
          modifiedMap.set(m.id, m.oldValue);
        }
      }

      // 기존 항목 유지 (삭제 제외, 수정 적용)
      for (const item of existingItems) {
        if (!removedIds.has(item.id)) {
          if (modifiedMap.has(item.id)) {
            result[key].push(modifiedMap.get(item.id)!);
          } else {
            result[key].push(item);
          }
        }
      }

      // 추가된 항목 삽입 (선택된 것만)
      for (const a of added.filter((d) => d.section === sectionLabel)) {
        if (selections.added[a.id] && a.newValue) {
          result[key].push(a.newValue);
        }
      }
    }

    onApplySelections(result);
  };

  // 변경 요약 계산
  const summary = useMemo(() => {
    const includedAdded = Object.values(selections.added).filter(Boolean).length;
    const includedRemoved = Object.values(selections.removed).filter(Boolean).length;
    const includedModified = Object.values(selections.modified).filter(
      (v) => v === "new"
    ).length;

    return { includedAdded, includedRemoved, includedModified };
  }, [selections]);

  if (diff.length === 0) {
    return (
      <div className="rounded-lg bg-gray-50 p-4 text-center text-sm text-gray-600">
        변경 사항이 없습니다.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 헤더 및 요약 */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">변경 사항 검토</h3>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSelectAll}
            className="px-2 py-1 text-xs text-violet-600 hover:bg-violet-50 rounded"
          >
            전체 적용
          </button>
          <button
            type="button"
            onClick={handleDeselectAll}
            className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded"
          >
            전체 취소
          </button>
        </div>
      </div>

      {/* 적용될 변경사항 요약 */}
      <div className="flex gap-4 text-sm bg-gray-50 rounded-lg p-3">
        <span className="text-green-600">
          +{summary.includedAdded}/{added.length} 추가
        </span>
        <span className="text-red-600">
          -{summary.includedRemoved}/{removed.length} 삭제
        </span>
        <span className="text-yellow-600">
          ~{summary.includedModified}/{modified.length} 수정
        </span>
      </div>

      {/* 추가된 항목 */}
      {added.length > 0 && (
        <DiffSection
          title="추가된 항목"
          titleColor="text-green-700"
          items={addedBySection}
          type="added"
          selections={selections.added}
          onToggle={(id) =>
            setSelections((prev) => ({
              ...prev,
              added: { ...prev.added, [id]: !prev.added[id] },
            }))
          }
        />
      )}

      {/* 삭제된 항목 */}
      {removed.length > 0 && (
        <DiffSection
          title="삭제된 항목"
          titleColor="text-red-700"
          items={removedBySection}
          type="removed"
          selections={selections.removed}
          onToggle={(id) =>
            setSelections((prev) => ({
              ...prev,
              removed: { ...prev.removed, [id]: !prev.removed[id] },
            }))
          }
        />
      )}

      {/* 수정된 항목 */}
      {modified.length > 0 && (
        <ModifiedSection
          items={modifiedBySection}
          selections={selections.modified}
          onToggle={(id) =>
            setSelections((prev) => ({
              ...prev,
              modified: {
                ...prev.modified,
                [id]: prev.modified[id] === "new" ? "old" : "new",
              },
            }))
          }
        />
      )}

      {/* 저장 버튼 */}
      <button
        type="button"
        onClick={handleApply}
        disabled={isLoading}
        className="w-full rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
      >
        {isLoading ? "저장 중..." : nextVersion ? `v${nextVersion}로 저장` : "선택한 변경사항 저장"}
      </button>
    </div>
  );
}

// 추가/삭제 섹션 컴포넌트
function DiffSection({
  title,
  titleColor,
  items,
  type,
  selections,
  onToggle,
}: {
  title: string;
  titleColor: string;
  items: Record<string, DiffItem[]>;
  type: "added" | "removed";
  selections: Record<string, boolean>;
  onToggle: (id: string) => void;
}) {
  const bgColor = type === "added" ? "bg-green-50" : "bg-red-50";
  const borderColor = type === "added" ? "border-green-200" : "border-red-200";
  const textColor = type === "added" ? "text-green-800" : "text-red-800";
  const checkboxLabel =
    type === "added" ? "포함" : "삭제";
  const uncheckboxLabel =
    type === "added" ? "제외" : "유지";

  return (
    <div className="space-y-2">
      <h4 className={`text-sm font-medium ${titleColor}`}>{title}</h4>
      {Object.entries(items).map(([section, sectionItems]) => (
        <div key={section} className="space-y-1">
          <div
            className={`text-xs font-medium ${SECTION_LABELS[section]?.color || "text-gray-600"}`}
          >
            {SECTION_LABELS[section]?.label || section}
          </div>
          {sectionItems.map((item) => {
            const value = type === "added" ? item.newValue : item.oldValue;
            const isSelected = selections[item.id];

            return (
              <div
                key={item.id}
                className={`rounded border p-2 ${bgColor} ${borderColor} ${
                  !isSelected ? "opacity-50" : ""
                }`}
              >
                <div className="flex items-start gap-2">
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggle(item.id)}
                      className="rounded border-gray-300"
                    />
                    <span className="text-xs text-gray-500">
                      {isSelected ? checkboxLabel : uncheckboxLabel}
                    </span>
                  </label>
                  <div className="flex-1">
                    <div className={`text-sm font-medium ${textColor}`}>
                      {type === "added" ? "+" : "-"} {item.id}: {value?.title}
                    </div>
                    <div className="text-xs text-gray-600 mt-1 line-clamp-2">
                      {value?.criteria}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// 수정된 항목 섹션 컴포넌트
function ModifiedSection({
  items,
  selections,
  onToggle,
}: {
  items: Record<string, DiffItem[]>;
  selections: Record<string, "new" | "old">;
  onToggle: (id: string) => void;
}) {
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-yellow-700">수정된 항목</h4>
      <p className="text-xs text-gray-500">카드를 클릭하여 사용할 버전을 선택하세요</p>
      {Object.entries(items).map(([section, sectionItems]) => (
        <div key={section} className="space-y-1">
          <div
            className={`text-xs font-medium ${SECTION_LABELS[section]?.color || "text-gray-600"}`}
          >
            {SECTION_LABELS[section]?.label || section}
          </div>
          {sectionItems.map((item) => {
            const isNewSelected = selections[item.id] === "new";

            return (
              <div
                key={item.id}
                className="rounded border border-gray-200 bg-gray-50 p-2"
              >
                <div className="mb-2">
                  <span className="text-sm font-medium text-gray-700">
                    {item.id}
                  </span>
                </div>

                {/* 비교 표시 - 카드 클릭으로 선택 */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  {/* 기존 버전 카드 */}
                  <button
                    type="button"
                    onClick={() => isNewSelected && onToggle(item.id)}
                    className={`p-3 rounded text-left ${
                      !isNewSelected
                        ? "bg-white border-2 border-violet-500"
                        : "bg-gray-100 border border-gray-200 opacity-60"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-gray-600">기존</span>
                      {!isNewSelected && (
                        <span className="text-xs bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded">선택됨</span>
                      )}
                    </div>
                    <div className={!isNewSelected ? "text-gray-900" : "text-gray-400"}>
                      <div className="font-medium">{item.oldValue?.title}</div>
                      <div className="mt-1 line-clamp-2">{item.oldValue?.criteria}</div>
                    </div>
                  </button>

                  {/* 새 버전 카드 */}
                  <button
                    type="button"
                    onClick={() => !isNewSelected && onToggle(item.id)}
                    className={`p-3 rounded text-left ${
                      isNewSelected
                        ? "bg-white border-2 border-violet-500"
                        : "bg-gray-100 border border-gray-200 opacity-60"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-gray-600">새 버전</span>
                      {isNewSelected && (
                        <span className="text-xs bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded">선택됨</span>
                      )}
                    </div>
                    <div className={isNewSelected ? "text-gray-900" : "text-gray-400"}>
                      <div className="font-medium">{item.newValue?.title}</div>
                      <div className="mt-1 line-clamp-2">{item.newValue?.criteria}</div>
                    </div>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
