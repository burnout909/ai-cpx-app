"use client";

import { ChecklistItemState, ChecklistJson } from "@/types/dashboard";
import React, { useState } from "react";

interface ChecklistLinkModuleProps {
  checklistJson: ChecklistJson;
  onChange: (next: ChecklistJson) => void;
  disabled?: boolean;
}

const checklistCriteriaClass = "text-base text-gray-800 font-medium";

const renderSection = (
  items: ChecklistItemState[],
  onToggle: (id: string) => void
) => (
  <div className="mb-6">
    <div className="space-y-6">
      {items.map((item) => (
        <label key={item.id} className="flex justify-between gap-4 px-2">
          <div>
            <div className="text-base font-semibold text-black mb-0.5">
              {item.title}
            </div>
            <div className={checklistCriteriaClass}>{item.criteria}</div>
          </div>
          <input
            type="checkbox"
            className="h-[18px] w-[18px] rounded border-[#C6BDF7] text-[#8A78FF] focus:ring-[#8A78FF] shrink-0"
            checked={item.checked}
            onChange={() => onToggle(item.id)}
          />
        </label>
      ))}
    </div>
  </div>
);

export const ChecklistPannel: React.FC<ChecklistLinkModuleProps> = ({
  checklistJson,
  onChange,
  disabled = false,
}) => {
  const tabs: { key: keyof ChecklistJson; label: string }[] = [
    { key: "history", label: "병력 청취" },
    { key: "physicalExam", label: "신체 진찰" },
    { key: "education", label: "환자 교육" },
    { key: "ppi", label: "환자-의사관계" },
  ];
  const [activeTab, setActiveTab] = useState<keyof ChecklistJson>("history");

  const toggleInSection = (sectionKey: keyof ChecklistJson, id: string) => {
    const section = checklistJson[sectionKey];
    const updated = section.map((item) =>
      item.id === id ? { ...item, checked: !item.checked } : item
    );

    onChange({
      ...checklistJson,
      [sectionKey]: updated,
    });
  };

  return (
    <section className="flex flex-1 min-w-0 flex-col h-[calc(100vh-120px)] rounded-2xl border border-[#D8D2F5] bg-white shadow-sm">
      <header className="p-4">
        <h2 className="text-xl font-semibold text-[#210535]">체크리스트 확정</h2>
      </header>

      <div className="px-4 pb-2 flex gap-2">
        {tabs.map((tab) => {
          const isActive = tab.key === activeTab;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => !disabled && setActiveTab(tab.key)}
              disabled={disabled}
              className={`rounded-lg px-3 py-2 text-base font-semibold transition-colors border ${
                isActive
                  ? "bg-[#7553FC] text-white border-[#6A4EF5]"
                  : "bg-[#F1EDFF] text-[#4A3C85] border-[#E0DAFA]"
              } ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-scroll px-4 py-3 text-[20px] space-y-5">
        {renderSection(
          checklistJson[activeTab],
          (id) => !disabled && toggleInSection(activeTab, id)
        )}
      </div>
    </section>
  );
};
