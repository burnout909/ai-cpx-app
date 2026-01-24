"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ChecklistJson, DiffItem } from "@/utils/checklistCsvParser";
import ChiefComplaintDropdown from "@/component/admin/ChiefComplaintDropdown";
import ChecklistDiffViewer from "@/component/admin/ChecklistDiffViewer";
import { ChiefComplaint } from "@/constants/chiefComplaints";

interface ChecklistData {
  chiefComplaint: string;
  latestVersion: string;
  totalVersions: number;
  checklistJson: ChecklistJson;
  createdAt: string;
  id: string;
}

interface VersionInfo {
  id: string;
  version: string;
  checklistJson: ChecklistJson;
  createdAt: string;
}

const PRIMARY = "#7553FC";

export default function ChecklistManagementPage() {
  // 전체 체크리스트 목록 (주호소별 최신 버전)
  const [allChecklists, setAllChecklists] = useState<ChecklistData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 주호소 선택
  const [selectedChiefComplaint, setSelectedChiefComplaint] = useState<ChiefComplaint | null>(null);

  // 선택된 주호소의 버전 정보
  const [versions, setVersions] = useState<VersionInfo[]>([]);
  const [latestVersion, setLatestVersion] = useState<VersionInfo | null>(null);
  const [loadingVersions, setLoadingVersions] = useState(false);

  // CSV 업로드 상태
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvText, setCsvText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [parseErrors, setParseErrors] = useState<string[]>([]);

  // 미리보기 상태
  const [previewData, setPreviewData] = useState<{
    parsed: ChecklistJson;
    diff: DiffItem[];
    warnings: string[];
    currentVersion: string | null;
    nextVersion: string;
    existingChecklist: ChecklistJson | null;
  } | null>(null);

  // 전체 목록 조회
  const fetchAllChecklists = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/checklist");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAllChecklists(data.checklists || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "조회 실패");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllChecklists();
  }, [fetchAllChecklists]);

  // 주호소 선택 시 해당 주호소의 버전 정보 조회
  useEffect(() => {
    if (!selectedChiefComplaint) {
      setVersions([]);
      setLatestVersion(null);
      return;
    }

    const fetchVersions = async () => {
      setLoadingVersions(true);
      setCsvFile(null);
      setCsvText("");
      setPreviewData(null);
      setParseErrors([]);

      try {
        const res = await fetch(
          `/api/admin/checklist?chiefComplaint=${encodeURIComponent(selectedChiefComplaint)}`
        );
        const data = await res.json();

        if (res.ok) {
          setVersions(data.versions || []);
          setLatestVersion(data.latestVersion || null);
        } else {
          setVersions([]);
          setLatestVersion(null);
        }
      } catch {
        setVersions([]);
        setLatestVersion(null);
      } finally {
        setLoadingVersions(false);
      }
    };

    fetchVersions();
  }, [selectedChiefComplaint]);

  // CSV 파일 업로드 핸들러
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvFile(file);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvText(text);
      setPreviewData(null);
      setParseErrors([]);
    };
    reader.readAsText(file);
  };

  // 미리보기 요청
  const handlePreview = async () => {
    if (!csvText.trim()) {
      setParseErrors(["CSV 파일을 업로드해주세요."]);
      return;
    }

    if (!selectedChiefComplaint) {
      setParseErrors(["주호소를 선택해주세요."]);
      return;
    }

    setUploading(true);
    setParseErrors([]);

    try {
      const res = await fetch("/api/admin/checklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          csvText,
          chiefComplaint: selectedChiefComplaint,
          action: "preview",
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setParseErrors(data.errors || [data.error || "파싱 실패"]);
        setPreviewData(null);
      } else {
        setPreviewData({
          parsed: data.parsed,
          diff: data.diff,
          warnings: data.warnings || [],
          currentVersion: data.currentVersion,
          nextVersion: data.nextVersion,
          existingChecklist: data.existingChecklist,
        });
      }
    } catch (err) {
      setParseErrors([err instanceof Error ? err.message : "미리보기 실패"]);
    } finally {
      setUploading(false);
    }
  };

  // 새 버전으로 저장
  const handleSave = async () => {
    if (!previewData || !selectedChiefComplaint) return;

    setUploading(true);

    try {
      const res = await fetch("/api/admin/checklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          csvText,
          chiefComplaint: selectedChiefComplaint,
          action: "save",
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setParseErrors([data.error || "저장 실패"]);
      } else {
        // 초기화 및 새로고침
        resetForm();
        fetchAllChecklists();
        alert(`v${data.checklist.version} 저장 완료!`);
      }
    } catch (err) {
      setParseErrors([err instanceof Error ? err.message : "저장 실패"]);
    } finally {
      setUploading(false);
    }
  };

  // Diff 선택 적용 후 저장 (머지된 결과를 직접 저장)
  const handleApplySelections = async (mergedResult: ChecklistJson) => {
    if (!selectedChiefComplaint) return;

    setUploading(true);

    try {
      const res = await fetch("/api/admin/checklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chiefComplaint: selectedChiefComplaint,
          checklistJson: mergedResult, // 사용자 선택이 반영된 머지 결과
          action: "save",
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setParseErrors([data.error || "저장 실패"]);
      } else {
        resetForm();
        fetchAllChecklists();
        alert(`v${data.checklist.version} 저장 완료!`);
      }
    } catch (err) {
      setParseErrors([err instanceof Error ? err.message : "저장 실패"]);
    } finally {
      setUploading(false);
    }
  };

  // 버전 삭제
  const handleDeleteVersion = async (id: string, version: string, cc: string) => {
    if (!confirm(`${cc} v${version}을 삭제하시겠습니까?`)) return;

    try {
      const res = await fetch(`/api/admin/checklist?id=${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      fetchAllChecklists();
      // 현재 선택된 주호소의 버전 목록 새로고침
      if (selectedChiefComplaint === cc) {
        setVersions((prev) => prev.filter((v) => v.id !== id));
        if (latestVersion?.id === id) {
          setLatestVersion(versions.find((v) => v.id !== id) || null);
        }
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "삭제 실패");
    }
  };

  // 폼 초기화
  const resetForm = () => {
    setSelectedChiefComplaint(null);
    setVersions([]);
    setLatestVersion(null);
    setCsvFile(null);
    setCsvText("");
    setPreviewData(null);
    setParseErrors([]);
  };

  return (
    <main className="mx-auto flex min-h-screen w-full flex-col gap-8 px-8 py-8">
      {/* 헤더 */}
      <header className="flex items-center justify-between">
        <div>
          <Link href="/admin/dashboard" className="text-base text-gray-500 hover:text-violet-600">
            ← Admin Dashboard
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">체크리스트 관리</h1>
          <p className="text-sm text-gray-500">
            주호소별 체크리스트를 등록하고 버전을 관리합니다.
          </p>
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* 왼쪽: 체크리스트 등록/업데이트 */}
        <section className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold">체크리스트 등록</h2>

            {/* 주호소 선택 */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                1. 주호소 선택
              </label>
              <ChiefComplaintDropdown
                value={selectedChiefComplaint}
                onChange={(value) => {
                  setSelectedChiefComplaint(value);
                  setPreviewData(null);
                  setParseErrors([]);
                }}
                placeholder="주호소 검색 또는 선택"
              />
            </div>

            {/* 주호소 선택 후: 현재 버전 정보 표시 */}
            {selectedChiefComplaint && (
              <div className="mb-4">
                {loadingVersions ? (
                  <div className="text-sm text-gray-500 py-2">불러오는 중...</div>
                ) : latestVersion ? (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">현재 버전</span>
                      <span className="text-sm font-bold text-gray-900">v{latestVersion.version}</span>
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(latestVersion.createdAt).toLocaleString("ko-KR")} 등록
                      {versions.length > 1 && ` • 총 ${versions.length}개 버전`}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center">
                    <div className="text-sm text-gray-600">
                      등록된 체크리스트가 없습니다.
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 파일 업로드 */}
            {selectedChiefComplaint && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  2. CSV 파일 선택
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    accept=".csv,.tsv,.txt"
                    onChange={handleFileUpload}
                    className="block flex-1 text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
                  />
                  {csvFile && (
                    <button
                      type="button"
                      onClick={() => {
                        setCsvFile(null);
                        setCsvText("");
                        setPreviewData(null);
                        setParseErrors([]);
                      }}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
                        <path
                          fillRule="evenodd"
                          d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* 에러 표시 */}
            {parseErrors.length > 0 && (
              <div className="mb-4 rounded-lg bg-red-50 p-4">
                <h3 className="text-sm font-semibold text-red-800 mb-2">오류</h3>
                <ul className="text-sm text-red-700 space-y-1">
                  {parseErrors.map((err, i) => (
                    <li key={i}>• {err}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* 미리보기 버튼 */}
            {selectedChiefComplaint && !previewData && (
              <button
                onClick={handlePreview}
                disabled={uploading || !csvText.trim()}
                className="w-full rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50"
              >
                {uploading ? "분석 중..." : "미리보기"}
              </button>
            )}
          </div>

          {/* 미리보기 결과 */}
          {previewData && (
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">미리보기</h2>
                <button
                  type="button"
                  onClick={() => setPreviewData(null)}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  닫기
                </button>
              </div>

              {/* 버전 정보 */}
              <div className="mb-4 rounded-lg bg-gray-100 p-4 text-center">
                <div className="text-sm text-gray-600">
                  {previewData.currentVersion ? (
                    <>
                      v{previewData.currentVersion} → <span className="font-bold">v{previewData.nextVersion}</span>
                    </>
                  ) : (
                    <>
                      새 체크리스트로 등록: <span className="font-bold">v{previewData.nextVersion}</span>
                    </>
                  )}
                </div>
              </div>

              {/* 경고 */}
              {previewData.warnings.length > 0 && (
                <div className="mb-4 rounded-lg bg-yellow-50 p-4">
                  <h3 className="text-sm font-semibold text-yellow-800 mb-2">경고</h3>
                  <ul className="text-sm text-yellow-700 space-y-1">
                    {previewData.warnings.map((w, i) => (
                      <li key={i}>• {w}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 파싱 결과 요약 */}
              <div className="mb-4 grid grid-cols-4 gap-2 text-center">
                <div className="rounded-lg bg-gray-100 p-3">
                  <div className="text-lg font-bold text-gray-800">
                    {previewData.parsed.HistoryEvidenceChecklist.length}
                  </div>
                  <div className="text-xs text-gray-600">History</div>
                </div>
                <div className="rounded-lg bg-gray-100 p-3">
                  <div className="text-lg font-bold text-gray-800">
                    {previewData.parsed.PhysicalexamEvidenceChecklist.length}
                  </div>
                  <div className="text-xs text-gray-600">Physical</div>
                </div>
                <div className="rounded-lg bg-gray-100 p-3">
                  <div className="text-lg font-bold text-gray-800">
                    {previewData.parsed.EducationEvidenceChecklist.length}
                  </div>
                  <div className="text-xs text-gray-600">Education</div>
                </div>
                <div className="rounded-lg bg-gray-100 p-3">
                  <div className="text-lg font-bold text-gray-800">
                    {previewData.parsed.PpiEvidenceChecklist.length}
                  </div>
                  <div className="text-xs text-gray-600">PPI</div>
                </div>
              </div>

              {/* 파싱된 항목 상세 보기 */}
              <PreviewItemsTable parsed={previewData.parsed} />

              {/* Diff가 있을 때 */}
              {previewData.diff.length > 0 && (
                <ChecklistDiffViewer
                  diff={previewData.diff}
                  existingChecklist={previewData.existingChecklist}
                  newChecklist={previewData.parsed}
                  onApplySelections={handleApplySelections}
                  nextVersion={previewData.nextVersion}
                  isLoading={uploading}
                />
              )}

              {/* Diff가 없을 때 (첫 등록이거나 변경 없음) */}
              {previewData.diff.length === 0 && (
                <>
                  {!previewData.currentVersion && (
                    <div className="rounded-lg bg-gray-50 p-4 text-center text-sm text-gray-600 mb-4">
                      첫 번째 버전으로 등록됩니다.
                    </div>
                  )}
                  {previewData.currentVersion && (
                    <div className="rounded-lg bg-gray-50 p-4 text-center text-sm text-gray-600 mb-4">
                      이전 버전과 동일합니다. 변경 사항이 없습니다.
                    </div>
                  )}
                  <button
                    onClick={handleSave}
                    disabled={uploading || (!!previewData.currentVersion && previewData.diff.length === 0)}
                    style={{ backgroundColor: PRIMARY }}
                    className="w-full rounded-lg px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                  >
                    {uploading ? "저장 중..." : `v${previewData.nextVersion}로 저장`}
                  </button>
                </>
              )}
            </div>
          )}
        </section>

        {/* 오른쪽: 전체 체크리스트 목록 */}
        <section className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold">
              등록된 체크리스트 {!loading && `(${allChecklists.length})`}
            </h2>

            {loading ? (
              <div className="py-8 text-center text-gray-500">불러오는 중...</div>
            ) : error ? (
              <div className="py-8 text-center text-red-500">{error}</div>
            ) : allChecklists.length === 0 ? (
              <div className="py-8 text-center text-gray-500">등록된 체크리스트가 없습니다.</div>
            ) : (
              <div className="space-y-2 max-h-[600px] overflow-y-auto">
                {allChecklists.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between rounded-lg border border-gray-200 p-3 hover:bg-gray-50 transition"
                  >
                    <div
                      className="flex-1 cursor-pointer"
                      onClick={() => setSelectedChiefComplaint(c.chiefComplaint as ChiefComplaint)}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900">{c.chiefComplaint}</span>
                        <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                          v{c.latestVersion}
                        </span>
                        {c.totalVersions > 1 && (
                          <span className="text-xs text-gray-400">
                            ({c.totalVersions}개 버전)
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {new Date(c.createdAt).toLocaleDateString("ko-KR")}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteVersion(c.id, c.latestVersion, c.chiefComplaint);
                      }}
                      className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-100"
                    >
                      삭제
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 선택된 주호소의 버전 히스토리 */}
          {selectedChiefComplaint && versions.length > 1 && (
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h2 className="mb-4 text-lg font-semibold">
                버전 히스토리: {selectedChiefComplaint}
              </h2>
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {versions.map((v) => (
                  <div
                    key={v.id}
                    className="flex items-center justify-between rounded-lg border border-gray-200 p-3"
                  >
                    <div>
                      <span className="font-medium text-gray-900">v{v.version}</span>
                      <span className="text-xs text-gray-500 ml-2">
                        {new Date(v.createdAt).toLocaleString("ko-KR")}
                      </span>
                    </div>
                    <button
                      onClick={() => handleDeleteVersion(v.id, v.version, selectedChiefComplaint)}
                      className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-100"
                    >
                      삭제
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

// 미리보기 항목 테이블 컴포넌트
function PreviewItemsTable({ parsed }: { parsed: ChecklistJson }) {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const sections = [
    {
      key: "HistoryEvidenceChecklist" as const,
      label: "병력청취 (History)",
    },
    {
      key: "PhysicalexamEvidenceChecklist" as const,
      label: "신체진찰 (Physical)",
    },
    {
      key: "EducationEvidenceChecklist" as const,
      label: "환자교육 (Education)",
    },
    {
      key: "PpiEvidenceChecklist" as const,
      label: "PPI",
    },
  ];

  return (
    <div className="mb-4 space-y-2">
      <h3 className="text-sm font-semibold text-gray-700">파싱된 항목 상세</h3>
      {sections.map(({ key, label }) => {
        const items = parsed[key];
        if (items.length === 0) return null;

        const isExpanded = expandedSection === key;

        return (
          <div key={key} className="rounded-lg border border-gray-200 overflow-hidden">
            {/* 섹션 헤더 (클릭으로 펼치기/접기) */}
            <button
              type="button"
              onClick={() => setExpandedSection(isExpanded ? null : key)}
              className="w-full flex items-center justify-between px-3 py-2 bg-gray-100 text-gray-700 text-sm font-medium"
            >
              <span>
                {label} ({items.length}개)
              </span>
              <svg
                className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>

            {/* 항목 테이블 */}
            {isExpanded && (
              <div className="max-h-80 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-2 py-1.5 text-left font-medium text-gray-600 w-1/5">Title</th>
                      <th className="px-2 py-1.5 text-left font-medium text-gray-600 w-2/5">Criteria</th>
                      <th className="px-2 py-1.5 text-left font-medium text-gray-600 w-1/4">Example</th>
                      <th className="px-2 py-1.5 text-left font-medium text-gray-600 w-1/6">DDx</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {items.map((item, idx) => (
                      <tr key={item.id} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"}>
                        <td className="px-2 py-1.5 text-gray-800 font-medium">{item.title}</td>
                        <td className="px-2 py-1.5 text-gray-600 whitespace-pre-wrap">{item.criteria}</td>
                        <td className="px-2 py-1.5 text-gray-500 whitespace-pre-wrap">{item.example || "-"}</td>
                        <td className="px-2 py-1.5 text-gray-500">{item.DDx || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
