"use client";

import React, { useEffect, useRef } from "react";

interface ExplanationPannelProps {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
}

export const ExplanationPannel: React.FC<ExplanationPannelProps> = ({
  value,
  onChange,
  disabled = false,
}) => {
  const editorRef = useRef<HTMLDivElement | null>(null);

  const normalizeHtml = (html: string) => {
    return html
      .replace(/<div><br\s*\/?><\/div>/gi, "<br />")
      .replace(/<\/div>\s*<div>/gi, "<br />")
      .replace(/<\/p>\s*<p>/gi, "<br />")
      .replace(/<\/?(div|p)[^>]*>/gi, "");
  };

  const sanitizeHtml = (html: string) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    const escapeHtml = (text: string) =>
      text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const walk = (node: Node): string => {
      if (node.nodeType === Node.TEXT_NODE) {
        return escapeHtml(node.textContent ?? "");
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return "";

      const el = node as HTMLElement;
      const tag = el.tagName.toLowerCase();
      if (tag === "script" || tag === "style") return "";

      const children = Array.from(el.childNodes).map(walk).join("");
      if (tag === "br") return "<br />";
      if (tag === "strong" || tag === "b") return `<strong>${children}</strong>`;
      if (tag === "div" || tag === "p" || tag === "li") {
        return `${children}<br />`;
      }
      return children;
    };

    const combined = Array.from(doc.body.childNodes).map(walk).join("");
    return combined.replace(/(<br \/>)+$/g, "");
  };

  useEffect(() => {
    if (!editorRef.current) return;
    if (editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  const handleInput = () => {
    if (!editorRef.current) return;
    onChange(editorRef.current.innerHTML);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    e.preventDefault();
    const editorEl = editorRef.current;
    if (!editorEl) return;

    const text = e.clipboardData.getData("text/plain");
    const escaped = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    const html = sanitizeHtml(
      escaped
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\n/g, "<br />")
    );

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    range.deleteContents();
    const fragment = range.createContextualFragment(html);
    range.insertNode(fragment);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
    onChange(editorEl.innerHTML);
  };

  const applyBold = () => {
    if (disabled) return;
    const editorEl = editorRef.current;
    const selection = window.getSelection();
    if (!editorEl || !selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    if (!editorEl.contains(range.commonAncestorContainer)) return;

    if (range.collapsed) {
      const strong = document.createElement("strong");
      strong.textContent = "굵게";
      range.insertNode(strong);
      range.setStartAfter(strong);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      editorEl.focus();
      handleInput();
      return;
    }

    const strong = document.createElement("strong");
    strong.appendChild(range.extractContents());
    range.insertNode(strong);
    range.setStartAfter(strong);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    editorEl.focus();
    handleInput();
  };

  return (
    <section className="flex flex-1 min-w-0 flex-col h-[calc(100vh-120px)] rounded-2xl border border-[#D8D2F5] bg-white shadow-sm">
      <header className="pt-4 px-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-[#210535]">해설</h2>
        </div>
      </header>

      <div className="px-1 pb-4 flex flex-1 flex-col gap-3">
        <div className="relative flex-1">
          {!value && (
            <div className="absolute top-3 left-3 text-sm text-gray-400 pointer-events-none">
              클릭하여 입력을 시작해주세요. 중요한 문장은 볼드 처리할 수 있습니다.
            </div>
          )}
          <div
            ref={editorRef}
            className={`h-full w-full overflow-y-auto rounded-xl border border-transparent bg-white px-3 py-2 text-base text-[#1F2430] focus:outline-none focus:ring-0 ${
              disabled ? "opacity-60 cursor-not-allowed" : ""
            }`}
            contentEditable={!disabled}
            onInput={handleInput}
            onPaste={handlePaste}
            suppressContentEditableWarning
            aria-label="해설 편집기"
          />
        </div>
      </div>
    </section>
  );
};
