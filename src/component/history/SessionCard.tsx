"use client";

import RightArrowIcon from "@/assets/icon/RightArrowIcon.svg";

interface SessionCardProps {
  caseName: string;
  chiefComplaint: string | null;
  origin: string;
  total: number | null;
  startedAt: string;
  onClick: () => void;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${month}월 ${day}일 ${hours}:${minutes}`;
}

export default function SessionCard({
  caseName,
  chiefComplaint,
  origin,
  total,
  startedAt,
  onClick,
}: SessionCardProps) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center justify-between rounded-xl border border-[#E8E4F6] bg-white px-5 py-4 cursor-pointer transition-opacity hover:opacity-80"
    >
      <div className="flex flex-col items-start gap-1">
        <div className="flex items-center gap-2">
          <span className="text-[16px] font-semibold text-[#210535]">
            {caseName}
          </span>
          <span className="rounded-full bg-[#F0EEFC] px-2 py-0.5 text-[11px] font-medium text-[#5B4A99]">
            {origin === "VP" ? "가상환자" : "녹음본"}
          </span>
        </div>
        <div className="flex items-center gap-2 text-[13px] text-[#8C8C8C]">
          {chiefComplaint && <span>{chiefComplaint}</span>}
          <span>{formatDate(startedAt)}</span>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {total !== null && (
          <span className="text-[18px] font-bold text-[#7553FC]">
            {total}점
          </span>
        )}
        <RightArrowIcon className="h-[18px] w-[18px] text-[#BDBDBD]" />
      </div>
    </button>
  );
}
