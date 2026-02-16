"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import ChiefComplaintDropdown from "@/component/admin/ChiefComplaintDropdown";
import { ChiefComplaint } from "@/constants/chiefComplaints";

interface PromptRecord {
  id: string;
  chiefComplaint: string;
  type: "ROLE" | "COMMENTARY";
  version: string;
  content: string;
  createdAt: string;
}

const PRIMARY = "#7553FC";

export default function PromptManagementPage() {
  const [selectedCC, setSelectedCC] = useState<ChiefComplaint | null>(null);

  // Role/Commentary 각각의 버전 히스토리
  const [roleVersions, setRoleVersions] = useState<PromptRecord[]>([]);
  const [commentaryVersions, setCommentaryVersions] = useState<PromptRecord[]>([]);

  // 편집 상태
  const [rolePrompt, setRolePrompt] = useState("");
  const [commentaryPrompt, setCommentaryPrompt] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // 버전 히스토리 사이드바
  const [selectedRoleVersion, setSelectedRoleVersion] = useState<string | null>(null);
  const [selectedCommentaryVersion, setSelectedCommentaryVersion] = useState<string | null>(null);

  // 사이드바 표시할 타입
  const [activeEditor, setActiveEditor] = useState<"role" | "commentary">("role");

  // 개요용
  const [allPrompts, setAllPrompts] = useState<{ chiefComplaint: string; roleVersion: string | null; commentaryVersion: string | null }[]>([]);

  // 최초 로드
  useEffect(() => {
    async function loadAll() {
      try {
        const res = await fetch("/api/admin/chief-complaint-prompt");
        if (res.ok) {
          const data = await res.json();
          setAllPrompts(data.prompts || []);
        }
      } catch (err) {
        console.error("프롬프트 목록 로드 실패:", err);
      }
    }
    loadAll();
  }, []);

  // 주호소 선택 시 프롬프트 로드
  const loadPrompts = useCallback(async (cc: string) => {
    try {
      const res = await fetch(`/api/admin/chief-complaint-prompt?chiefComplaint=${encodeURIComponent(cc)}`);
      if (!res.ok) return;

      const data = await res.json();

      const roleData = data.role || {};
      const commentaryData = data.commentary || {};

      setRoleVersions(roleData.versions || []);
      setCommentaryVersions(commentaryData.versions || []);

      if (roleData.latestVersion) {
        setRolePrompt(roleData.latestVersion.content);
      }
      if (commentaryData.latestVersion) {
        setCommentaryPrompt(commentaryData.latestVersion.content);
      }

      setSelectedRoleVersion(null);
      setSelectedCommentaryVersion(null);
    } catch (err) {
      console.error("프롬프트 로드 실패:", err);
    }
  }, []);

  useEffect(() => {
    if (selectedCC) {
      loadPrompts(selectedCC);
    }
  }, [selectedCC, loadPrompts]);

  // 저장 (타입별)
  const handleSave = async (type: "ROLE" | "COMMENTARY") => {
    if (!selectedCC) return;
    setSaving(true);
    setSaveMessage(null);

    const content = type === "ROLE" ? rolePrompt : commentaryPrompt;

    try {
      const res = await fetch("/api/admin/chief-complaint-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chiefComplaint: selectedCC, type, content }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "저장 실패");
      }

      const label = type === "ROLE" ? "Role Prompt" : "해설 프롬프트";
      setSaveMessage({ type: "success", text: `${label} v${data.prompt.version}으로 저장되었습니다.` });
      loadPrompts(selectedCC);
    } catch (err) {
      setSaveMessage({
        type: "error",
        text: err instanceof Error ? err.message : "저장 중 오류 발생",
      });
    } finally {
      setSaving(false);
    }
  };

  // 버전 선택
  const handleSelectRoleVersion = (v: PromptRecord) => {
    setSelectedRoleVersion(v.version);
    setRolePrompt(v.content);
  };

  const handleSelectCommentaryVersion = (v: PromptRecord) => {
    setSelectedCommentaryVersion(v.version);
    setCommentaryPrompt(v.content);
  };

  // 최신 버전으로 돌아가기
  const handleBackToLatestRole = () => {
    setSelectedRoleVersion(null);
    if (roleVersions.length > 0) {
      setRolePrompt(roleVersions[0].content);
    }
  };

  const handleBackToLatestCommentary = () => {
    setSelectedCommentaryVersion(null);
    if (commentaryVersions.length > 0) {
      setCommentaryPrompt(commentaryVersions[0].content);
    }
  };

  const activeVersions = activeEditor === "role" ? roleVersions : commentaryVersions;
  const selectedVersion = activeEditor === "role" ? selectedRoleVersion : selectedCommentaryVersion;

  return (
    <div className="mx-auto min-h-screen w-full px-8 py-8 space-y-6">
      {/* 헤더 */}
      <header>
        <Link href="/admin/dashboard" className="text-base text-gray-500 hover:text-violet-600">
          &larr; Admin Dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">프롬프트 관리</h1>
        <p className="text-sm text-gray-500 mt-1">
          주호소별 Role Prompt(가상환자 지시문)와 해설 프롬프트를 관리합니다. 각각 독립적으로 버전 관리됩니다.
        </p>
      </header>

      {/* 주호소 선택 */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          주호소 선택
        </label>
        <div className="w-64">
          <ChiefComplaintDropdown
            value={selectedCC}
            onChange={setSelectedCC}
            placeholder="주호소를 선택하세요"
          />
        </div>
      </div>

      {/* 커스터마이징된 주호소 요약 */}
      {!selectedCC && allPrompts.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">주호소별 프롬프트 현황</h3>
          <div className="space-y-2">
            {allPrompts.map((p) => (
              <button
                key={p.chiefComplaint}
                onClick={() => setSelectedCC(p.chiefComplaint as ChiefComplaint)}
                className="w-full text-left px-3 py-2 rounded-lg border border-gray-100 hover:bg-violet-50 transition-colors flex items-center justify-between"
              >
                <span className="text-sm font-medium text-gray-800">{p.chiefComplaint}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Role v{p.roleVersion}</span>
                  <span className="text-xs text-gray-300">|</span>
                  <span className="text-xs text-gray-500">해설 v{p.commentaryVersion}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 편집 영역 */}
      {selectedCC && (
        <div className="flex gap-4 h-[calc(100vh-320px)]">
          {/* 버전 히스토리 사이드바 */}
          <div className="w-56 bg-white rounded-lg border border-gray-200 flex flex-col shrink-0">
            <div className="px-4 py-3 border-b border-gray-100">
              <div className="flex items-center gap-1 mb-2">
                <button
                  onClick={() => setActiveEditor("role")}
                  className={`text-xs font-medium px-2 py-1 rounded ${
                    activeEditor === "role" ? "bg-violet-100 text-violet-700" : "text-gray-500 hover:bg-gray-100"
                  }`}
                >
                  Role
                </button>
                <button
                  onClick={() => setActiveEditor("commentary")}
                  className={`text-xs font-medium px-2 py-1 rounded ${
                    activeEditor === "commentary" ? "bg-violet-100 text-violet-700" : "text-gray-500 hover:bg-gray-100"
                  }`}
                >
                  해설
                </button>
              </div>
              <h3 className="text-sm font-medium text-gray-700">버전 히스토리</h3>
            </div>
            <div className="flex-1 overflow-y-auto">
              {activeVersions.length === 0 ? (
                <div className="px-4 py-3 text-xs text-gray-500">
                  버전 기록이 없습니다.
                </div>
              ) : (
                activeVersions.map((v, i) => (
                  <button
                    key={v.id}
                    onClick={() => {
                      if (i === 0) {
                        activeEditor === "role" ? handleBackToLatestRole() : handleBackToLatestCommentary();
                      } else {
                        activeEditor === "role" ? handleSelectRoleVersion(v) : handleSelectCommentaryVersion(v);
                      }
                    }}
                    className={`w-full text-left px-4 py-3 border-b border-gray-100 transition-colors ${
                      (i === 0 && !selectedVersion) || selectedVersion === v.version
                        ? "bg-violet-50"
                        : "hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-900">v{v.version}</span>
                      {i === 0 && (
                        <span className="text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded">
                          최신
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-400">
                      {new Date(v.createdAt).toLocaleDateString("ko-KR", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* 프롬프트 에디터 */}
          <div className="flex-1 flex flex-col gap-4 min-w-0">
            {/* 상단 액션 바 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-gray-800">{selectedCC}</h2>
                {selectedRoleVersion && activeEditor === "role" && (
                  <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                    이전 버전 v{selectedRoleVersion} 보는 중
                  </span>
                )}
                {selectedCommentaryVersion && activeEditor === "commentary" && (
                  <span className="text-xs font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                    이전 버전 v{selectedCommentaryVersion} 보는 중
                  </span>
                )}
              </div>
            </div>

            {saveMessage && (
              <div
                className={`p-2 rounded-lg text-xs ${
                  saveMessage.type === "success"
                    ? "bg-green-50 text-green-700 border border-green-200"
                    : "bg-red-50 text-red-700 border border-red-200"
                }`}
              >
                {saveMessage.text}
              </div>
            )}

            {/* Role Prompt 카드 */}
            <div className="flex-1 flex flex-col bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-gray-700">Role Prompt (가상환자 지시문)</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {"{{age}}, {{sex}}, {{name}}, {{mrn}}, {{chief_complaint}}, {{vitalsStr}}, {{factsJson}} 플레이스홀더를 사용할 수 있습니다."}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {roleVersions.length > 0 && (
                    <span className="text-xs text-gray-400">v{roleVersions[0].version}</span>
                  )}
                  <button
                    onClick={() => handleSave("ROLE")}
                    disabled={saving}
                    className="px-3 py-1.5 text-xs font-medium text-white rounded-lg transition-colors disabled:opacity-50"
                    style={{ backgroundColor: PRIMARY }}
                  >
                    {saving ? "저장 중..." : "저장"}
                  </button>
                </div>
              </div>
              <textarea
                className="flex-1 w-full px-4 py-3 text-sm text-gray-900 font-mono resize-none focus:outline-none"
                value={rolePrompt}
                onChange={(e) => setRolePrompt(e.target.value)}
                placeholder="Role Prompt를 입력하세요..."
                onClick={() => setActiveEditor("role")}
              />
            </div>

            {/* 해설 프롬프트 카드 */}
            <div className="flex-1 flex flex-col bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-gray-700">해설 프롬프트</h3>
                  <p className="text-xs text-gray-500 mt-0.5">
                    시나리오 기반 Clinical Reasoning Commentary 생성에 사용됩니다.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {commentaryVersions.length > 0 && (
                    <span className="text-xs text-gray-400">v{commentaryVersions[0].version}</span>
                  )}
                  <button
                    onClick={() => handleSave("COMMENTARY")}
                    disabled={saving}
                    className="px-3 py-1.5 text-xs font-medium text-white rounded-lg transition-colors disabled:opacity-50"
                    style={{ backgroundColor: PRIMARY }}
                  >
                    {saving ? "저장 중..." : "저장"}
                  </button>
                </div>
              </div>
              <textarea
                className="flex-1 w-full px-4 py-3 text-sm text-gray-900 font-mono resize-none focus:outline-none"
                value={commentaryPrompt}
                onChange={(e) => setCommentaryPrompt(e.target.value)}
                placeholder="해설 프롬프트를 입력하세요..."
                onClick={() => setActiveEditor("commentary")}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
