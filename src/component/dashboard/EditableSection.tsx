import React from "react";

const inputBase =
  "w-full border border-[#E4DEF9] rounded-lg px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-[#B9A8FF]";

type AnyRecord = Record<string, any>;

interface Props {
  title: string;
  data: AnyRecord | string | Record<string, string[]>;
  onChange: (next: AnyRecord | string | Record<string, string[]>) => void;
  onInput?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
}

const toLines = (val: any): string =>
  Array.isArray(val) ? val.join("\n") : typeof val === "string" ? val : "";

export const EditableSection: React.FC<Props> = ({
  title,
  data,
  onChange,
  onInput,
}) => {
  const isPlainString = typeof data === "string";

  const handleStringChange = (value: string) => {
    onChange(value);
  };

  const handleObjectChange = (key: string, value: string) => {
    const next = {
      ...(typeof data === "object" && data ? data : {}),
      [key]: value
        .split("\n")
        .map((v) => v.trim())
        .filter(Boolean),
    };
    onChange(next);
  };

  if (isPlainString) {
    return (
      <div className="rounded-xl bg-white border border-[#E4DEF9] p-3">
        <div className="text-sm font-semibold text-[#210535] mb-2">{title}</div>
        <textarea
          className={`${inputBase} min-h-[80px]`}
          value={data as string}
          onChange={(e) => handleStringChange(e.target.value)}
          onInput={onInput}
        />
      </div>
    );
  }

  const entries = Object.entries(data || {});

  return (
    <div className="rounded-xl bg-white border border-[#E4DEF9] p-3">
      <div className="text-sm font-semibold text-[#210535] mb-2">{title}</div>
      {entries.length === 0 && (
        <p className="text-sm text-gray-500">내용 없음</p>
      )}
      {entries.map(([key, val]) => (
        <div key={key} className="mb-2">
          <div className="text-xs font-semibold text-[#6F659C] mb-1">
            {key}
          </div>
          <textarea
            className={`${inputBase} min-h-[70px]`}
            value={toLines(val)}
            onChange={(e) => handleObjectChange(key, e.target.value)}
            onInput={onInput}
          />
        </div>
      ))}
    </div>
  );
};
