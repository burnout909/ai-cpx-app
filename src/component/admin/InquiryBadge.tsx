"use client";

import { useEffect, useState } from "react";

export default function InquiryBadge() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    fetch("/api/admin/inquiries")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.unansweredCount) setCount(data.unansweredCount);
      })
      .catch(() => {});
  }, []);

  if (count === 0) return null;

  return (
    <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold text-white">
      {count}
    </span>
  );
}
