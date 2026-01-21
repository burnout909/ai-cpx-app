"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ChecklistJson, DiffItem, EvidenceChecklistItem } from "@/utils/checklistCsvParser";

interface CaseData {
  id: string;
  name: string;
  diagnosis: string | null;
  description: string | null;
  checklistJson: ChecklistJson | null;
  createdAt: string;
  updatedAt: string;
}

const PRIMARY = "#7553FC";

export default function ChecklistManagementPage() {
  // 상태
  const [cases, setCases] = useState<CaseData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // CSV 업로드 상태
  const [csvText, setCsvText] = useState("");
  const [caseName, setCaseName] = useState("");
  const [targetCaseId, setTargetCaseId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // 미리보기 상태
  const [previewData, setPreviewData] = useState<{
    parsed: ChecklistJson;
    diff: DiffItem[];
    warnings: string[];
    existingCase: { id: string; name: string } | null;
  } | null>(null);
  const [parseErrors, setParseErrors] = useState<string[]>([]);

  // 상세보기/수정 상태
  const [selectedCase, setSelectedCase] = useState<CaseData | null>(null);
  const [editMode, setEditMode] = useState(false);

  // 케이스 목록 조회
  const fetchCases = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/checklist");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setCases(data.cases || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "조회 실패");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCases();
  }, [fetchCases]);

  // CSV 파일 업로드 핸들러
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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
      setParseErrors(["CSV 내용을 입력하거나 파일을 업로드해주세요."]);
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
          caseId: targetCaseId,
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
          existingCase: data.existingCase,
        });
      }
    } catch (err) {
      setParseErrors([err instanceof Error ? err.message : "미리보기 실패"]);
    } finally {
      setUploading(false);
    }
  };

  // 저장 요청
  const handleSave = async () => {
    if (!previewData) return;

    if (!targetCaseId && !caseName.trim()) {
      setParseErrors(["새 케이스를 생성하려면 케이스 이름을 입력해주세요."]);
      return;
    }

    setUploading(true);

    try {
      const res = await fetch("/api/admin/checklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          csvText,
          caseName: caseName.trim(),
          caseId: targetCaseId,
          action: "save",
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setParseErrors([data.error || "저장 실패"]);
      } else {
        // 초기화 및 새로고침
        setCsvText("");
        setCaseName("");
        setTargetCaseId(null);
        setPreviewData(null);
        setParseErrors([]);
        fetchCases();
        alert("저장되었습니다!");
      }
    } catch (err) {
      setParseErrors([err instanceof Error ? err.message : "저장 실패"]);
    } finally {
      setUploading(false);
    }
  };

  // 삭제 요청
  const handleDelete = async (caseId: string, name: string) => {
    if (!confirm(`"${name}" 케이스를 삭제하시겠습니까?`)) return;

    try {
      const res = await fetch(`/api/admin/checklist?caseId=${caseId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      fetchCases();
      if (selectedCase?.id === caseId) setSelectedCase(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "삭제 실패");
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full flex-col gap-8 px-8 py-8">
      {/* 헤더 */}
      <header className="flex items-center justify-between">
        <div>
          <Link href="/admin/dashboard" className="text-sm text-gray-500 hover:text-gray-700">
            ← Admin Dashboard
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">체크리스트 관리</h1>
          <p className="text-sm text-gray-500">
            CSV 업로드로 케이스별 체크리스트를 등록/수정합니다.
          </p>
        </div>
      </header>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* 왼쪽: CSV 업로드 */}
        <section className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold">CSV 업로드</h2>

            {/* 파일 업로드 */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                CSV 파일 선택
              </label>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100"
              />
            </div>

            {/* 대상 케이스 선택 */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                대상 케이스
              </label>
              <select
                value={targetCaseId || ""}
                onChange={(e) => {
                  setTargetCaseId(e.target.value || null);
                  setPreviewData(null);
                }}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                <option value="">새 케이스 생성</option>
                {cases.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 새 케이스 이름 */}
            {!targetCaseId && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  새 케이스 이름
                </label>
                <input
                  type="text"
                  value={caseName}
                  onChange={(e) => setCaseName(e.target.value)}
                  placeholder="예: 두통"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
            )}

            {/* CSV 텍스트 영역 */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                CSV 내용 (직접 붙여넣기 가능)
              </label>
              <textarea
                value={csvText}
                onChange={(e) => {
                  setCsvText(e.target.value);
                  setPreviewData(null);
                }}
                rows={8}
                placeholder="section,title,criteria,example,DDx&#10;history,통증 위치,통증 위치를 물어보았는가?,어디가 아프세요?,&#10;..."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
            </div>

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

            {/* 버튼 */}
            <div className="flex gap-2">
              <button
                onClick={handlePreview}
                disabled={uploading || !csvText.trim()}
                className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50"
              >
                {uploading ? "분석 중..." : "미리보기"}
              </button>
              <button
                onClick={handleSave}
                disabled={uploading || !previewData}
                style={{ backgroundColor: PRIMARY }}
                className="rounded-lg px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {uploading ? "저장 중..." : "저장하기"}
              </button>
            </div>
          </div>

          {/* 미리보기 결과 */}
          {previewData && (
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h2 className="mb-4 text-lg font-semibold">미리보기</h2>

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
                <div className="rounded-lg bg-blue-50 p-3">
                  <div className="text-lg font-bold text-blue-700">
                    {previewData.parsed.HistoryEvidenceChecklist.length}
                  </div>
                  <div className="text-xs text-blue-600">History</div>
                </div>
                <div className="rounded-lg bg-green-50 p-3">
                  <div className="text-lg font-bold text-green-700">
                    {previewData.parsed.PhysicalexamEvidenceChecklist.length}
                  </div>
                  <div className="text-xs text-green-600">Physical</div>
                </div>
                <div className="rounded-lg bg-purple-50 p-3">
                  <div className="text-lg font-bold text-purple-700">
                    {previewData.parsed.EducationEvidenceChecklist.length}
                  </div>
                  <div className="text-xs text-purple-600">Education</div>
                </div>
                <div className="rounded-lg bg-orange-50 p-3">
                  <div className="text-lg font-bold text-orange-700">
                    {previewData.parsed.PpiEvidenceChecklist.length}
                  </div>
                  <div className="text-xs text-orange-600">PPI</div>
                </div>
              </div>

              {/* Diff 표시 */}
              {previewData.existingCase && previewData.diff.length > 0 && (
                <DiffViewer diff={previewData.diff} />
              )}

              {previewData.existingCase && previewData.diff.length === 0 && (
                <div className="rounded-lg bg-gray-50 p-4 text-center text-sm text-gray-600">
                  변경 사항이 없습니다.
                </div>
              )}

              {!previewData.existingCase && (
                <div className="rounded-lg bg-green-50 p-4 text-center text-sm text-green-700">
                  새 케이스로 생성됩니다.
                </div>
              )}
            </div>
          )}
        </section>

        {/* 오른쪽: 케이스 목록 */}
        <section className="space-y-4">
          <div className="rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="mb-4 text-lg font-semibold">등록된 케이스 목록</h2>

            {loading ? (
              <div className="py-8 text-center text-gray-500">불러오는 중...</div>
            ) : error ? (
              <div className="py-8 text-center text-red-500">{error}</div>
            ) : cases.length === 0 ? (
              <div className="py-8 text-center text-gray-500">등록된 케이스가 없습니다.</div>
            ) : (
              <div className="space-y-2">
                {cases.map((c) => (
                  <div
                    key={c.id}
                    className={`flex items-center justify-between rounded-lg border p-3 cursor-pointer transition ${
                      selectedCase?.id === c.id
                        ? "border-violet-500 bg-violet-50"
                        : "border-gray-200 hover:bg-gray-50"
                    }`}
                    onClick={() => setSelectedCase(c)}
                  >
                    <div>
                      <div className="font-medium text-gray-900">{c.name}</div>
                      <div className="text-xs text-gray-500">
                        {c.checklistJson ? "체크리스트 있음" : "체크리스트 없음"}
                        {" • "}
                        {new Date(c.updatedAt).toLocaleDateString("ko-KR")}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setTargetCaseId(c.id);
                          setPreviewData(null);
                        }}
                        className="rounded px-2 py-1 text-xs text-violet-600 hover:bg-violet-100"
                      >
                        업데이트
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(c.id, c.name);
                        }}
                        className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-100"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 선택된 케이스 상세 */}
          {selectedCase && (
            <CaseDetailPanel
              caseData={selectedCase}
              onClose={() => setSelectedCase(null)}
              onRefresh={fetchCases}
            />
          )}
        </section>
      </div>
    </main>
  );
}

// Diff 뷰어 컴포넌트
function DiffViewer({ diff }: { diff: DiffItem[] }) {
  if (diff.length === 0) return null;

  const added = diff.filter((d) => d.type === "added");
  const removed = diff.filter((d) => d.type === "removed");
  const modified = diff.filter((d) => d.type === "modified");

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-700">변경 사항</h3>

      {/* 요약 */}
      <div className="flex gap-4 text-sm">
        <span className="text-green-600">+{added.length} 추가</span>
        <span className="text-red-600">-{removed.length} 삭제</span>
        <span className="text-yellow-600">~{modified.length} 수정</span>
      </div>

      {/* 상세 */}
      <div className="max-h-64 overflow-y-auto space-y-2">
        {added.map((d) => (
          <div key={d.id} className="rounded bg-green-50 p-2 text-sm">
            <div className="font-medium text-green-800">
              + [{d.section}] {d.id}: {d.newValue?.title}
            </div>
            <div className="text-green-700 text-xs mt-1">{d.newValue?.criteria}</div>
          </div>
        ))}

        {removed.map((d) => (
          <div key={d.id} className="rounded bg-red-50 p-2 text-sm">
            <div className="font-medium text-red-800">
              - [{d.section}] {d.id}: {d.oldValue?.title}
            </div>
            <div className="text-red-700 text-xs mt-1">{d.oldValue?.criteria}</div>
          </div>
        ))}

        {modified.map((d) => (
          <div key={d.id} className="rounded bg-yellow-50 p-2 text-sm">
            <div className="font-medium text-yellow-800">
              ~ [{d.section}] {d.id}
            </div>
            <div className="mt-1 space-y-1">
              {d.oldValue?.title !== d.newValue?.title && (
                <div className="text-xs">
                  <span className="text-red-600 line-through">{d.oldValue?.title}</span>
                  {" → "}
                  <span className="text-green-600">{d.newValue?.title}</span>
                </div>
              )}
              {d.oldValue?.criteria !== d.newValue?.criteria && (
                <div className="text-xs text-gray-600">criteria 변경됨</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// 케이스 상세 패널
function CaseDetailPanel({
  caseData,
  onClose,
  onRefresh,
}: {
  caseData: CaseData;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const checklist = caseData.checklistJson;

  const sections = [
    { key: "HistoryEvidenceChecklist" as const, label: "병력청취", color: "blue" },
    { key: "PhysicalexamEvidenceChecklist" as const, label: "신체진찰", color: "green" },
    { key: "EducationEvidenceChecklist" as const, label: "환자교육", color: "purple" },
    { key: "PpiEvidenceChecklist" as const, label: "PPI", color: "orange" },
  ];

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">{caseData.name}</h2>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600"
        >
          ✕
        </button>
      </div>

      {!checklist ? (
        <div className="py-8 text-center text-gray-500">체크리스트가 없습니다.</div>
      ) : (
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {sections.map(({ key, label, color }) => {
            const items = checklist[key] || [];
            if (items.length === 0) return null;

            return (
              <div key={key}>
                <h3 className={`text-sm font-semibold text-${color}-700 mb-2`}>
                  {label} ({items.length})
                </h3>
                <div className="space-y-1">
                  {items.map((item: EvidenceChecklistItem) => (
                    <div
                      key={item.id}
                      className="rounded bg-gray-50 p-2 text-xs"
                    >
                      <div className="font-medium text-gray-800">
                        {item.id}: {item.title}
                      </div>
                      <div className="text-gray-600 mt-1 line-clamp-2">
                        {item.criteria}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
