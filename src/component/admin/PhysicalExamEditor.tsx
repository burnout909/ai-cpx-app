"use client";

import React, { useState } from "react";
import { PhysicalExamData, PhysicalExamSection, PhysicalExamItem } from "@/types/dashboard";

// 신체진찰 영역 한글 라벨
const REGION_LABELS: Record<string, string> = {
  general: "General (전신)",
  heent: "HEENT (두경부)",
  neck: "Neck (경부)",
  chest_respiratory: "Chest/Respiratory (흉부/호흡기)",
  cardiac: "Cardiac (심장)",
  abdomen: "Abdomen (복부)",
  back_flank: "Back/Flank (등/옆구리)",
  extremities_upper: "Upper Extremities (상지)",
  extremities_lower: "Lower Extremities (하지)",
  neurologic_exam: "Neurologic (신경계)",
  skin: "Skin (피부)",
  genitourinary: "Genitourinary (비뇨생식기)",
  rectal: "Rectal (직장)",
  pelvic: "Pelvic (골반)",
  miscellaneous_pe: "Miscellaneous (기타)",
};

// 기본 영역 순서
const REGION_ORDER = [
  "general",
  "heent",
  "neck",
  "chest_respiratory",
  "cardiac",
  "abdomen",
  "back_flank",
  "extremities_upper",
  "extremities_lower",
  "neurologic_exam",
  "skin",
  "genitourinary",
  "rectal",
  "pelvic",
  "miscellaneous_pe",
];

interface PhysicalExamEditorProps {
  data: PhysicalExamData;
  onChange: (data: PhysicalExamData) => void;
  disabled?: boolean;
}

