"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import Image from "next/image";
import Spinner from "@/component/Spinner";

interface PatientImagePanelProps {
  scenarioId?: string;
  sex?: string;
  age?: number;
  chiefComplaint?: string;
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
  createdAt: string;
}

export default function PatientImagePanel({
  scenarioId,
  sex,
  age,
  chiefComplaint,
  onImageGenerated,
  disabled = false,
}: PatientImagePanelProps) {
  const [imageData, setImageData] = useState<PatientImageData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "이미지 생성에 실패했습니다.");
      }

      setImageData(data.patientImage);
      onImageGeneratedRef.current?.(data.patientImage.url, data.patientImage.id);
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

          {/* Action buttons */}
          <div className="flex justify-center gap-2">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={disabled || isGenerating || !canGenerate}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                disabled || isGenerating
                  ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                  : "bg-white text-violet-600 border-violet-300 hover:bg-violet-50"
              }`}
            >
              {isGenerating ? (
                <span className="flex items-center gap-1.5">
                  <Spinner size={12} borderClassName="border-violet-600" />
                  재생성 중...
                </span>
              ) : (
                "재생성"
              )}
            </button>
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
            <p className="text-xs text-gray-400">
              아직 이미지가 없습니다.
              <br />
              [AI 이미지 생성] 버튼을 눌러 생성하세요.
            </p>
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
