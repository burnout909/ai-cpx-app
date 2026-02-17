import { NextResponse } from "next/server";
import { getOpenAIClient } from "../_lib";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { SectionTimingMap } from "@/types/score";

export const runtime = "nodejs";
export const maxDuration = 60;

type SectionLabel = "history" | "physical_exam" | "education";

interface Segment {
  id: number;
  start: number;
  end: number;
  text: string;
}

interface TurnTimestamp {
  text: string;
  elapsedSec: number;
}

interface ClassifyRequest {
  transcript: string;
  segments?: Segment[];
  turnTimestamps?: TurnTimestamp[];
  totalDurationSec?: number;
  caseName?: string;
}

// GPT returns an array of section segments (supports non-linear patterns like H→P→H→E)
const SectionSegmentsSchema = z.object({
  segments: z.array(
    z.object({
      section: z.enum(["history", "physical_exam", "education"]),
      startIndex: z.number(),
      endIndex: z.number(),
    })
  ),
});

const COUNSELING_CASES = [
  "예방접종",
  "성장/발달지연",
  "금연상담",
  "음주상담",
  "나쁜소식전하기",
  "자살",
];

function getSectionOrderHint(caseName?: string): string {
  if (!caseName) return "H → P → E";
  if (COUNSELING_CASES.includes(caseName)) return "H → E (신체진찰 없음)";
  if (caseName === "가정폭력") return "H → P → H → E";
  if (caseName === "의식장애") return "P → H → P → E";
  return "H → P → E";
}

