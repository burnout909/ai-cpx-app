"use client";

import React, { useState, useMemo } from "react";

interface ChecklistItem {
  id: string;
  title: string;
  criteria: string;
}

interface ChecklistSnapshot {
  history: ChecklistItem[];
  physicalExam: ChecklistItem[];
  education: ChecklistItem[];
  ppi: ChecklistItem[];
}

interface ChecklistIncludedMap {
  [itemId: string]: boolean;
}

interface ChecklistConfirmPanelProps {
  checklistSnapshot: ChecklistSnapshot | null;
  includedMap: ChecklistIncludedMap;
  onChange: (map: ChecklistIncludedMap) => void;
  disabled?: boolean;
  sourceVersion?: string;
  confirmedAt?: string | null;
  onReloadFromDefault?: () => void;
}

const TABS: { key: keyof ChecklistSnapshot; label: string }[] = [
  { key: "history", label: "병력 청취" },
  { key: "physicalExam", label: "신체 진찰" },
  { key: "education", label: "환자 교육" },
  { key: "ppi", label: "환자-의사관계" },
];

export default function ChecklistConfirmPanel({
  checklistSnapshot,
  includedMap,
  onChange,
  disabled = false,
  sourceVersion,
  confirmedAt,
  onReloadFromDefault,
}: ChecklistConfirmPanelProps) {
  const [activeTab, setActiveTab] = useState<keyof ChecklistSnapshot>("history");
  const [showReloadModal, setShowReloadModal] = useState(false);

  // 현재 탭의 항목들
  const currentItems = useMemo(() => {
    if (!checklistSnapshot) return [];
    return checklistSnapshot[activeTab] || [];
  }, [checklistSnapshot, activeTab]);

  // 항목 토글
  const toggleItem = (itemId: string) => {
    if (disabled) return;
    onChange({
      ...includedMap,
      [itemId]: !includedMap[itemId],
    });
  };

  // 전체 선택/해제
  const toggleAll = (select: boolean) => {
    if (disabled || !checklistSnapshot) return;
    const newMap = { ...includedMap };
    currentItems.forEach((item) => {
      newMap[item.id] = select;
    });
    onChange(newMap);
  };

  // 통계 계산
  const stats = useMemo(() => {
    if (!checklistSnapshot) return { total: 0, included: 0, excluded: 0 };

    let total = 0;
    let included = 0;

    for (const section of Object.values(checklistSnapshot)) {
      if (!Array.isArray(section)) continue;
      for (const item of section as ChecklistItem[]) {
        total++;
        if (includedMap[item.id] !== false) {
          included++;
        }
      }
    }

    return { total, included, excluded: total - included };
  }, [checklistSnapshot, includedMap]);

  // 탭별 통계
  const tabStats = useMemo(() => {
    const result: Record<keyof ChecklistSnapshot, { total: number; included: number }> = {
      history: { total: 0, included: 0 },
      physicalExam: { total: 0, included: 0 },
      education: { total: 0, included: 0 },
      ppi: { total: 0, included: 0 },
    };

    if (!checklistSnapshot) return result;

    for (const [key, items] of Object.entries(checklistSnapshot)) {
      // result에 해당 키가 있는 경우만 처리
      if (key in result && Array.isArray(items)) {
        const k = key as keyof ChecklistSnapshot;
        result[k].total = items.length;
        result[k].included = items.filter((item: ChecklistItem) => includedMap[item.id] !== false).length;
      }
    }

    return result;
  }, [checklistSnapshot, includedMap]);

  if (!checklistSnapshot) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 space-y-2">
        <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
          />
        </svg>
        <p className="text-sm">체크리스트가 로드되지 않았습니다.</p>
        <p className="text-xs text-gray-400">체크리스트가 생성되어 있나요?</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <div className="px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-gray-900">체크리스트 확정</h3>
            {onReloadFromDefault && (
              <button
                type="button"
                onClick={() => setShowReloadModal(true)}
                disabled={disabled}
                className="rounded-lg px-3 py-1.5 text-sm font-medium border bg-white text-violet-600 border-violet-300 hover:bg-violet-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                기본 체크리스트 불러오기
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="px-2 py-1 bg-violet-50 text-violet-700 rounded">
              포함: {stats.included}
            </span>
            <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded">
              제외: {stats.excluded}
            </span>
          </div>
        </div>

        {/* 메타 정보 */}
        <div className="flex items-center gap-3 text-xs text-gray-500">
          {confirmedAt && (
            <span>확정: {new Date(confirmedAt).toLocaleDateString("ko-KR")}</span>
          )}
        </div>
      </div>

      {/* 탭 */}
      <div className="px-4 py-2 flex gap-2 border-b border-gray-100">
        {TABS.map((tab) => {
          const isActive = tab.key === activeTab;
          const tabStat = tabStats[tab.key];
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              disabled={disabled}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors border ${
                isActive
                  ? "bg-violet-600 text-white border-violet-600"
                  : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
              } ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
            >
              {tab.label}
              <span
                className={`ml-1.5 text-xs ${
                  isActive ? "text-violet-200" : "text-gray-400"
                }`}
              >
                {tabStat.included}/{tabStat.total}
              </span>
            </button>
          );
        })}
      </div>

      {/* 액션 버튼 */}
      <div className="px-4 py-2 flex gap-2 border-b border-gray-100">
        <button
          type="button"
          onClick={() => toggleAll(true)}
          disabled={disabled}
          className="px-3 py-1 text-xs text-violet-600 hover:bg-violet-50 rounded transition-colors disabled:opacity-50"
        >
          전체 선택
        </button>
        <button
          type="button"
          onClick={() => toggleAll(false)}
          disabled={disabled}
          className="px-3 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded transition-colors disabled:opacity-50"
        >
          전체 해제
        </button>
      </div>

      {/* 항목 목록 */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <div className="space-y-3">
          {currentItems.map((item) => {
            const isIncluded = includedMap[item.id] !== false;
            return (
              <label
                key={item.id}
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  isIncluded
                    ? "bg-white border-gray-200 hover:border-violet-300"
                    : "bg-gray-50 border-gray-100 opacity-60"
                } ${disabled ? "cursor-not-allowed" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={isIncluded}
                  onChange={() => toggleItem(item.id)}
                  disabled={disabled}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500"
                />
                <div className="flex-1 min-w-0">
                  <div
                    className={`text-sm font-medium ${
                      isIncluded ? "text-gray-900" : "text-gray-500 line-through"
                    }`}
                  >
                    {item.title}
                  </div>
                  <div
                    className={`text-xs mt-0.5 ${
                      isIncluded ? "text-gray-600" : "text-gray-400"
                    }`}
                  >
                    {item.criteria}
                  </div>
                </div>
              </label>
            );
          })}
        </div>

        {currentItems.length === 0 && (
          <div className="text-center py-8 text-gray-400 text-sm">
            이 섹션에 항목이 없습니다.
          </div>
        )}
      </div>

      {/* 기본 체크리스트 불러오기 확인 모달 */}
      {showReloadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
            <h3 className="text-base font-semibold text-gray-900 mb-2">
              기본 체크리스트 불러오기
            </h3>
            <p className="text-sm text-gray-600 mb-5">
              현재 체크리스트를 최신 기본 체크리스트로 교체합니다.
              <br />
              기존 포함/제외 설정이 초기화됩니다.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowReloadModal(false)}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowReloadModal(false);
                  onReloadFromDefault?.();
                }}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-violet-600 rounded-lg hover:bg-violet-700 transition-colors"
              >
                불러오기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
