'use client';

import { FormEvent, useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { Chat, useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import CloseIcon from "@/assets/icon/CloseIcon.svg";
import FloatingButton from "./FloatingButton";

export default function FloatingChatLauncher() {
  const pathname = usePathname();
  const [href, setHref] = useState("");
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setHref(window.location.href);
    }
  }, [pathname]);

  const currentUrl = href || pathname || "/";

  const chat = useMemo(
    () =>
      new Chat({
        transport: new DefaultChatTransport({
          api: "/api/chat",
          body: { currentUrl },
        }),
      }),
    [currentUrl],
  );

  const { messages, status, error, sendMessage, stop } = useChat({ chat });

  const isLoading = status === "submitted" || status === "streaming";

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = input.trim();
    if (!text || isLoading) return;
    void sendMessage({ text });
    setInput("");
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-[60]">
      {open && (
        <button
          type="button"
          aria-label="Close chat overlay"
          onClick={() => setOpen(false)}
          className="pointer-events-auto absolute inset-0 bg-black/40"
        />
      )}

      <div className="absolute inset-x-0 bottom-0">
        <div className="relative z-[2] mx-auto w-full max-w-[450px]">
          {open && (
            <div className="pointer-events-auto absolute left-5 right-5 bottom-[180px] flex h-[calc((100vh-180px)*0.7)] max-h-[80vh] flex-col overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-[0_12px_30px_rgba(0,0,0,0.12)]">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="w-4 h-4"/>
                </div>
                <button
                  type="button"
                  aria-label="Close chat"
                  onClick={() => setOpen(false)}
                  className="rounded-md px-2 py-0.5 text-xs text-[#6B7280] hover:bg-[#F3F4F6]"
                >
                  <CloseIcon width={16} height={16} />
                </button>
              </div>

              <div className="mt-3 flex-1 overflow-y-auto rounded-lg bg-[#F9FAFB] p-2 text-sm text-[#111827]">
                {messages.length === 0 && (
                  <p className="text-[14px] text-[#6B7280]">궁금한 내용을 물어보세요!</p>
                )}
                {messages.length > 0 && (
                  <div className="flex flex-col gap-3">
                    {messages.map((message) => {
                      const messageText = message.parts
                        .map((part) => {
                          if (part.type === "text" || part.type === "reasoning") {
                            return part.text;
                          }
                          return "";
                        })
                        .filter(Boolean)
                        .join(" ")
                        .trim();
                      const isThinking = !messageText && message.role === "assistant";
                      const displayText = messageText || (isThinking ? "생각 중..." : "");

                      return (
                        <div
                          key={message.id}
                          className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                            message.role === "user"
                              ? "self-end bg-[#7553FC] text-white"
                              : "self-start border border-[#E5E7EB] bg-white text-[#111827] shadow-sm"
                          } ${isThinking ? "animate-pulse" : ""}`}
                        >
                          {displayText}
                        </div>
                      );
                    })}
                    {isLoading && (
                      <div className="self-start text-[14px] text-[#6B7280] animate-pulse">생각 중...</div>
                    )}
                  </div>
                )}
              </div>

              {error && (
                <div className="mt-2 rounded-lg bg-[#FEF2F2] px-3 py-2 text-xs text-[#B91C1C]">
                  {error.message}
                </div>
              )}

              <form onSubmit={handleSubmit} className="mt-3 flex items-center gap-2">
                <input
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="질문을 입력하세요"
                  disabled={status !== "ready"}
                  className="flex-1 rounded-full border border-[#E5E7EB] bg-white px-4 py-2 text-sm outline-none focus:border-[#7553FC] focus:ring-1 focus:ring-[#7553FC]"
                />
                {isLoading ? (
                  <button
                    type="button"
                    onClick={stop}
                    disabled={!isLoading}
                    className="rounded-full bg-[#F3F4F6] px-3 py-2 text-xs text-[#374151] hover:bg-[#E5E7EB]"
                  >
                    중지
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!input.trim()}
                    className="rounded-full bg-[#7553FC] px-4 py-2 text-xs font-semibold text-white hover:opacity-90"
                  >
                    보내기
                  </button>
                )}
              </form>
            </div>
          )}

          <FloatingButton
            className="pointer-events-auto absolute bottom-24 right-5"
            onClick={() => setOpen((v) => !v)}
            ariaLabel="Open chat"
          />
        </div>
      </div>
    </div>
  );
}
