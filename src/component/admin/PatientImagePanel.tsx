"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import Image from "next/image";
import Spinner from "@/component/Spinner";

interface ScenarioContext {
  description?: string;
  diagnosis?: string;
  attitude?: string;
  history?: Record<string, unknown>;
  meta?: {
    chief_complaint?: string;
    vitals?: { bp?: string; hr?: number; rr?: number; bt?: number };
    [key: string]: unknown;
  };
}

interface PatientImagePanelProps {
  scenarioId?: string;
  sex?: string;
  age?: number;
  chiefComplaint?: string;
  scenarioContext?: ScenarioContext;
  onImageGenerated?: (imageUrl: string, imageId: string) => void;
  disabled?: boolean;
}

interface PatientImageData {
  id: string;
  s3Key: string;
  url: string;
  sex: string;
  age: number;
  chiefComplaint: string;
  prompt?: string;
  createdAt: string;
}

export default function PatientImagePanel({
  scenarioId,
  sex,
  age,
  chiefComplaint,
  scenarioContext,
  onImageGenerated,
  disabled = false,
}: PatientImagePanelProps) {
  const [imageData, setImageData] = useState<PatientImageData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Prompt customization state
  const [customPrompt, setCustomPrompt] = useState("");
  const [isLoadingPrompt, setIsLoadingPrompt] = useState(false);
  const [showPromptEditor, setShowPromptEditor] = useState(false);
  const [showUsedPrompt, setShowUsedPrompt] = useState(false);

  // Use ref to avoid infinite loop from callback in dependencies
  const onImageGeneratedRef = useRef(onImageGenerated);
  onImageGeneratedRef.current = onImageGenerated;

  // Check if we have required data for generation
  const canGenerate = Boolean(sex && age && chiefComplaint);

  // Fetch existing image for scenario
  const fetchImage = useCallback(async () => {
    if (!scenarioId) return;

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/patient-image?scenarioId=${scenarioId}`);
      const data = await res.json();

      if (res.ok && data.patientImage) {
        setImageData(data.patientImage);
        onImageGeneratedRef.current?.(data.patientImage.url, data.patientImage.id);
      } else {
        setImageData(null);
        onImageGeneratedRef.current?.("", "");
      }
    } catch (err) {
      console.error("Image fetch error:", err);
      setImageData(null);
    } finally {
      setIsLoading(false);
    }
  }, [scenarioId]);

  useEffect(() => {
    fetchImage();
  }, [fetchImage]);

  // Load default prompt from server
  const handleLoadDefaultPrompt = async () => {
    if (!canGenerate || isLoadingPrompt) return;

    setIsLoadingPrompt(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/patient-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "preview-prompt",
          sex,
          age,
          chiefComplaint,
          scenarioContext,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "프롬프트 불러오기 실패");
      }

      setCustomPrompt(data.prompt);
      setShowPromptEditor(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "프롬프트 불러오기 중 오류 발생";
      setError(msg);
    } finally {
      setIsLoadingPrompt(false);
    }
  };

  // Generate new image
  const handleGenerate = async () => {
    if (!canGenerate || disabled || isGenerating) return;

    setIsGenerating(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/patient-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenarioId,
          sex,
          age,
          chiefComplaint,
          scenarioContext,
          ...(customPrompt.trim() && { customPrompt: customPrompt.trim() }),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "이미지 생성에 실패했습니다.");
      }

      setImageData(data.patientImage);
      onImageGeneratedRef.current?.(data.patientImage.url, data.patientImage.id);
      setShowPromptEditor(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "이미지 생성 중 오류 발생";
      setError(msg);
    } finally {
      setIsGenerating(false);
    }
  };

  // Delete image
  const handleDelete = async () => {
    if (!imageData || disabled) return;

    if (!confirm("이미지를 삭제하시겠습니까?")) return;

    try {
      const res = await fetch(`/api/admin/patient-image?id=${imageData.id}`, {
        method: "DELETE",
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "삭제에 실패했습니다.");
      }

      setImageData(null);
      onImageGeneratedRef.current?.("", "");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "삭제 중 오류 발생";
      setError(msg);
    }
  };

  // Prompt editor section (shared between no-image and regenerate states)
  const renderPromptEditor = () => (
    <div className="mt-3 space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-gray-600">
          이미지 생성 프롬프트
        </label>
        <button
          type="button"
          onClick={handleLoadDefaultPrompt}
          disabled={!canGenerate || isLoadingPrompt}
          className={`px-2 py-1 text-[11px] font-medium rounded transition-colors ${
            !canGenerate || isLoadingPrompt
              ? "text-gray-400 cursor-not-allowed"
              : "text-violet-600 hover:bg-violet-50"
          }`}
        >
          {isLoadingPrompt ? (
            <span className="flex items-center gap-1">
              <Spinner size={10} borderClassName="border-violet-600" />
              불러오는 중...
            </span>
          ) : (
            "기본 프롬프트 불러오기"
          )}
        </button>
      </div>
      <textarea
        value={customPrompt}
        onChange={(e) => setCustomPrompt(e.target.value)}
        placeholder="프롬프트를 직접 입력하거나, '기본 프롬프트 불러오기'를 눌러 자동 생성된 프롬프트를 수정하세요."
        className="w-full h-32 px-3 py-2 text-xs text-gray-700 bg-white border border-gray-300 rounded-lg resize-y focus:outline-none focus:ring-1 focus:ring-violet-400 focus:border-violet-400"
      />
      {customPrompt.trim() && (
        <p className="text-[11px] text-gray-400">
          커스텀 프롬프트가 적용됩니다. 비우면 자동 생성 프롬프트가 사용됩니다.
        </p>
      )}
    </div>
  );

  // Used prompt display (collapsible, for existing images)
  const renderUsedPrompt = () => {
    if (!imageData?.prompt) return null;

    return (
      <div className="mt-2">
        <button
          type="button"
          onClick={() => setShowUsedPrompt(!showUsedPrompt)}
          className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-700 transition-colors"
        >
          <span className={`transition-transform ${showUsedPrompt ? "rotate-90" : ""}`}>
            ▶
          </span>
          사용된 프롬프트 {showUsedPrompt ? "접기" : "보기"}
        </button>
        {showUsedPrompt && (
          <div className="mt-1.5 p-2 bg-gray-100 rounded text-[11px] text-gray-600 leading-relaxed whitespace-pre-wrap break-words">
            {imageData.prompt}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">환자 이미지</h3>
        {!imageData && canGenerate && (
          <button
            type="button"
            onClick={handleGenerate}
            disabled={disabled || isGenerating}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              disabled || isGenerating
                ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                : "bg-violet-600 text-white hover:bg-violet-700"
            }`}
          >
            {isGenerating ? (
              <span className="flex items-center gap-1.5">
                <Spinner size={12} borderClassName="border-white" />
                생성 중...
              </span>
            ) : (
              "AI 이미지 생성"
            )}
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <Spinner size={24} />
        </div>
      ) : imageData ? (
        <div className="space-y-3">
          {/* Image preview */}
          <div className="relative w-full aspect-square max-w-[200px] mx-auto rounded-lg overflow-hidden border border-gray-200">
            <Image
              src={imageData.url}
              alt="환자 이미지"
              fill
              className="object-cover"
              unoptimized
            />
          </div>

          {/* Image info */}
          <div className="text-xs text-gray-500 text-center space-y-0.5">
            <p>
              {imageData.sex} | {imageData.age}세
            </p>
            <p>{imageData.chiefComplaint}</p>
          </div>

          {/* Used prompt (collapsible) */}
          {renderUsedPrompt()}

          {/* Prompt editor for regeneration */}
          {showPromptEditor && renderPromptEditor()}

          {/* Action buttons */}
          <div className="flex justify-center gap-2">
            {!showPromptEditor ? (
              <button
                type="button"
                onClick={() => {
                  setShowPromptEditor(true);
                  // Pre-fill with previously used prompt if available
                  if (imageData.prompt && !customPrompt.trim()) {
                    setCustomPrompt(imageData.prompt);
                  }
                }}
                disabled={disabled || isGenerating || !canGenerate}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                  disabled || isGenerating
                    ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                    : "bg-white text-violet-600 border-violet-300 hover:bg-violet-50"
                }`}
              >
                재생성
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={disabled || isGenerating || !canGenerate}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    disabled || isGenerating
                      ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                      : "bg-violet-600 text-white hover:bg-violet-700"
                  }`}
                >
                  {isGenerating ? (
                    <span className="flex items-center gap-1.5">
                      <Spinner size={12} borderClassName="border-white" />
                      재생성 중...
                    </span>
                  ) : (
                    "재생성 실행"
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowPromptEditor(false)}
                  disabled={isGenerating}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border bg-white text-gray-600 border-gray-300 hover:bg-gray-50 transition-colors"
                >
                  취소
                </button>
              </>
            )}
            <button
              type="button"
              onClick={handleDelete}
              disabled={disabled}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                disabled
                  ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                  : "bg-white text-red-600 border-red-300 hover:bg-red-50"
              }`}
            >
              삭제
            </button>
          </div>
        </div>
      ) : (
        <div className="text-center py-6">
          {!canGenerate ? (
            <p className="text-xs text-gray-400">
              성별, 나이, 주호소를 입력하면
              <br />
              AI 환자 이미지를 생성할 수 있습니다.
            </p>
          ) : isGenerating ? (
            <div className="flex flex-col items-center gap-2">
              <Spinner size={32} />
              <p className="text-xs text-gray-500">
                AI가 환자 이미지를 생성하고 있습니다...
              </p>
            </div>
          ) : (
            <>
              <p className="text-xs text-gray-400">
                아직 이미지가 없습니다.
                <br />
                [AI 이미지 생성] 버튼을 눌러 생성하세요.
              </p>
              {/* Prompt editor for initial generation */}
              {renderPromptEditor()}
            </>
          )}
        </div>
      )}

      {/* Error message */}
      {error && (
        <p className="mt-2 text-xs text-red-600 text-center">{error}</p>
      )}
    </div>
  );
}
