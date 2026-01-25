"use client";

import { useState, useEffect, useCallback, Fragment } from "react";
import { useRouter } from "next/navigation";
import ChiefComplaintDropdown from "./ChiefComplaintDropdown";
import { ChiefComplaint } from "@/constants/chiefComplaints";

type ScenarioStatus = "DRAFT" | "PUBLISHED" | "LEGACY";

interface ScenarioVersion {
  id: string;
  chiefComplaint: string;
  caseName: string;
  versionNumber: number;
  status: ScenarioStatus;
  scenarioContent: unknown;
  checklistIncludedMap: unknown;
  commentaryContent: unknown;
  createdAt: string;
  publishedAt: string | null;
}

interface ScenarioItem extends ScenarioVersion {
  totalVersions: number;
  allVersions?: ScenarioVersion[];
}

interface ScenarioListTableProps {
  initialChiefComplaint?: string;
}

export default function ScenarioListTable({
  initialChiefComplaint,
}: ScenarioListTableProps) {
  const router = useRouter();
  const [scenarios, setScenarios] = useState<ScenarioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 필터 상태
  const [chiefComplaint, setChiefComplaint] = useState<ChiefComplaint | null>(
    (initialChiefComplaint as ChiefComplaint) || null
  );
  const [statusFilter, setStatusFilter] = useState<ScenarioStatus | "">("");
  const [searchTerm, setSearchTerm] = useState("");

  // 확장된 행 (버전 히스토리 표시)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // 데이터 로드
  const fetchScenarios = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (chiefComplaint) params.set("chiefComplaint", chiefComplaint);
      if (statusFilter) params.set("status", statusFilter);
      if (!statusFilter) params.set("includeAll", "false");

      const res = await fetch(`/api/admin/scenario?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "조회 실패");
      }

      setScenarios(data.scenarios || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "데이터 로드 실패");
    } finally {
      setLoading(false);
    }
  }, [chiefComplaint, statusFilter]);

  useEffect(() => {
    fetchScenarios();
  }, [fetchScenarios]);

  // 필터링된 시나리오
  const filteredScenarios = scenarios.filter((s) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      s.caseName.toLowerCase().includes(term) ||
      s.chiefComplaint.toLowerCase().includes(term)
    );
  });

  // 상태 뱃지 컬러
  const getStatusBadge = (status: ScenarioStatus) => {
    switch (status) {
      case "PUBLISHED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
            배포됨
          </span>
        );
      case "DRAFT":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-yellow-100 text-yellow-700">
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
            임시저장
          </span>
        );
      case "LEGACY":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-500">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
            이전버전
          </span>
        );
    }
  };

  // 컨텐츠 상태 표시
  const getContentStatus = (content: unknown) => {
    return content ? (
      <span className="text-green-600">O</span>
    ) : (
      <span className="text-gray-300">-</span>
    );
  };

  // 행 토글
  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // 새로 생성
  const handleCreate = () => {
    router.push("/admin/dashboard/scenario-gen/new");
  };

  // 편집
  const handleEdit = (id: string) => {
    router.push(`/admin/dashboard/scenario-gen/${id}`);
  };

  // 삭제
  const handleDelete = async (id: string) => {
    if (!confirm("정말 삭제하시겠습니까?")) return;

    try {
      const res = await fetch(`/api/admin/scenario?id=${id}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "삭제 실패");
      }

      fetchScenarios();
    } catch (err) {
      alert(err instanceof Error ? err.message : "삭제 중 오류 발생");
    }
  };

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <button
          onClick={handleCreate}
          className="inline-flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors font-medium"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          새로 생성
        </button>
      </div>

      {/* 필터 */}
      <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
        <div className="w-64">
          <ChiefComplaintDropdown
            value={chiefComplaint}
            onChange={setChiefComplaint}
            placeholder="주호소 선택"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as ScenarioStatus | "")}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-500"
        >
          <option value="">모든 상태</option>
          <option value="PUBLISHED">배포됨</option>
          <option value="DRAFT">임시저장</option>
          <option value="LEGACY">이전버전</option>
        </select>
        <div className="flex-1">
          <input
            type="text"
            placeholder="케이스명 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-500"
          />
        </div>
        <button
          onClick={fetchScenarios}
          className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
        >
          검색
        </button>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
          {error}
        </div>
      )}

      {/* 테이블 */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="w-10 px-4 py-3" />
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                주호소
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                케이스명
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                버전
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                시나리오
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                체크리스트
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                해설
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                상태
              </th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                액션
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                  로딩 중...
                </td>
              </tr>
            ) : filteredScenarios.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                  {searchTerm || chiefComplaint || statusFilter
                    ? "검색 결과가 없습니다."
                    : "등록된 시나리오가 없습니다."}
                </td>
              </tr>
            ) : (
              filteredScenarios.map((scenario) => {
                const isExpanded = expandedRows.has(scenario.id);
                const otherVersions = scenario.allVersions?.filter(v => v.id !== scenario.id) || [];

                return (
                  <Fragment key={scenario.id}>
                    {/* 메인 행 (PUBLISHED 또는 최신 버전) */}
                    <tr
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => handleEdit(scenario.id)}
                    >
                      <td className="px-4 py-3">
                        {scenario.totalVersions > 1 && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleRow(scenario.id);
                            }}
                            className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                          >
                            <svg
                              className={`w-4 h-4 transition-transform ${
                                isExpanded ? "rotate-90" : ""
                              }`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 5l7 7-7 7"
                              />
                            </svg>
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {scenario.chiefComplaint}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                        {scenario.caseName}
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-gray-600">
                        v{scenario.versionNumber.toFixed(1)}
                        {scenario.totalVersions > 1 && (
                          <span className="ml-1 text-xs text-gray-400">
                            ({scenario.totalVersions})
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center text-sm">
                        {getContentStatus(scenario.scenarioContent)}
                      </td>
                      <td className="px-4 py-3 text-center text-sm">
                        {getContentStatus(scenario.checklistIncludedMap)}
                      </td>
                      <td className="px-4 py-3 text-center text-sm">
                        {getContentStatus(scenario.commentaryContent)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {getStatusBadge(scenario.status)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div
                          className="flex items-center justify-center gap-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {(scenario.status === "DRAFT" || scenario.status === "PUBLISHED") && (
                            <button
                              onClick={() => handleDelete(scenario.id)}
                              className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded transition-colors"
                            >
                              삭제
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* 확장 시 다른 버전들 표시 */}
                    {isExpanded && otherVersions.map((version) => (
                      <tr
                        key={version.id}
                        className="bg-gray-50/50 hover:bg-gray-100/50 transition-colors cursor-pointer"
                        onClick={() => handleEdit(version.id)}
                      >
                        <td className="px-4 py-2">
                          <div className="w-4 h-4 ml-2 border-l-2 border-b-2 border-gray-300 rounded-bl" />
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-500">
                          {version.chiefComplaint}
                        </td>
                        <td className="px-4 py-2 text-sm text-gray-500">
                          {version.caseName}
                        </td>
                        <td className="px-4 py-2 text-center text-sm text-gray-500">
                          v{version.versionNumber.toFixed(1)}
                        </td>
                        <td className="px-4 py-2 text-center text-sm">
                          {getContentStatus(version.scenarioContent)}
                        </td>
                        <td className="px-4 py-2 text-center text-sm">
                          {getContentStatus(version.checklistIncludedMap)}
                        </td>
                        <td className="px-4 py-2 text-center text-sm">
                          {getContentStatus(version.commentaryContent)}
                        </td>
                        <td className="px-4 py-2 text-center">
                          {getStatusBadge(version.status)}
                        </td>
                        <td className="px-4 py-2 text-center">
                          <div
                            className="flex items-center justify-center gap-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {(version.status === "DRAFT" || version.status === "PUBLISHED") && (
                              <button
                                onClick={() => handleDelete(version.id)}
                                className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded transition-colors"
                              >
                                삭제
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 요약 */}
      <div className="text-sm text-gray-500">
        총 {filteredScenarios.length}개의 시나리오
      </div>
    </div>
  );
}
