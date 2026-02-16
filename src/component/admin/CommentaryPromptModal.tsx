"use client";

import React, { useState, useEffect } from "react";
import { DEFAULT_COMMENTARY_PROMPT } from "@/constants/defaultPrompts";

const DEFAULT_PROMPT = DEFAULT_COMMENTARY_PROMPT;

export interface PromptVersion {
  version: string;
  prompt: string;
  createdAt: string;
}

interface CommentaryPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPrompt: string;
  currentVersion: string;
  promptHistory: PromptVersion[];
  onSave: (prompt: string, newVersion: string) => void;
  onReloadDefault?: () => void;
  hideResetButton?: boolean;
  sourceVersion?: string; // 스냅샷이 기반한 CC 프롬프트 버전 (e.g. "v0.1")
}

function formatVersion(version: string): string {
  const [major, minor] = version.split(".").map(Number);
  return `v${major}.${minor}`;
}

function incrementVersion(version: string): string {
  const [major, minor] = version.split(".").map(Number);
  return `${major}.${minor + 1}`;
}

export default function CommentaryPromptModal({
  isOpen,
  onClose,
  currentPrompt,
  currentVersion,
  promptHistory,
  onSave,
  onReloadDefault,
  hideResetButton = false,
  sourceVersion,
}: CommentaryPromptModalProps) {
  const [editedPrompt, setEditedPrompt] = useState(currentPrompt || DEFAULT_PROMPT);
  const [selectedHistoryVersion, setSelectedHistoryVersion] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setEditedPrompt(currentPrompt || DEFAULT_PROMPT);
      setSelectedHistoryVersion(null);
    }
  }, [isOpen, currentPrompt]);

  if (!isOpen) return null;

  const handleResetToDefault = () => {
    if (onReloadDefault) {
      onReloadDefault();
      onClose();
      return;
    }
    setEditedPrompt(DEFAULT_PROMPT);
    setSelectedHistoryVersion(null);
  };

  const handleSave = () => {
    const newVersion = incrementVersion(currentVersion);
    onSave(editedPrompt, newVersion);
    onClose();
  };

  const handleSelectVersion = (version: PromptVersion) => {
    setSelectedHistoryVersion(version.version);
    setEditedPrompt(version.prompt);
  };

  const handleUseCurrentVersion = () => {
    setSelectedHistoryVersion(null);
    setEditedPrompt(currentPrompt || DEFAULT_PROMPT);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-5xl mx-4 h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-gray-900">
              프롬프트 수정
            </h2>
            {currentVersion !== "snapshot" && (
              <span className="text-xs font-medium text-violet-600 bg-violet-50 px-2 py-0.5 rounded">
                현재 {formatVersion(currentVersion)}
              </span>
            )}
            {currentVersion === "snapshot" && (
              <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                시나리오 스냅샷{sourceVersion ? ` (${formatVersion(sourceVersion)} 기반)` : ""}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="닫기"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Left: Version History */}
          <div className="w-72 border-r border-gray-200 flex flex-col">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="text-sm font-medium text-gray-700">
                {currentVersion === "snapshot" ? "프롬프트 히스토리" : "버전 히스토리"}
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto">
              {/* 현재 스냅샷이 최신 히스토리와 다를 때만 "현재 스냅샷" 카드 표시 */}
              {promptHistory.length > 0 &&
                currentPrompt?.trim() !== promptHistory[0]?.prompt?.trim() && (
                <button
                  type="button"
                  onClick={handleUseCurrentVersion}
                  className={`w-full text-left px-4 py-3 border-b-2 border-violet-200 transition-colors ${selectedHistoryVersion === null
                      ? "bg-violet-50"
                      : "bg-gray-50 hover:bg-violet-50/50"
                    }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-violet-600 uppercase tracking-wide">
                      현재 스냅샷
                    </span>
                    {selectedHistoryVersion !== null && (
                      <span className="text-xs text-violet-500">돌아가기</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 truncate">
                    {currentPrompt?.slice(0, 50) || DEFAULT_PROMPT.slice(0, 50)}...
                  </p>
                </button>
              )}

              {/* History Versions */}
              {promptHistory.map((version, idx) => {
                // 현재 스냅샷 = 최신 히스토리일 때, 최신 항목에 "현재" 뱃지 표시
                const isCurrentSnapshot =
                  idx === 0 &&
                  currentPrompt?.trim() === version.prompt?.trim();
                const isSelected = selectedHistoryVersion === version.version;
                const isActive = isSelected || (isCurrentSnapshot && selectedHistoryVersion === null);

                return (
                  <button
                    key={version.version}
                    type="button"
                    onClick={() => {
                      if (isCurrentSnapshot) {
                        handleUseCurrentVersion();
                      } else {
                        handleSelectVersion(version);
                      }
                    }}
                    className={`w-full text-left px-4 py-3 border-b border-gray-100 transition-colors ${
                      isActive ? "bg-violet-50" : "hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-sm font-medium ${isActive ? "text-violet-700" : "text-gray-900"}`}>
                        {formatVersion(version.version)}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {isCurrentSnapshot && (
                          <span className="text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded">
                            현재
                          </span>
                        )}
                        {version.createdAt ? (
                          <span className="text-xs text-gray-400">
                            {new Date(version.createdAt).toLocaleDateString("ko-KR", {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                            기본
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 truncate">
                      {version.prompt.slice(0, 40)}...
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: Editor */}
          <div className="flex-1 flex flex-col p-6">
            {selectedHistoryVersion && (
              <div className="mb-3 flex items-center gap-2 text-sm text-amber-700 bg-amber-50 px-3 py-2 rounded-lg">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>이전 버전 {formatVersion(selectedHistoryVersion)}을 보고 있습니다.</span>
              </div>
            )}
            <textarea
              className="flex-1 w-full border border-gray-300 rounded-lg px-4 py-3 text-sm text-gray-900 font-mono resize-none focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-500"
              value={editedPrompt}
              onChange={(e) => setEditedPrompt(e.target.value)}
              placeholder="프롬프트를 입력하세요..."
            />
            {currentVersion !== "snapshot" && (
              <p className="mt-2 text-xs text-gray-500">
                저장 시 새 버전 <strong>{formatVersion(incrementVersion(currentVersion))}</strong>으로 확정됩니다.
              </p>
            )}
            {currentVersion === "snapshot" && (
              <p className="mt-2 text-xs text-gray-500">
                이 시나리오에만 적용되는 스냅샷으로 저장됩니다.
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
          {!hideResetButton && (
            <button
              type="button"
              onClick={handleResetToDefault}
              className="text-sm text-gray-600 hover:text-gray-800 underline"
            >
              {onReloadDefault ? "기본값 불러오기" : "기본값 복원"}
            </button>
          )}
          {hideResetButton && <div />}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              취소
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 text-sm font-medium text-white bg-violet-600 rounded-lg hover:bg-violet-700 transition-colors"
            >
              {currentVersion === "snapshot"
                ? "적용"
                : `${formatVersion(incrementVersion(currentVersion))}로 확정`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export { DEFAULT_PROMPT };
