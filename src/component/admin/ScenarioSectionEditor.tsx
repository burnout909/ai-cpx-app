"use client";

import React, { useState } from "react";

type SectionValue = string | number | string[] | Record<string, string[] | string | number>;

interface ScenarioSectionEditorProps {
  title: string;
  data: Record<string, SectionValue>;
  onChange: (data: Record<string, SectionValue>) => void;
  disabled?: boolean;
}

export default function ScenarioSectionEditor({
  title,
  data,
  onChange,
  disabled = false,
}: ScenarioSectionEditorProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editingKeyName, setEditingKeyName] = useState("");

  const entries = Object.entries(data || {});
  const hasData = entries.length > 0;

  // Add new category/key
  const handleAddKey = () => {
    if (!newKeyName.trim() || disabled) return;
    const key = newKeyName.trim();
    if (data[key] !== undefined) {
      alert("이미 존재하는 키입니다.");
      return;
    }
    onChange({ ...data, [key]: [] });
    setNewKeyName("");
  };

  // Delete category/key
  const handleDeleteKey = (key: string) => {
    if (disabled) return;
    if (!confirm(`"${key}" 항목을 삭제하시겠습니까?`)) return;
    const newData = { ...data };
    delete newData[key];
    onChange(newData);
  };

  // Rename category/key
  const handleRenameKey = (oldKey: string) => {
    if (disabled || !editingKeyName.trim()) return;
    if (oldKey === editingKeyName.trim()) {
      setEditingKey(null);
      return;
    }
    if (data[editingKeyName.trim()] !== undefined) {
      alert("이미 존재하는 키입니다.");
      return;
    }
    const newData: Record<string, SectionValue> = {};
    for (const [key, value] of Object.entries(data)) {
      if (key === oldKey) {
        newData[editingKeyName.trim()] = value;
      } else {
        newData[key] = value;
      }
    }
    onChange(newData);
    setEditingKey(null);
  };

  // Add item to array
  const handleAddItem = (key: string) => {
    if (disabled) return;
    const value = data[key];
    if (Array.isArray(value)) {
      onChange({ ...data, [key]: [...value, ""] });
    } else if (typeof value === "object" && value !== null) {
      // For nested objects, add a new key
      const subKey = `항목${Object.keys(value).length + 1}`;
      onChange({ ...data, [key]: { ...value, [subKey]: [] } });
    }
  };

  // Update item in array
  const handleUpdateItem = (key: string, index: number, newValue: string) => {
    if (disabled) return;
    const value = data[key];
    if (Array.isArray(value)) {
      const newArray = [...value];
      newArray[index] = newValue;
      onChange({ ...data, [key]: newArray });
    }
  };

  // Delete item from array
  const handleDeleteItem = (key: string, index: number) => {
    if (disabled) return;
    const value = data[key];
    if (Array.isArray(value)) {
      const newArray = value.filter((_, i) => i !== index);
      onChange({ ...data, [key]: newArray });
    }
  };

  // Update number value
  const handleUpdateNumber = (key: string, newValue: number) => {
    if (disabled) return;
    onChange({ ...data, [key]: newValue });
  };

  // Nested object handlers
  const handleUpdateNestedItem = (
    parentKey: string,
    subKey: string,
    index: number,
    newValue: string
  ) => {
    if (disabled) return;
    const parent = data[parentKey] as Record<string, string[]>;
    if (!parent || !Array.isArray(parent[subKey])) return;
    const newArray = [...parent[subKey]];
    newArray[index] = newValue;
    onChange({
      ...data,
      [parentKey]: { ...parent, [subKey]: newArray },
    });
  };

  const handleDeleteNestedItem = (parentKey: string, subKey: string, index: number) => {
    if (disabled) return;
    const parent = data[parentKey] as Record<string, string[]>;
    if (!parent || !Array.isArray(parent[subKey])) return;
    const newArray = parent[subKey].filter((_, i) => i !== index);
    onChange({
      ...data,
      [parentKey]: { ...parent, [subKey]: newArray },
    });
  };

  const handleAddNestedItem = (parentKey: string, subKey: string) => {
    if (disabled) return;
    const parent = data[parentKey] as Record<string, string[]>;
    if (!parent || !Array.isArray(parent[subKey])) return;
    onChange({
      ...data,
      [parentKey]: { ...parent, [subKey]: [...parent[subKey], ""] },
    });
  };

  const handleDeleteNestedKey = (parentKey: string, subKey: string) => {
    if (disabled) return;
    if (!confirm(`"${subKey}" 항목을 삭제하시겠습니까?`)) return;
    const parent = { ...(data[parentKey] as Record<string, string[]>) };
    delete parent[subKey];
    onChange({ ...data, [parentKey]: parent });
  };

  const handleAddNestedKey = (parentKey: string, newSubKey: string) => {
    if (disabled || !newSubKey.trim()) return;
    const parent = data[parentKey] as Record<string, string[]>;
    if (!parent) return;
    if (parent[newSubKey.trim()] !== undefined) {
      alert("이미 존재하는 키입니다.");
      return;
    }
    onChange({
      ...data,
      [parentKey]: { ...parent, [newSubKey.trim()]: [] },
    });
  };

  // Render value based on type
  const renderValue = (key: string, value: SectionValue) => {
    // String array
    if (Array.isArray(value)) {
      return (
        <div className="space-y-2">
          {value.map((item, idx) => (
            <div key={idx} className="flex items-start gap-2">
              <span className="text-xs text-gray-400 mt-2 w-4 flex-shrink-0">{idx + 1}</span>
              <textarea
                value={item}
                onChange={(e) => handleUpdateItem(key, idx, e.target.value)}
                disabled={disabled}
                className="flex-1 text-sm border border-gray-200 rounded px-2 py-1.5 min-h-[36px] resize-y focus:outline-none focus:ring-2 focus:ring-violet-200 disabled:bg-gray-50"
                placeholder="내용 입력..."
              />
              <button
                type="button"
                onClick={() => handleDeleteItem(key, idx)}
                disabled={disabled}
                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded disabled:opacity-50"
                title="삭제"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => handleAddItem(key)}
            disabled={disabled}
            className="flex items-center gap-1 text-xs text-violet-600 hover:text-violet-700 disabled:opacity-50"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            항목 추가
          </button>
        </div>
      );
    }

    // Number
    if (typeof value === "number") {
      return (
        <input
          type="number"
          value={value}
          onChange={(e) => handleUpdateNumber(key, Number(e.target.value) || 0)}
          disabled={disabled}
          className="w-24 text-sm border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-200 disabled:bg-gray-50"
        />
      );
    }

    // Nested object
    if (typeof value === "object" && value !== null) {
      return (
        <NestedObjectEditor
          parentKey={key}
          data={value as Record<string, string[]>}
          disabled={disabled}
          onUpdateItem={handleUpdateNestedItem}
          onDeleteItem={handleDeleteNestedItem}
          onAddItem={handleAddNestedItem}
          onDeleteKey={handleDeleteNestedKey}
          onAddKey={handleAddNestedKey}
        />
      );
    }

    // String (single value)
    if (typeof value === "string") {
      return (
        <textarea
          value={value}
          onChange={(e) => onChange({ ...data, [key]: e.target.value })}
          disabled={disabled}
          className="w-full text-sm border border-gray-200 rounded px-2 py-1.5 min-h-[36px] resize-y focus:outline-none focus:ring-2 focus:ring-violet-200 disabled:bg-gray-50"
          placeholder="내용 입력..."
        />
      );
    }

    return null;
  };

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">{title}</span>
          {hasData ? (
            <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded">
              {entries.length}개 항목
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
        <div className="p-4 space-y-4 border-t border-gray-200">
          {/* Existing entries */}
          {entries.map(([key, value]) => (
            <div key={key} className="border border-gray-100 rounded-lg p-3 bg-white">
              {/* Key header */}
              <div className="flex items-center gap-2 mb-2">
                {editingKey === key ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="text"
                      value={editingKeyName}
                      onChange={(e) => setEditingKeyName(e.target.value)}
                      className="flex-1 text-sm font-medium border border-violet-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-violet-200"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRenameKey(key);
                        if (e.key === "Escape") setEditingKey(null);
                      }}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => handleRenameKey(key)}
                      className="px-2 py-1 text-xs text-white bg-violet-600 rounded hover:bg-violet-700"
                    >
                      확인
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingKey(null)}
                      className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded"
                    >
                      취소
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="text-sm font-medium text-gray-800 flex-1">{key}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingKey(key);
                        setEditingKeyName(key);
                      }}
                      disabled={disabled}
                      className="p-1 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded disabled:opacity-50"
                      title="이름 변경"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteKey(key)}
                      disabled={disabled}
                      className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded disabled:opacity-50"
                      title="삭제"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </>
                )}
              </div>

              {/* Value editor */}
              {renderValue(key, value)}
            </div>
          ))}

          {/* Add new key */}
          <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
            <input
              type="text"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              disabled={disabled}
              className="flex-1 text-sm border border-gray-200 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-200 disabled:bg-gray-50"
              placeholder="새 카테고리 이름 (예: O(onset))"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddKey();
              }}
            />
            <button
              type="button"
              onClick={handleAddKey}
              disabled={disabled || !newKeyName.trim()}
              className="px-3 py-2 text-sm font-medium text-white bg-violet-600 rounded hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              추가
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Nested object editor component
interface NestedObjectEditorProps {
  parentKey: string;
  data: Record<string, string[] | string | number>;
  disabled: boolean;
  onUpdateItem: (parentKey: string, subKey: string, index: number, value: string) => void;
  onDeleteItem: (parentKey: string, subKey: string, index: number) => void;
  onAddItem: (parentKey: string, subKey: string) => void;
  onDeleteKey: (parentKey: string, subKey: string) => void;
  onAddKey: (parentKey: string, newSubKey: string) => void;
}