export default function PhysicalExamEditor({
  data,
  onChange,
  disabled = false,
}: PhysicalExamEditorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedRegions, setExpandedRegions] = useState<Set<string>>(new Set());

  // 데이터가 있는 영역 + 기본 영역 순서대로 정렬
  const regions = REGION_ORDER.filter(
    (region) => data[region] && Array.isArray(data[region]) && data[region]!.length > 0
  );
  const emptyRegions = REGION_ORDER.filter(
    (region) => !data[region] || !Array.isArray(data[region]) || data[region]!.length === 0
  );

  const toggleRegion = (region: string) => {
    const newExpanded = new Set(expandedRegions);
    if (newExpanded.has(region)) {
      newExpanded.delete(region);
    } else {
      newExpanded.add(region);
    }
    setExpandedRegions(newExpanded);
  };

  // Section 업데이트
  const updateSection = (
    region: string,
    sectionIndex: number,
    field: "title",
    value: string
  ) => {
    if (disabled) return;
    const sections = [...(data[region] || [])];
    sections[sectionIndex] = { ...sections[sectionIndex], [field]: value };
    onChange({ ...data, [region]: sections });
  };

  // Item 업데이트
  const updateItem = (
    region: string,
    sectionIndex: number,
    itemIndex: number,
    field: keyof PhysicalExamItem,
    value: string
  ) => {
    if (disabled) return;
    const sections = [...(data[region] || [])];
    const items = [...sections[sectionIndex].items];
    items[itemIndex] = { ...items[itemIndex], [field]: value };
    sections[sectionIndex] = { ...sections[sectionIndex], items };
    onChange({ ...data, [region]: sections });
  };

  // Item 추가
  const addItem = (region: string, sectionIndex: number) => {
    if (disabled) return;
    const sections = [...(data[region] || [])];
    const items = [...sections[sectionIndex].items, { maneuver: "", result: "" }];
    sections[sectionIndex] = { ...sections[sectionIndex], items };
    onChange({ ...data, [region]: sections });
  };

  // Item 삭제
  const deleteItem = (region: string, sectionIndex: number, itemIndex: number) => {
    if (disabled) return;
    const sections = [...(data[region] || [])];
    const items = sections[sectionIndex].items.filter((_, i) => i !== itemIndex);
    sections[sectionIndex] = { ...sections[sectionIndex], items };
    onChange({ ...data, [region]: sections });
  };

  // Section 추가
  const addSection = (region: string) => {
    if (disabled) return;
    const sections = [...(data[region] || []), { title: "", items: [] }];
    onChange({ ...data, [region]: sections });
  };

  // Section 삭제
  const deleteSection = (region: string, sectionIndex: number) => {
    if (disabled) return;
    const sections = (data[region] || []).filter((_, i) => i !== sectionIndex);
    onChange({ ...data, [region]: sections });
  };

  // Region 초기화 (빈 section 추가)
  const initializeRegion = (region: string) => {
    if (disabled) return;
    onChange({ ...data, [region]: [{ title: "", items: [] }] });
    setExpandedRegions(new Set([...expandedRegions, region]));
  };

  const totalSections = regions.reduce(
    (sum, region) => sum + (data[region]?.length || 0),
    0
  );

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">
            신체 진찰 (Physical Exam)
          </span>
          {regions.length > 0 ? (
            <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded">
              {regions.length}개 영역, {totalSections}개 섹션
            </span>
          ) : (
            <span className="text-xs text-gray-400">비어있음</span>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div className="p-4 space-y-3 border-t border-gray-200">
          {/* 데이터가 있는 영역들 */}
          {regions.map((region) => (
            <RegionEditor
              key={region}
              region={region}
              label={REGION_LABELS[region] || region}
              sections={data[region] || []}
              isExpanded={expandedRegions.has(region)}
              onToggle={() => toggleRegion(region)}
              onUpdateSection={(sectionIndex, field, value) =>
                updateSection(region, sectionIndex, field, value)
              }
              onUpdateItem={(sectionIndex, itemIndex, field, value) =>
                updateItem(region, sectionIndex, itemIndex, field, value)
              }
              onAddItem={(sectionIndex) => addItem(region, sectionIndex)}
              onDeleteItem={(sectionIndex, itemIndex) =>
                deleteItem(region, sectionIndex, itemIndex)
              }
              onAddSection={() => addSection(region)}
              onDeleteSection={(sectionIndex) => deleteSection(region, sectionIndex)}
              disabled={disabled}
            />
          ))}

          {/* 비어있는 영역 추가 버튼들 */}
          {emptyRegions.length > 0 && (
            <div className="pt-3 border-t border-gray-100">
              <p className="text-xs text-gray-500 mb-2">영역 추가:</p>
              <div className="flex flex-wrap gap-1.5">
                {emptyRegions.map((region) => (
                  <button
                    key={region}
                    type="button"
                    onClick={() => initializeRegion(region)}
                    disabled={disabled}
                    className="px-2 py-1 text-xs text-gray-600 bg-gray-100 rounded hover:bg-violet-100 hover:text-violet-700 disabled:opacity-50 transition-colors"
                  >
                    + {REGION_LABELS[region] || region}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Region Editor 컴포넌트
interface RegionEditorProps {
  region: string;
  label: string;
  sections: PhysicalExamSection[];
  isExpanded: boolean;
  onToggle: () => void;
  onUpdateSection: (sectionIndex: number, field: "title", value: string) => void;
  onUpdateItem: (
    sectionIndex: number,
    itemIndex: number,
    field: keyof PhysicalExamItem,
    value: string
  ) => void;
  onAddItem: (sectionIndex: number) => void;
  onDeleteItem: (sectionIndex: number, itemIndex: number) => void;
  onAddSection: () => void;
  onDeleteSection: (sectionIndex: number) => void;
  disabled: boolean;
}

function RegionEditor({
  label,
  sections,
  isExpanded,
  onToggle,
  onUpdateSection,
  onUpdateItem,
  onAddItem,
  onDeleteItem,
  onAddSection,
  onDeleteSection,
  disabled,
}: RegionEditorProps) {
  return (
    <div className="border border-gray-100 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2 bg-violet-50 hover:bg-violet-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-violet-800">{label}</span>
          <span className="text-xs text-violet-600">{sections.length}개 섹션</span>
        </div>
        <svg
          className={`w-3 h-3 text-violet-500 transition-transform ${isExpanded ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div className="p-3 space-y-3 bg-white">
          {sections.map((section, sectionIndex) => (
            <div
              key={sectionIndex}
              className="border border-gray-200 rounded-lg p-3 bg-gray-50"
            >
              {/* Section Title */}
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="text"
                  value={section.title}
                  onChange={(e) => onUpdateSection(sectionIndex, "title", e.target.value)}
                  disabled={disabled}
                  className="flex-1 text-xs font-medium border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-violet-200 disabled:bg-gray-100"
                  placeholder="섹션 제목 (예: Inspection, Palpation)"
                />
                <button
                  type="button"
                  onClick={() => onDeleteSection(sectionIndex)}
                  disabled={disabled}
                  className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded disabled:opacity-50"
                  title="섹션 삭제"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>

              {/* Items */}
              <div className="space-y-2">
                {section.items.map((item, itemIndex) => (
                  <div key={itemIndex} className="flex items-start gap-2 bg-white rounded p-2 border border-gray-100">
                    <div className="flex-1 space-y-1.5">
                      <input
                        type="text"
                        value={item.maneuver}
                        onChange={(e) => onUpdateItem(sectionIndex, itemIndex, "maneuver", e.target.value)}
                        disabled={disabled}
                        className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-violet-200 disabled:bg-gray-100"
                        placeholder="Maneuver (진찰 항목)"
                      />
                      <input
                        type="text"
                        value={item.result}
                        onChange={(e) => onUpdateItem(sectionIndex, itemIndex, "result", e.target.value)}
                        disabled={disabled}
                        className="w-full text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-violet-200 disabled:bg-gray-100"
                        placeholder="Result (결과)"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => onDeleteItem(sectionIndex, itemIndex)}
                      disabled={disabled}
                      className="p-1 text-gray-400 hover:text-red-500 rounded disabled:opacity-50"
                      title="항목 삭제"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() => onAddItem(sectionIndex)}
                  disabled={disabled}
                  className="flex items-center gap-1 text-xs text-violet-600 hover:text-violet-700 disabled:opacity-50"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  항목 추가
                </button>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={onAddSection}
            disabled={disabled}
            className="w-full flex items-center justify-center gap-1 py-2 text-xs text-violet-600 border border-dashed border-violet-300 rounded-lg hover:bg-violet-50 disabled:opacity-50"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            섹션 추가
          </button>
        </div>
      )}
    </div>
  );
}
