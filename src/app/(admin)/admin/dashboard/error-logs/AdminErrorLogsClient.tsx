"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

interface ErrorLogItem {
  id: string;
  level: "WARN" | "ERROR";
  message: string;
  stackTrace: string | null;
  source: string | null;
  userId: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

interface FetchResult {
  items: ErrorLogItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

type SortField = "createdAt" | "level";
type SortDir = "asc" | "desc";

export default function AdminErrorLogsClient() {
  const [data, setData] = useState<FetchResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Filters
  const [levelFilter, setLevelFilter] = useState<"ALL" | "WARN" | "ERROR">("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);

  // Sort
  const [sortField, setSortField] = useState<SortField>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (levelFilter !== "ALL") params.set("level", levelFilter);
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      params.set("page", String(page));
      params.set("limit", "20");

      const res = await fetch(`/api/admin/error-logs?${params}`);
      if (!res.ok) return;
      const json: FetchResult = await res.json();
      setData(json);
    } finally {
      setLoading(false);
    }
  }, [levelFilter, startDate, endDate, page]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const sortedItems = data?.items
    ? [...data.items].sort((a, b) => {
        const dir = sortDir === "asc" ? 1 : -1;
        if (sortField === "createdAt") {
          return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * dir;
        }
        return a.level.localeCompare(b.level) * dir;
      })
    : [];

  const sortArrow = (field: SortField) => {
    if (sortField !== field) return "";
    return sortDir === "asc" ? " ↑" : " ↓";
  };

  return (
    <div className="mx-auto flex w-full flex-col gap-6 px-16 py-10">
      <header>
        <Link href="/admin/dashboard" className="text-base text-gray-500 hover:text-violet-600">
          ← Admin Dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-gray-900">에러 로그</h1>
      </header>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">레벨</label>
          <div className="flex gap-1">
            {(["ALL", "WARN", "ERROR"] as const).map((lv) => (
              <button
                key={lv}
                type="button"
                onClick={() => { setLevelFilter(lv); setPage(1); }}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                  levelFilter === lv
                    ? "bg-[#7553FC] text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {lv === "ALL" ? "전체" : lv}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">시작일</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm outline-none focus:border-[#7553FC]"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">종료일</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm outline-none focus:border-[#7553FC]"
          />
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <p className="text-sm text-gray-500">불러오는 중...</p>
      ) : sortedItems.length === 0 ? (
        <p className="text-sm text-gray-500">로그가 없습니다.</p>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold text-gray-500">
                  <th
                    className="px-4 py-3 cursor-pointer select-none"
                    onClick={() => handleSort("createdAt")}
                  >
                    시간{sortArrow("createdAt")}
                  </th>
                  <th
                    className="px-4 py-3 cursor-pointer select-none"
                    onClick={() => handleSort("level")}
                  >
                    레벨{sortArrow("level")}
                  </th>
                  <th className="px-4 py-3">메시지</th>
                  <th className="px-4 py-3">소스</th>
                </tr>
              </thead>
              <tbody>
                {sortedItems.map((item) => (
                  <tr key={item.id} className="group">
                    <td colSpan={4} className="p-0">
                      <button
                        type="button"
                        onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                        className="w-full text-left hover:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-center">
                          <span className="px-4 py-3 w-[180px] shrink-0 text-xs text-gray-500">
                            {new Date(item.createdAt).toLocaleString("ko-KR")}
                          </span>
                          <span className="px-4 py-3 w-[80px] shrink-0">
                            <span
                              className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                                item.level === "ERROR"
                                  ? "bg-red-100 text-red-700"
                                  : "bg-yellow-100 text-yellow-700"
                              }`}
                            >
                              {item.level}
                            </span>
                          </span>
                          <span className="px-4 py-3 flex-1 truncate text-gray-700">
                            {item.message.length > 100
                              ? item.message.slice(0, 100) + "..."
                              : item.message}
                          </span>
                          <span className="px-4 py-3 w-[160px] shrink-0 truncate text-xs text-gray-400">
                            {item.source ?? "-"}
                          </span>
                        </div>
                      </button>

                      {/* Expanded detail */}
                      {expandedId === item.id && (
                        <div className="border-t border-gray-100 bg-gray-50 px-6 py-4 space-y-3">
                          <div>
                            <p className="text-xs font-semibold text-gray-500 mb-1">전체 메시지</p>
                            <p className="text-sm text-gray-700 whitespace-pre-wrap break-all">
                              {item.message}
                            </p>
                          </div>
                          {item.stackTrace && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 mb-1">스택 트레이스</p>
                              <pre className="text-xs text-gray-600 whitespace-pre-wrap break-all bg-white rounded-lg p-3 border border-gray-200 max-h-60 overflow-y-auto">
                                {item.stackTrace}
                              </pre>
                            </div>
                          )}
                          {item.userId && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 mb-1">사용자 ID</p>
                              <p className="text-sm text-gray-700 font-mono">{item.userId}</p>
                            </div>
                          )}
                          {item.userAgent && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 mb-1">User Agent</p>
                              <p className="text-xs text-gray-600 break-all">{item.userAgent}</p>
                            </div>
                          )}
                          {item.metadata && Object.keys(item.metadata).length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 mb-1">메타데이터</p>
                              <pre className="text-xs text-gray-600 whitespace-pre-wrap break-all bg-white rounded-lg p-3 border border-gray-200 max-h-40 overflow-y-auto">
                                {JSON.stringify(item.metadata, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {data && data.totalPages > 1 && (
            <div className="flex items-center justify-center gap-4">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 disabled:opacity-40"
              >
                ← 이전
              </button>
              <span className="text-sm text-gray-500">
                {data.page} / {data.totalPages}
              </span>
              <button
                type="button"
                disabled={page >= data.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 disabled:opacity-40"
              >
                다음 →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
