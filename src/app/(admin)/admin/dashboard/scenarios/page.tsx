"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface CaseData {
  id: string;
  name: string;
  chiefComplaint: string | null;
  diagnosis: string | null;
  description: string | null;
  status: "DRAFT" | "PUBLISHED";
  scenarioJson: any | null;
  checklistJson: any | null;
  solutionText: string | null;
  createdAt: string;
  updatedAt: string;
}

interface GroupedData {
  grouped: Record<string, CaseData[]>;
  uncategorized: CaseData[];
  chiefComplaints: string[];
  total: number;
}

const PRIMARY = "#7553FC";

export default function ScenarioManagementPage() {
  const [data, setData] = useState<GroupedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 필터
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expandedCC, setExpandedCC] = useState<Set<string>>(new Set());

  // 선택된 케이스 (상세/수정용)
  const [selectedCase, setSelectedCase] = useState<CaseData | null>(null);
  const [editMode, setEditMode] = useState(false);

  // 데이터 로드
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let url = "/api/admin/scenarios?groupBy=chiefComplaint";
      if (statusFilter !== "all") {
        url += `&status=${statusFilter}`;
      }
      const res = await fetch(url);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setData(json);
      // 처음 로드시 모두 펼치기
      if (json.chiefComplaints) {
        setExpandedCC(new Set(json.chiefComplaints));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "조회 실패");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 상태 변경
  const handleStatusChange = async (caseId: string, newStatus: "DRAFT" | "PUBLISHED") => {
    try {
      const res = await fetch("/api/admin/scenarios", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId, status: newStatus }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      fetchData();
      if (selectedCase?.id === caseId) {
        setSelectedCase({ ...selectedCase, status: newStatus });
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "상태 변경 실패");
    }
  };

  // 삭제
  const handleDelete = async (caseId: string, name: string) => {
    if (!confirm(`"${name}" 케이스를 삭제하시겠습니까?\n\n⚠️ 이 작업은 되돌릴 수 없습니다.`)) return;

    try {
      const res = await fetch(`/api/admin/scenarios?caseId=${caseId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      fetchData();
      if (selectedCase?.id === caseId) setSelectedCase(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "삭제 실패");
    }
  };

  // 토글 확장
  const toggleExpand = (cc: string) => {
    setExpandedCC((prev) => {
      const next = new Set(prev);
      if (next.has(cc)) next.delete(cc);
      else next.add(cc);
      return next;
    });
  };

  // 통계 계산
  const stats = data
    ? {
        total: data.total,
        published: Object.values(data.grouped)
          .flat()
          .concat(data.uncategorized)
          .filter((c) => c.status === "PUBLISHED").length,
        draft: Object.values(data.grouped)
          .flat()
          .concat(data.uncategorized)
          .filter((c) => c.status === "DRAFT").length,
      }
    : null;

  return (
    <main className="mx-auto flex min-h-screen w-full flex-col gap-6 px-8 py-8">
      {/* 헤더 */}
      <header>
        <Link href="/admin/dashboard" className="text-sm text-gray-500 hover:text-gray-700">
          ← Admin Dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">시나리오 관리</h1>
        <p className="text-sm text-gray-500">
          주호소/케이스별 시나리오 현황을 확인하고 관리합니다.
        </p>
      </header>

      {/* 통계 카드 */}
      {stats && (
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4 text-center">
            <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
            <div className="text-sm text-gray-500">전체 케이스</div>
          </div>
          <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-center">
            <div className="text-2xl font-bold text-green-700">{stats.published}</div>
            <div className="text-sm text-green-600">배포됨</div>
          </div>
          <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4 text-center">
            <div className="text-2xl font-bold text-yellow-700">{stats.draft}</div>
            <div className="text-sm text-yellow-600">수정 중</div>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* 왼쪽: 케이스 목록 */}
        <section className="lg:col-span-2 space-y-4">
          {/* 필터 */}
          <div className="flex gap-2">
            <button
              onClick={() => setStatusFilter("all")}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                statusFilter === "all"
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              전체
            </button>
            <button
              onClick={() => setStatusFilter("PUBLISHED")}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                statusFilter === "PUBLISHED"
                  ? "bg-green-600 text-white"
                  : "bg-green-50 text-green-700 hover:bg-green-100"
              }`}
            >
              배포됨
            </button>
            <button
              onClick={() => setStatusFilter("DRAFT")}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                statusFilter === "DRAFT"
                  ? "bg-yellow-500 text-white"
                  : "bg-yellow-50 text-yellow-700 hover:bg-yellow-100"
              }`}
            >
              수정 중
            </button>
          </div>

          {/* 케이스 목록 */}
          <div className="rounded-xl border border-gray-200 bg-white">
            {loading ? (
              <div className="py-12 text-center text-gray-500">불러오는 중...</div>
            ) : error ? (
              <div className="py-12 text-center text-red-500">{error}</div>
            ) : !data || data.total === 0 ? (
              <div className="py-12 text-center text-gray-500">등록된 케이스가 없습니다.</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {/* 주호소별 그룹 */}
                {data.chiefComplaints.map((cc) => {
                  const cases = data.grouped[cc] || [];
                  const isExpanded = expandedCC.has(cc);
                  const publishedCount = cases.filter((c) => c.status === "PUBLISHED").length;

                  return (
                    <div key={cc}>
                      {/* 주호소 헤더 */}
                      <button
                        onClick={() => toggleExpand(cc)}
                        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-lg">{isExpanded ? "▼" : "▶"}</span>
                          <span className="font-semibold text-gray-900">{cc}</span>
                          <span className="text-sm text-gray-500">({cases.length}개 케이스)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">
                            {publishedCount} 배포
                          </span>
                          <span className="rounded bg-yellow-100 px-2 py-0.5 text-xs text-yellow-700">
                            {cases.length - publishedCount} 수정 중
                          </span>
                        </div>
                      </button>

                      {/* 케이스 목록 */}
                      {isExpanded && (
                        <div className="divide-y divide-gray-50">
                          {cases.map((c) => (
                            <CaseRow
                              key={c.id}
                              caseData={c}
                              isSelected={selectedCase?.id === c.id}
                              onSelect={() => setSelectedCase(c)}
                              onStatusChange={handleStatusChange}
                              onDelete={handleDelete}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* 미분류 */}
                {data.uncategorized.length > 0 && (
                  <div>
                    <button
                      onClick={() => toggleExpand("__uncategorized__")}
                      className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg">
                          {expandedCC.has("__uncategorized__") ? "▼" : "▶"}
                        </span>
                        <span className="font-semibold text-gray-500">미분류</span>
                        <span className="text-sm text-gray-400">
                          ({data.uncategorized.length}개 케이스)
                        </span>
                      </div>
                    </button>

                    {expandedCC.has("__uncategorized__") && (
                      <div className="divide-y divide-gray-50">
                        {data.uncategorized.map((c) => (
                          <CaseRow
                            key={c.id}
                            caseData={c}
                            isSelected={selectedCase?.id === c.id}
                            onSelect={() => setSelectedCase(c)}
                            onStatusChange={handleStatusChange}
                            onDelete={handleDelete}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        {/* 오른쪽: 상세 패널 */}
        <section className="lg:col-span-1">
          {selectedCase ? (
            <CaseDetailPanel
              caseData={selectedCase}
              onClose={() => {
                setSelectedCase(null);
                setEditMode(false);
              }}
              onRefresh={fetchData}
              editMode={editMode}
              setEditMode={setEditMode}
            />
          ) : (
            <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-gray-500">
              케이스를 선택하면 상세 정보가 표시됩니다.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

// 케이스 행 컴포넌트
function CaseRow({
  caseData,
  isSelected,
  onSelect,
  onStatusChange,
  onDelete,
}: {
  caseData: CaseData;
  isSelected: boolean;
  onSelect: () => void;
  onStatusChange: (id: string, status: "DRAFT" | "PUBLISHED") => void;
  onDelete: (id: string, name: string) => void;
}) {
  const hasScenario = !!caseData.scenarioJson;
  const hasChecklist = !!caseData.checklistJson;
  const hasSolution = !!caseData.solutionText;

  return (
    <div
      onClick={onSelect}
      className={`flex items-center justify-between px-4 py-3 cursor-pointer transition ${
        isSelected ? "bg-violet-50" : "hover:bg-gray-50"
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900 truncate">{caseData.name}</span>
          {caseData.status === "PUBLISHED" ? (
            <span className="shrink-0 rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-700">
              배포됨
            </span>
          ) : (
            <span className="shrink-0 rounded bg-yellow-100 px-1.5 py-0.5 text-xs text-yellow-700">
              수정 중
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
          <span className={hasScenario ? "text-green-600" : "text-gray-400"}>
            {hasScenario ? "✓ 시나리오" : "○ 시나리오"}
          </span>
          <span className={hasChecklist ? "text-green-600" : "text-gray-400"}>
            {hasChecklist ? "✓ 체크리스트" : "○ 체크리스트"}
          </span>
          <span className={hasSolution ? "text-green-600" : "text-gray-400"}>
            {hasSolution ? "✓ 해설" : "○ 해설"}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-1 ml-2" onClick={(e) => e.stopPropagation()}>
        {caseData.status === "DRAFT" ? (
          <button
            onClick={() => onStatusChange(caseData.id, "PUBLISHED")}
            className="rounded px-2 py-1 text-xs text-green-600 hover:bg-green-100"
            title="배포하기"
          >
            배포
          </button>
        ) : (
          <button
            onClick={() => onStatusChange(caseData.id, "DRAFT")}
            className="rounded px-2 py-1 text-xs text-yellow-600 hover:bg-yellow-100"
            title="수정 모드로 전환"
          >
            수정
          </button>
        )}
        <button
          onClick={() => onDelete(caseData.id, caseData.name)}
          className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-100"
        >
          삭제
        </button>
      </div>
    </div>
  );
}

// 상세 패널 컴포넌트
function CaseDetailPanel({
  caseData,
  onClose,
  onRefresh,
  editMode,
  setEditMode,
}: {
  caseData: CaseData;
  onClose: () => void;
  onRefresh: () => void;
  editMode: boolean;
  setEditMode: (v: boolean) => void;
}) {
  const [formData, setFormData] = useState({
    name: caseData.name,
    chiefComplaint: caseData.chiefComplaint || "",
    diagnosis: caseData.diagnosis || "",
    description: caseData.description || "",
    solutionText: caseData.solutionText || "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFormData({
      name: caseData.name,
      chiefComplaint: caseData.chiefComplaint || "",
      diagnosis: caseData.diagnosis || "",
      description: caseData.description || "",
      solutionText: caseData.solutionText || "",
    });
  }, [caseData]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/scenarios", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId: caseData.id,
          ...formData,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setEditMode(false);
      onRefresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "저장 실패");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{caseData.name}</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          ✕
        </button>
      </div>

      {editMode ? (
        // 수정 모드
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">케이스명</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">주호소</label>
            <input
              type="text"
              value={formData.chiefComplaint}
              onChange={(e) => setFormData({ ...formData, chiefComplaint: e.target.value })}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
              placeholder="예: 두통"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">진단명</label>
            <input
              type="text"
              value={formData.diagnosis}
              onChange={(e) => setFormData({ ...formData, diagnosis: e.target.value })}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">설명</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">해설</label>
            <textarea
              value={formData.solutionText}
              onChange={(e) => setFormData({ ...formData, solutionText: e.target.value })}
              rows={4}
              className="w-full rounded border border-gray-300 px-3 py-2 text-sm font-mono"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
            >
              {saving ? "저장 중..." : "저장"}
            </button>
            <button
              onClick={() => setEditMode(false)}
              className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
            >
              취소
            </button>
          </div>
        </div>
      ) : (
        // 보기 모드
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-gray-500">주호소:</span>{" "}
              <span className="font-medium">{caseData.chiefComplaint || "-"}</span>
            </div>
            <div>
              <span className="text-gray-500">진단:</span>{" "}
              <span className="font-medium">{caseData.diagnosis || "-"}</span>
            </div>
          </div>

          {caseData.description && (
            <div className="text-sm">
              <span className="text-gray-500">설명:</span>
              <p className="mt-1 text-gray-700">{caseData.description}</p>
            </div>
          )}

          {/* 시나리오 요약 */}
          {caseData.scenarioJson && (
            <div className="rounded bg-blue-50 p-3">
              <h3 className="text-xs font-semibold text-blue-700 mb-1">시나리오</h3>
              <div className="text-xs text-blue-600">
                {caseData.scenarioJson.properties?.meta?.name && (
                  <div>환자명: {caseData.scenarioJson.properties.meta.name}</div>
                )}
                {caseData.scenarioJson.properties?.meta?.age && (
                  <div>나이: {caseData.scenarioJson.properties.meta.age}세</div>
                )}
              </div>
            </div>
          )}

          {/* 체크리스트 요약 */}
          {caseData.checklistJson && (
            <div className="rounded bg-green-50 p-3">
              <h3 className="text-xs font-semibold text-green-700 mb-1">체크리스트</h3>
              <div className="text-xs text-green-600">
                {caseData.checklistJson.HistoryEvidenceChecklist && (
                  <span>병력 {caseData.checklistJson.HistoryEvidenceChecklist.length}항목 </span>
                )}
                {caseData.checklistJson.PhysicalexamEvidenceChecklist && (
                  <span>
                    신체진찰 {caseData.checklistJson.PhysicalexamEvidenceChecklist.length}항목{" "}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* 해설 */}
          {caseData.solutionText && (
            <div className="rounded bg-purple-50 p-3">
              <h3 className="text-xs font-semibold text-purple-700 mb-1">해설</h3>
              <p className="text-xs text-purple-600 line-clamp-3">{caseData.solutionText}</p>
            </div>
          )}

          <div className="text-xs text-gray-400">
            최종 수정: {new Date(caseData.updatedAt).toLocaleString("ko-KR")}
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setEditMode(true)}
              className="flex-1 rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
            >
              수정
            </button>
            <Link
              href={`/admin/dashboard/scenario-gen?case=${encodeURIComponent(caseData.name)}`}
              className="flex-1 rounded-lg bg-violet-100 px-4 py-2 text-sm font-medium text-violet-700 hover:bg-violet-200 text-center"
            >
              생성기
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
