"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  CHIEF_COMPLAINTS_BY_CATEGORY,
  ChiefComplaint,
  ChiefComplaintCategory,
} from "@/constants/chiefComplaints";

interface ChiefComplaintDropdownProps {
  value: ChiefComplaint | null;
  onChange: (value: ChiefComplaint | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

interface FilteredItem {
  name: ChiefComplaint;
  category: ChiefComplaintCategory;
}

export default function ChiefComplaintDropdown({
  value,
  onChange,
  placeholder = "주호소 검색 또는 선택",
  disabled = false,
  className = "",
}: ChiefComplaintDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // 필터링된 항목 계산
  const filteredItems: FilteredItem[] = [];
  for (const [category, complaints] of Object.entries(CHIEF_COMPLAINTS_BY_CATEGORY)) {
    for (const name of complaints) {
      if (
        !searchTerm ||
        name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        category.toLowerCase().includes(searchTerm.toLowerCase())
      ) {
        filteredItems.push({
          name: name as ChiefComplaint,
          category: category as ChiefComplaintCategory,
        });
      }
    }
  }

  // 외부 클릭 감지
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchTerm("");
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 하이라이트된 항목이 보이도록 스크롤
  useEffect(() => {
    if (isOpen && listRef.current) {
      const highlighted = listRef.current.children[highlightedIndex] as HTMLElement;
      if (highlighted) {
        highlighted.scrollIntoView({ block: "nearest" });
      }
    }
  }, [highlightedIndex, isOpen]);

  // 키보드 네비게이션
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen) {
        if (e.key === "ArrowDown" || e.key === "Enter") {
          setIsOpen(true);
          e.preventDefault();
        }
        return;
      }

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setHighlightedIndex((prev) =>
            prev < filteredItems.length - 1 ? prev + 1 : prev
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : 0));
          break;
        case "Enter":
          e.preventDefault();
          if (filteredItems[highlightedIndex]) {
            onChange(filteredItems[highlightedIndex].name);
            setIsOpen(false);
            setSearchTerm("");
          }
          break;
        case "Escape":
          e.preventDefault();
          setIsOpen(false);
          setSearchTerm("");
          break;
      }
    },
    [isOpen, highlightedIndex, filteredItems, onChange]
  );

  const handleSelect = (item: FilteredItem) => {
    onChange(item.name);
    setIsOpen(false);
    setSearchTerm("");
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
    setSearchTerm("");
  };

  // 카테고리별 색상 (모두 중립 색상 사용)
  const categoryColors: Record<ChiefComplaintCategory, string> = {
    소화기: "bg-gray-100 text-gray-700",
    순환기: "bg-gray-100 text-gray-700",
    호흡기: "bg-gray-100 text-gray-700",
    비뇨기: "bg-gray-100 text-gray-700",
    전신계통: "bg-gray-100 text-gray-700",
    피부관절: "bg-gray-100 text-gray-700",
    정신신경: "bg-gray-100 text-gray-700",
    여성소아: "bg-gray-100 text-gray-700",
    상담: "bg-gray-100 text-gray-700",
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* 입력 필드 */}
      <div
        className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${
          disabled
            ? "cursor-not-allowed bg-gray-50 border-gray-200"
            : isOpen
            ? "border-violet-500 ring-2 ring-violet-200"
            : "border-gray-300 hover:border-gray-400 cursor-pointer"
        }`}
        onClick={() => {
          if (!disabled) {
            setIsOpen(true);
            setTimeout(() => inputRef.current?.focus(), 0);
          }
        }}
      >
        {isOpen ? (
          <input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setHighlightedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="flex-1 text-sm outline-none bg-transparent"
            disabled={disabled}
          />
        ) : (
          <span className={`flex-1 text-sm ${value ? "text-gray-900" : "text-gray-400"}`}>
            {value || placeholder}
          </span>
        )}

        {/* 선택 해제 버튼 */}
        {value && !disabled && !isOpen && (
          <button
            type="button"
            onClick={handleClear}
            className="p-1 text-gray-400 hover:text-gray-600"
          >
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        )}

        {/* 드롭다운 화살표 */}
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </div>

      {/* 드롭다운 목록 */}
      {isOpen && (
        <ul
          ref={listRef}
          className="absolute z-50 mt-1 w-full max-h-64 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg"
        >
          {filteredItems.length === 0 ? (
            <li className="px-3 py-2 text-sm text-gray-500 text-center">
              검색 결과가 없습니다
            </li>
          ) : (
            filteredItems.map((item, index) => (
              <li
                key={item.name}
                onClick={() => handleSelect(item)}
                className={`flex items-center justify-between px-3 py-2 text-sm cursor-pointer ${
                  index === highlightedIndex
                    ? "bg-violet-50"
                    : "hover:bg-gray-50"
                } ${value === item.name ? "font-semibold text-violet-700" : "text-gray-900"}`}
              >
                <span>{item.name}</span>
                <span
                  className={`text-xs px-2 py-0.5 rounded ${categoryColors[item.category]}`}
                >
                  {item.category}
                </span>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