function NestedObjectEditor({
  parentKey,
  data,
  disabled,
  onUpdateItem,
  onDeleteItem,
  onAddItem,
  onDeleteKey,
  onAddKey,
}: NestedObjectEditorProps) {
  const [newSubKey, setNewSubKey] = useState("");

  return (
    <div className="space-y-3 pl-4 border-l-2 border-violet-100">
      {Object.entries(data).map(([subKey, value]) => (
        <div key={subKey} className="bg-gray-50 rounded-lg p-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-violet-700">{subKey}</span>
            <button
              type="button"
              onClick={() => onDeleteKey(parentKey, subKey)}
              disabled={disabled}
              className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded disabled:opacity-50"
              title="삭제"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {Array.isArray(value) ? (
            <div className="space-y-1.5">
              {value.map((item, idx) => (
                <div key={idx} className="flex items-start gap-1.5">
                  <textarea
                    value={item}
                    onChange={(e) => onUpdateItem(parentKey, subKey, idx, e.target.value)}
                    disabled={disabled}
                    className="flex-1 text-xs border border-gray-200 rounded px-2 py-1 min-h-[28px] resize-y focus:outline-none focus:ring-2 focus:ring-violet-200 disabled:bg-gray-100"
                    placeholder="내용..."
                  />
                  <button
                    type="button"
                    onClick={() => onDeleteItem(parentKey, subKey, idx)}
                    disabled={disabled}
                    className="p-1 text-gray-400 hover:text-red-500 rounded disabled:opacity-50"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => onAddItem(parentKey, subKey)}
                disabled={disabled}
                className="flex items-center gap-1 text-xs text-violet-600 hover:text-violet-700 disabled:opacity-50"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                추가
              </button>
            </div>
          ) : (
            <span className="text-xs text-gray-600">{String(value)}</span>
          )}
        </div>
      ))}

      {/* Add new sub-key */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={newSubKey}
          onChange={(e) => setNewSubKey(e.target.value)}
          disabled={disabled}
          className="flex-1 text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-violet-200 disabled:bg-gray-50"
          placeholder="새 하위 항목 (예: smoking)"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onAddKey(parentKey, newSubKey);
              setNewSubKey("");
            }
          }}
        />
        <button
          type="button"
          onClick={() => {
            onAddKey(parentKey, newSubKey);
            setNewSubKey("");
          }}
          disabled={disabled || !newSubKey.trim()}
          className="px-2 py-1 text-xs font-medium text-violet-600 border border-violet-300 rounded hover:bg-violet-50 disabled:opacity-50"
        >
          추가
        </button>
      </div>
    </div>
  );
}