export async function POST(req: Request) {
  try {
    const payload = (await req.json()) as ClassifyRequest;
    const { transcript, segments, turnTimestamps, totalDurationSec, caseName } =
      payload;

    if (!transcript) {
      return NextResponse.json(
        { detail: "transcript is required" },
        { status: 400 }
      );
    }

    const lines = transcript
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      return NextResponse.json(
        { detail: "transcript is empty" },
        { status: 400 }
      );
    }

    const numberedTurns = lines
      .map((line, i) => `[${i}] ${line}`)
      .join("\n");

    const openai = await getOpenAIClient();

    const sectionOrderHint = getSectionOrderHint(caseName);
    const isCounseling = caseName
      ? COUNSELING_CASES.includes(caseName)
      : false;

    const systemPrompt = `당신은 한국 의대 CPX(임상수행시험) 전사문 분류기입니다.

이 증례의 예상 섹션 순서: **${sectionOrderHint}**
(H = 병력청취, P = 신체진찰, E = 환자교육)

전사문의 턴(줄) 인덱스를 보고, 연속된 섹션 구간(segment)들의 배열을 반환하세요.
각 segment는 { section, startIndex, endIndex } 형태입니다.
- section: "history" | "physical_exam" | "education"
- startIndex: 해당 섹션 구간의 시작 턴 인덱스
- endIndex: 해당 섹션 구간의 마지막 턴 인덱스

예시 (H→P→E): [{ section: "history", startIndex: 0, endIndex: 15 }, { section: "physical_exam", startIndex: 16, endIndex: 25 }, { section: "education", startIndex: 26, endIndex: 40 }]
예시 (H→P→H→E): [{ section: "history", startIndex: 0, endIndex: 10 }, { section: "physical_exam", startIndex: 11, endIndex: 20 }, { section: "history", startIndex: 21, endIndex: 30 }, { section: "education", startIndex: 31, endIndex: 40 }]

섹션 구분 내용:
- history(병력청취): 주소, 현병력, 과거력, 가족력, 사회력, ROS 등
- physical_exam(신체진찰): 진찰 행위, 검사 설명, 결과 전달
- education(환자교육): 진단 설명, 치료 계획, 생활습관 교육, 추적관찰

섹션 전환에 도움되는 대표 문구:
- 신체진찰 시작: "이제 신체진찰을 좀 해볼텐데요, 시행해도 괜찮을까요?"
- 신체진찰 끝: "신체진찰 마치도록 하겠습니다. 많이 불편하진 않으셨나요?"

규칙:
1. 인사, 자기소개 등 도입부는 병력청취에 포함하세요.
2. 마무리 인사는 환자교육에 포함하세요.
3. segments는 빈틈 없이 모든 턴을 커버해야 합니다 (0부터 ${lines.length - 1}까지).
4. 인접한 segment의 startIndex는 이전 segment의 endIndex + 1이어야 합니다.
${isCounseling ? "5. 이 증례는 상담증례이므로 신체진찰(physical_exam) 섹션이 없습니다. history와 education만 사용하세요." : "5. 예상 섹션 순서를 참고하되, 실제 전사문 내용에 따라 판단하세요."}
6. 인덱스는 0부터 시작하며, 마지막 턴 인덱스는 ${lines.length - 1}입니다.`;

    const resp = await openai.responses.parse({
      model: "gpt-5.1-2025-11-13",
      input: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `다음 전사문의 섹션 segments 배열을 반환하세요:\n\n${numberedTurns}`,
        },
      ],
      text: {
        format: zodTextFormat(SectionSegmentsSchema, "section_segments_schema"),
      },
      max_output_tokens: 8192,
    });

    const parsed = resp.output_parsed;
    if (!parsed) {
      console.error("[classifySections] output_parsed is null. Raw output:", JSON.stringify(resp.output, null, 2));
      return NextResponse.json(
        { detail: "LLM parsing failed" },
        { status: 500 }
      );
    }

    const lastIndex = lines.length - 1;

    // Clamp and validate segment indices
    const clampedSegments = parsed.segments.map((seg) => ({
      section: seg.section,
      startIndex: Math.max(0, Math.min(seg.startIndex, lastIndex)),
      endIndex: Math.max(0, Math.min(seg.endIndex, lastIndex)),
    }));

    // Build sectionTurns from segments (merge turns per section)
    const sectionTurns: Record<SectionLabel, number[]> = {
      history: [],
      physical_exam: [],
      education: [],
    };
    for (const seg of clampedSegments) {
      for (let i = seg.startIndex; i <= seg.endIndex; i++) {
        sectionTurns[seg.section].push(i);
      }
    }

    // Calculate timing based on available data
    const timing: SectionTimingMap = {};
    const hasSegments = segments && segments.length > 0;
    const hasTurnTimestamps = turnTimestamps && turnTimestamps.length > 0;

    if (hasSegments) {
      // SP mode: segment timestamps
      const totalDuration = segments[segments.length - 1].end;

      const getTimestamp = (idx: number): number => {
        const seg = segments[Math.min(idx, segments.length - 1)];
        return seg ? seg.start : 0;
      };
      const getEndTimestamp = (idx: number): number => {
        const seg = segments[Math.min(idx, segments.length - 1)];
        return seg ? seg.end : totalDuration;
      };

      for (const section of ["history", "physical_exam", "education"] as SectionLabel[]) {
        const turnIndices = sectionTurns[section];
        if (turnIndices.length === 0) {
          timing[section] = { durationSec: 0 };
          continue;
        }
        let durationSec = 0;
        // Sum duration across contiguous runs of turn indices
        let runStart = turnIndices[0];
        let runEnd = turnIndices[0];
        for (let i = 1; i < turnIndices.length; i++) {
          if (turnIndices[i] === runEnd + 1) {
            runEnd = turnIndices[i];
          } else {
            durationSec += getEndTimestamp(runEnd) - getTimestamp(runStart);
            runStart = turnIndices[i];
            runEnd = turnIndices[i];
          }
        }
        durationSec += getEndTimestamp(runEnd) - getTimestamp(runStart);
        timing[section] = { durationSec: Math.round(durationSec) };
      }
    } else if (hasTurnTimestamps) {
      // VP mode: client-recorded timestamps
      const totalDuration =
        totalDurationSec ||
        turnTimestamps[turnTimestamps.length - 1].elapsedSec;

      const getElapsed = (idx: number): number => {
        const ts = turnTimestamps[Math.min(idx, turnTimestamps.length - 1)];
        return ts ? ts.elapsedSec : 0;
      };

      for (const section of ["history", "physical_exam", "education"] as SectionLabel[]) {
        const turnIndices = sectionTurns[section];
        if (turnIndices.length === 0) {
          timing[section] = { durationSec: 0 };
          continue;
        }
        let durationSec = 0;
        let runStart = turnIndices[0];
        let runEnd = turnIndices[0];
        for (let i = 1; i < turnIndices.length; i++) {
          if (turnIndices[i] === runEnd + 1) {
            runEnd = turnIndices[i];
          } else {
            // End of a contiguous run
            const endTime =
              runEnd + 1 <= lastIndex
                ? getElapsed(runEnd + 1)
                : totalDuration;
            durationSec += endTime - getElapsed(runStart);
            runStart = turnIndices[i];
            runEnd = turnIndices[i];
          }
        }
        const endTime =
          runEnd + 1 <= lastIndex ? getElapsed(runEnd + 1) : totalDuration;
        durationSec += endTime - getElapsed(runStart);
        timing[section] = { durationSec: Math.round(durationSec) };
      }
    } else if (totalDurationSec && totalDurationSec > 0) {
      // VP fallback: estimate from turn ratios
      const totalTurns = lines.length;
      for (const section of ["history", "physical_exam", "education"] as SectionLabel[]) {
        const count = sectionTurns[section].length;
        const ratio = totalTurns > 0 ? count / totalTurns : 0;
        timing[section] = {
          durationSec: Math.round(ratio * totalDurationSec),
        };
      }
    } else {
      for (const section of ["history", "physical_exam", "education"] as SectionLabel[]) {
        timing[section] = { durationSec: null };
      }
    }

    return NextResponse.json({ timing, sectionTurns });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[classifySections]", msg);
    return NextResponse.json(
      { detail: `classifySections failed: ${msg}` },
      { status: 500 }
    );
  }
}
