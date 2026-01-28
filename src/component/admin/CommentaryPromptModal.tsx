"use client";

import React, { useState, useEffect } from "react";

const DEFAULT_PROMPT = `[Instruction]
당신은 CPX-MATE의 *로딩 화면용 Clinical Reasoning Commentary 생성기*입니다.
학생의 '결과 분석' 페이지 로딩 시간 동안 약 30~60초 분량의 음성 해설을 생성해야 합니다.
입력되는 시나리오 JSON(meta, history, physical_exam 등)을 분석하여, 학생이 반드시 도출해야 할 핵심 Clinical Reasoning 과정을 글로 작성합니다.
형식은 HTML(strong 태그 포함)이며, <br />이나 <p> 태그로 문단을 구분할 수 있습니다.

[출력 구조]
1. 케이스 요약 (1~2문장): 환자 정보(나이, 성별, Chief Complaint) 요약
2. 핵심 감별진단 (2~3개): 해당 시나리오에서 꼭 고려해야 할 감별진단
3. Key Findings (3~5개): 병력/신체진찰 중 진단에 결정적인 핵심 소견
4. Clinical Reasoning Point: 왜 해당 진단이 가장 가능성 높은지 논리적 설명
5. 학습 포인트 (선택): 학생이 놓치기 쉬운 감별진단이나 추가 검사 Tip

[톤 & 스타일]
- 친근하고 교육적인 어조(~입니다, ~해야 합니다)
- 중요한 키워드는 <strong> 태그로 강조
- 불필요한 서론/결론 없이 바로 본론 진입
- 실제 의사/의대생이 쓰는 자연스러운 한국어 의학용어 사용

[제한]
- 환자 이름이나 MRN 등 개인정보는 직접 언급하지 않음
- 시나리오에 없는 검사결과나 추가 정보를 추측하지 않음
- 오직 HTML 텍스트만 반환 (JSON 아님)`;

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
              해설 생성 프롬프트 수정
            </h2>
            <span className="text-xs font-medium text-violet-600 bg-violet-50 px-2 py-0.5 rounded">
              현재 {formatVersion(currentVersion)}
            </span>
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
              <h3 className="text-sm font-medium text-gray-700">버전 히스토리</h3>
            </div>
            <div className="flex-1 overflow-y-auto">
              {/* Current Version */}
              <button
                type="button"
                onClick={handleUseCurrentVersion}
                className={`w-full text-left px-4 py-3 border-b border-gray-100 transition-colors ${selectedHistoryVersion === null
                    ? "bg-violet-50"
                    : "hover:bg-gray-50"
                  }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-sm font-medium ${selectedHistoryVersion === null ? "text-violet-700" : "text-gray-900"}`}>
                    {formatVersion(currentVersion)}
                  </span>
                  <span className="text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded">
                    현재
                  </span>
                </div>
                <p className="text-xs text-gray-500 truncate">
                  {currentPrompt?.slice(0, 40) || DEFAULT_PROMPT.slice(0, 40)}...
                </p>
              </button>

              {/* History Versions */}
              {promptHistory.map((version) => (
                <button
                  key={version.version}
                  type="button"
                  onClick={() => handleSelectVersion(version)}
                  className={`w-full text-left px-4 py-3 border-b border-gray-100 transition-colors ${selectedHistoryVersion === version.version
                      ? "bg-violet-50"
                      : "hover:bg-gray-50"
                    }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-sm font-medium ${selectedHistoryVersion === version.version ? "text-violet-700" : "text-gray-900"}`}>
                      {formatVersion(version.version)}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(version.createdAt).toLocaleDateString("ko-KR", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 truncate">
                    {version.prompt.slice(0, 40)}...
                  </p>
                </button>
              ))}
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
            <p className="mt-2 text-xs text-gray-500">
              저장 시 새 버전 <strong>{formatVersion(incrementVersion(currentVersion))}</strong>으로 확정됩니다.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
          <button
            type="button"
            onClick={handleResetToDefault}
            className="text-sm text-gray-600 hover:text-gray-800 underline"
          >
            기본값 복원
          </button>
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
              {formatVersion(incrementVersion(currentVersion))}로 확정
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export { DEFAULT_PROMPT };
