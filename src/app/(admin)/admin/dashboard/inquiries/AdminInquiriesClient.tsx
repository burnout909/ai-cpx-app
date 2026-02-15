"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { InquiryItem } from "@/types/inquiry";

export default function AdminInquiriesClient() {
  const [items, setItems] = useState<InquiryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/inquiries");
      if (!res.ok) return;
      const data = await res.json();
      setItems(data.items ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleExpand = (id: string) => {
    const next = expandedId === id ? null : id;
    setExpandedId(next);
    setAnswerText("");
  };

  const handleAnswer = async (id: string) => {
    if (!answerText.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/inquiries", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, answer: answerText.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setItems((prev) =>
          prev.map((item) => (item.id === id ? data.item : item))
        );
        setExpandedId(null);
        setAnswerText("");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto flex w-full flex-col gap-6 px-16 py-10">
      <header className="flex items-center justify-between">
        <div>
          <Link href="/admin/dashboard" className="text-base text-gray-500 hover:text-violet-600">
            ← Admin Dashboard
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">문의사항 관리</h1>
        </div>
      </header>

      {loading ? (
        <p className="text-sm text-gray-500">불러오는 중...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-gray-500">문의가 없습니다.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-gray-200 bg-white shadow-sm"
            >
              <button
                type="button"
                onClick={() => handleExpand(item.id)}
                className="w-full p-4 text-left"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {item.title}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {item.user?.displayName ?? "알 수 없음"}
                      {item.user?.studentNumber
                        ? ` (${item.user.studentNumber})`
                        : ""}
                      {" · "}
                      {new Date(item.createdAt).toLocaleDateString("ko-KR")}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      item.status === "PENDING"
                        ? "bg-orange-100 text-orange-700"
                        : "bg-green-100 text-green-700"
                    }`}
                  >
                    {item.status === "PENDING" ? "대기중" : "답변완료"}
                  </span>
                </div>
              </button>

              {expandedId === item.id && (
                <div className="border-t border-gray-100 px-4 pb-4 pt-3">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                    {item.content}
                  </p>

                  {item.status === "ANSWERED" && item.answer ? (
                    <div className="mt-4 rounded-lg bg-[#F0EDFF] p-3">
                      <p className="text-xs font-semibold text-[#7553FC] mb-1">
                        답변
                        {item.answerer?.displayName
                          ? ` (${item.answerer.displayName})`
                          : ""}
                      </p>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">
                        {item.answer}
                      </p>
                      {item.answeredAt && (
                        <p className="mt-1 text-[10px] text-gray-400">
                          {new Date(item.answeredAt).toLocaleDateString("ko-KR")}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="mt-4 space-y-2">
                      <textarea
                        value={answerText}
                        onChange={(e) => setAnswerText(e.target.value)}
                        placeholder="답변을 입력하세요"
                        rows={4}
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-[#7553FC] focus:ring-1 focus:ring-[#7553FC] resize-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleAnswer(item.id)}
                        disabled={!answerText.trim() || submitting}
                        className="rounded-lg bg-[#7553FC] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                      >
                        {submitting ? "제출 중..." : "답변하기"}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
