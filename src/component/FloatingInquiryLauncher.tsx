'use client';

import { useCallback, useEffect, useState } from "react";
import CloseIcon from "@/assets/icon/CloseIcon.svg";
import ArrowUpIcon from "@/assets/icon/ArrowUpIcon.svg";
import FloatingButton from "./FloatingButton";
import { InquiryItem } from "@/types/inquiry";
import { track } from "@/lib/mixpanel";

type Tab = "new" | "list";

export default function FloatingInquiryLauncher() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("new");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [items, setItems] = useState<InquiryItem[]>([]);
  const [hasUnread, setHasUnread] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const fetchInquiries = useCallback(async () => {
    try {
      const res = await fetch("/api/inquiry");
      if (!res.ok) return;
      const data = await res.json();
      setItems(data.items ?? []);
      setHasUnread(data.hasUnread ?? false);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchInquiries();
  }, [fetchInquiries]);

  useEffect(() => {
    if (open) fetchInquiries();
  }, [open, fetchInquiries]);

  const handleSubmit = async () => {
    if (!content.trim() || submitting) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await fetch("/api/inquiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content.trim() }),
      });
      if (res.ok) {
        track("inquiry_submitted");
        setContent("");
        setSubmitSuccess(true);
        setTimeout(() => setSubmitSuccess(false), 2000);
        fetchInquiries();
      } else {
        const data = await res.json().catch(() => ({}));
        setSubmitError(data.error || "문의 등록에 실패했습니다.");
      }
    } catch {
      setSubmitError("네트워크 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  const markRead = async (id: string) => {
    try {
      await fetch("/api/inquiry", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, readByUser: true } : item))
      );
      const stillUnread = items.some(
        (item) => item.id !== id && item.status === "ANSWERED" && !item.readByUser
      );
      setHasUnread(stillUnread);
    } catch { /* ignore */ }
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-[60]">
      {open && (
        <button
          type="button"
          aria-label="Close overlay"
          onClick={() => { track("inquiry_closed"); setOpen(false); }}
          className="pointer-events-auto absolute inset-0 bg-black/40"
        />
      )}

      <div className="absolute inset-x-0 bottom-0">
        <div className="relative z-[2] mx-auto w-full max-w-[450px]">
          {open && (
            <div className="pointer-events-auto absolute left-5 right-5 bottom-[180px] flex h-[calc((100vh-180px)*0.9)] max-h-[80vh] flex-col overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-[0_12px_30px_rgba(0,0,0,0.12)]">
              {/* Header */}
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-[#111827]">문의하기</h2>
                <button
                  type="button"
                  aria-label="Close"
                  onClick={() => { track("inquiry_closed"); setOpen(false); }}
                  className="rounded-md px-2 py-0.5 text-[#6B7280] hover:bg-[#F3F4F6]"
                >
                  <CloseIcon width={16} height={16} />
                </button>
              </div>

              {/* Tabs */}
              <div className="mt-3 flex rounded-lg bg-[#F3F4F6] p-1">
                {(["new", "list"] as Tab[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => { track("inquiry_tab_clicked", { tab: t === "new" ? "새 문의" : "내 문의 내역" }); setTab(t); }}
                    className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${
                      tab === t
                        ? "bg-white text-[#7553FC] shadow-sm"
                        : "text-[#6B7280] hover:text-[#111827]"
                    }`}
                  >
                    {t === "new" ? "새 문의" : "내 문의 내역"}
                    {t === "list" && hasUnread && (
                      <span className="ml-1.5 inline-block h-2 w-2 rounded-full bg-red-500" />
                    )}
                  </button>
                ))}
              </div>

              {/* Content */}
              <div className="mt-3 flex-1 overflow-y-auto">
                {tab === "new" ? (
                  <div className="flex flex-col gap-3">
                    <textarea
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      placeholder="문의 내용을 입력하세요"
                      rows={8}
                      className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm outline-none focus:border-[#7553FC] focus:ring-1 focus:ring-[#7553FC] resize-none"
                    />
                    {submitSuccess && (
                      <p className="text-sm text-green-600">문의가 등록되었습니다.</p>
                    )}
                    {submitError && (
                      <p className="text-sm text-red-600">{submitError}</p>
                    )}
                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={!content.trim() || submitting}
                      className="flex items-center justify-center gap-1.5 rounded-lg bg-[#7553FC] py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                    >
                      <ArrowUpIcon width={14} height={14} />
                      {submitting ? "제출 중..." : "제출하기"}
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {items.length === 0 && (
                      <p className="py-8 text-center text-sm text-[#6B7280]">
                        문의 내역이 없습니다.
                      </p>
                    )}
                    {items.map((item) => {
                      if (item.status === "ANSWERED" && !item.readByUser) {
                        markRead(item.id);
                      }
                      return (
                        <div
                          key={item.id}
                          className="rounded-lg border border-[#E5E7EB] bg-white p-3 shadow-sm"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs text-[#9CA3AF]">
                              {new Date(item.createdAt).toLocaleDateString("ko-KR")}
                            </p>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {item.status === "ANSWERED" && !item.readByUser && (
                                <span className="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                                  NEW
                                </span>
                              )}
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                  item.status === "PENDING"
                                    ? "bg-orange-100 text-orange-700"
                                    : "bg-green-100 text-green-700"
                                }`}
                              >
                                {item.status === "PENDING" ? "대기중" : "답변완료"}
                              </span>
                            </div>
                          </div>
                          <p className="mt-2 text-sm text-[#374151] whitespace-pre-wrap">
                            {item.content}
                          </p>
                          {item.answer && (
                            <div className="mt-3 rounded-lg bg-[#F0EDFF] p-3">
                              <p className="text-xs font-semibold text-[#7553FC] mb-1">답변</p>
                              <p className="text-sm text-[#374151] whitespace-pre-wrap">
                                {item.answer}
                              </p>
                              {item.answeredAt && (
                                <p className="mt-1 text-[10px] text-[#9CA3AF]">
                                  {new Date(item.answeredAt).toLocaleDateString("ko-KR")}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="pointer-events-auto absolute bottom-24 right-5">
            <FloatingButton
              onClick={() => {
                setOpen((v) => {
                  track(v ? "inquiry_closed" : "inquiry_opened");
                  return !v;
                });
              }}
              ariaLabel="문의하기"
            />
            {hasUnread && (
              <span className="absolute top-1 right-1 h-2.5 w-2.5 rounded-full bg-red-500 ring-[1.5px] ring-white" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
