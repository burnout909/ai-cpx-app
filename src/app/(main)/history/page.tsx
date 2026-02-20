"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/component/Header";
import SmallHeader from "@/component/SmallHeader";
import SessionCard from "@/component/history/SessionCard";
import Spinner from "@/component/Spinner";
import { track } from "@/lib/mixpanel";
import { usePageTracking } from "@/hooks/usePageTracking";
import ArrowUpIcon from "@/assets/icon/ArrowUpIcon.svg";

interface SessionData {
  id: string;
  origin: string;
  status: string;
  startedAt: string;
  case: {
    id: string;
    name: string;
    chiefComplaint?: string | null;
    description?: string | null;
  } | null;
  scores: { total: number | null }[];
}

type DateFilter = "all" | "week" | "month";
type OriginFilter = "" | "VP" | "SP";

export default function HistoryPage() {
  const router = useRouter();
  usePageTracking("history");
  const [allSessions, setAllSessions] = useState<SessionData[]>([]);
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [selectedCaseName, setSelectedCaseName] = useState<string>("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");
  const [originFilter, setOriginFilter] = useState<OriginFilter>("");

  // Close dropdown on outside click
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener("mousedown", handleOutside);
      return () => document.removeEventListener("mousedown", handleOutside);
    }
  }, [dropdownOpen]);

  const fetchSessions = useCallback(async (caseName: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        status: "COMPLETED",
        limit: "100",
      });
      if (caseName) params.set("caseName", caseName);
      const res = await fetch(`/api/metadata?${params}`);
      const data = await res.json();
      const fetched = data.sessions ?? [];
      setSessions(fetched);
      if (!caseName) {
        setAllSessions(fetched);
        setInitialLoaded(true);
      }
    } catch {
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions(selectedCaseName);
  }, [selectedCaseName, fetchSessions]);

  // Unique case names from the initial full fetch
  const availableCaseNames = useMemo(() => {
    const set = new Set<string>();
    allSessions.forEach((s) => {
      if (s.case?.name) set.add(s.case.name);
    });
    return Array.from(set).sort();
  }, [allSessions]);

  // Client-side date + origin filtering
  const filteredSessions = useMemo(() => {
    let result = sessions;
    if (originFilter) {
      result = result.filter((s) => s.origin === originFilter);
    }
    if (dateFilter !== "all") {
      const now = Date.now();
      const cutoff =
        dateFilter === "week" ? now - 7 * 86400_000 : now - 30 * 86400_000;
      result = result.filter((s) => new Date(s.startedAt).getTime() >= cutoff);
    }
    return result;
  }, [sessions, dateFilter, originFilter]);

  const handleCaseSelect = (name: string) => {
    if (name === selectedCaseName) {
      fetchSessions(name);
    }
    setSelectedCaseName(name);
    setDropdownOpen(false);
    track("history_case_filter", { case_name: name || "전체" });
  };

  const handleCardClick = (session: SessionData) => {
    const caseName = session.case?.name ?? "";
    track("history_session_clicked", { session_id: session.id, case_name: caseName, origin: session.origin });
    router.push(
      `/score?sessionId=${session.id}&caseName=${encodeURIComponent(caseName)}&origin=${session.origin}&from=history`
    );
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <SmallHeader title="내 학습 기록" onClick={() => router.push("/home")} />

      {/* Filters */}
      <div className="flex flex-col gap-3 px-5 pt-2 pb-3">
        {/* Case name — dropdown */}
        <div className="flex items-center gap-3">
          <span className="w-[52px] shrink-0 text-[12px] font-semibold text-[#210535]">
            주호소
          </span>
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen((v) => !v)}
              className={`flex items-center gap-1 rounded-full px-3 py-1 text-[12px] font-medium cursor-pointer transition-colors ${
                selectedCaseName
                  ? "bg-[#7553FC] text-white"
                  : "bg-[#F0EEFC] text-[#5B4A99]"
              }`}
            >
              {selectedCaseName || "전체"}
              <ArrowUpIcon
                className={`h-3 w-3 transition-transform ${dropdownOpen ? "" : "rotate-180"}`}
              />
            </button>
            {dropdownOpen && (
              <div className="absolute left-0 top-[calc(100%+4px)] z-10 max-h-[240px] min-w-[140px] overflow-y-auto rounded-xl bg-white py-1 shadow-lg ring-1 ring-black/5">
                <DropdownItem
                  label="전체"
                  active={selectedCaseName === ""}
                  onClick={() => handleCaseSelect("")}
                />
                {availableCaseNames.map((name) => (
                  <DropdownItem
                    key={name}
                    label={name}
                    active={selectedCaseName === name}
                    onClick={() => handleCaseSelect(name)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Origin filter chips */}
        <div className="flex items-center gap-3">
          <span className="w-[52px] shrink-0 text-[12px] font-semibold text-[#210535]">
            실습 유형
          </span>
          <div className="flex gap-2">
            {(
              [
                ["", "전체"],
                ["SP", "녹음본"],
                ["VP", "가상환자"],
              ] as const
            ).map(([value, label]) => (
              <ChipButton
                key={value}
                label={label}
                active={originFilter === value}
                onClick={() => { track("history_origin_filter", { filter: label }); setOriginFilter(value); }}
              />
            ))}
          </div>
        </div>

        {/* Date filter chips */}
        <div className="flex items-center gap-3">
          <span className="w-[52px] shrink-0 text-[12px] font-semibold text-[#210535]">
            날짜
          </span>
          <div className="flex gap-2">
            {(
              [
                ["all", "전체"],
                ["week", "최근 1주"],
                ["month", "최근 1개월"],
              ] as const
            ).map(([value, label]) => (
              <ChipButton
                key={value}
                label={label}
                active={dateFilter === value}
                onClick={() => { track("history_date_filter", { filter: label }); setDateFilter(value); }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Session list */}
      <div className="flex flex-1 flex-col gap-3 px-5 pb-8">
        {loading && !initialLoaded ? (
          <div className="flex flex-1 items-center justify-center pt-20">
            <Spinner size={28} borderClassName="border-[#7553FC]" />
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="flex flex-1 items-center justify-center pt-20">
            <p className="text-[15px] text-[#8C8C8C]">
              {allSessions.length === 0
                ? "아직 완료된 실습 기록이 없습니다."
                : "선택한 조건에 맞는 기록이 없습니다."}
            </p>
          </div>
        ) : (
          filteredSessions.map((session) => (
            <SessionCard
              key={session.id}
              caseName={session.case?.name ?? "알 수 없음"}
              chiefComplaint={session.case?.chiefComplaint ?? null}
              origin={session.origin}
              total={session.scores?.[0]?.total ?? null}
              startedAt={session.startedAt}
              onClick={() => handleCardClick(session)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function ChipButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`whitespace-nowrap rounded-full px-3 py-1 text-[12px] font-medium transition-colors cursor-pointer ${
        active
          ? "bg-[#7553FC] text-white"
          : "bg-[#F0EEFC] text-[#5B4A99]"
      }`}
    >
      {label}
    </button>
  );
}

function DropdownItem({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full px-4 py-2 text-left text-[13px] cursor-pointer transition-colors ${
        active
          ? "bg-[#F0EEFC] font-semibold text-[#7553FC]"
          : "text-[#210535] hover:bg-[#F7F6FB]"
      }`}
    >
      {label}
    </button>
  );
}
