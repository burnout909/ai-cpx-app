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
}

// GPT returns two boundary indices
const BoundarySchema = z.object({
  historyEndIndex: z.number(),
  physicalExamEndIndex: z.number(),
});

export async function POST(req: Request) {
  try {
    const payload = (await req.json()) as ClassifyRequest;
    const { transcript, segments, turnTimestamps, totalDurationSec } = payload;

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

    const systemPrompt = `당신은 한국 의대 CPX(임상수행시험) 전사문 분류기입니다.
CPX 시험은 보통 **병력청취 → 신체진찰 → 환자교육** 순서로 진행됩니다.

전사문의 턴(줄) 인덱스를 보고, 섹션 경계를 나타내는 **2개의 인덱스**를 반환하세요:
- historyEndIndex: 병력청취의 마지막 턴 인덱스
- physicalExamEndIndex: 신체진찰의 마지막 턴 인덱스

이렇게 하면:
- [0 ~ historyEndIndex] = 병력청취 (주소, 현병력, 과거력, 가족력, 사회력, ROS 등)
- [(historyEndIndex+1) ~ physicalExamEndIndex] = 신체진찰 (진찰 행위, 검사 설명, 결과 전달)
- [(physicalExamEndIndex+1) ~ 끝] = 환자교육 (진단 설명, 치료 계획, 생활습관 교육, 추적관찰)

규칙:
1. 인사, 자기소개 등 도입부는 병력청취에 포함하세요.
2. 마무리 인사는 환자교육에 포함하세요.
3. 신체진찰이 없는 경우 historyEndIndex와 physicalExamEndIndex를 같은 값으로 설정하세요.
4. 환자교육이 없는 경우 physicalExamEndIndex를 마지막 턴 인덱스로 설정하세요.
5. 인덱스는 0부터 시작하며, 마지막 턴 인덱스는 ${lines.length - 1}입니다.`;

    const resp = await openai.responses.parse({
      model: "gpt-4o",
      input: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `다음 전사문의 섹션 경계 인덱스 2개를 반환하세요:\n\n${numberedTurns}`,
        },
      ],
      text: {
        format: zodTextFormat(BoundarySchema, "boundary_schema"),
      },
      max_output_tokens: 256,
    });

    const parsed = resp.output_parsed;
    if (!parsed) {
      return NextResponse.json(
        { detail: "LLM parsing failed" },
        { status: 500 }
      );
    }

    const { historyEndIndex, physicalExamEndIndex } = parsed;
    const lastIndex = lines.length - 1;

    // Clamp indices
    const hEnd = Math.max(0, Math.min(historyEndIndex, lastIndex));
    const pEnd = Math.max(hEnd, Math.min(physicalExamEndIndex, lastIndex));

    // Build sectionTurns for response
    const sectionTurns: Record<SectionLabel, number[]> = {
      history: [],
      physical_exam: [],
      education: [],
    };
    for (let i = 0; i <= lastIndex; i++) {
      if (i <= hEnd) sectionTurns.history.push(i);
      else if (i <= pEnd) sectionTurns.physical_exam.push(i);
      else sectionTurns.education.push(i);
    }

    // Calculate timing based on available data
    const timing: SectionTimingMap = {};
    const hasSegments = segments && segments.length > 0;
    const hasTurnTimestamps = turnTimestamps && turnTimestamps.length > 0;

    if (hasSegments) {
      // SP mode: segment timestamps
      const totalDuration = segments[segments.length - 1].end;

      // Map turn index to segment timestamp
      const getTimestamp = (idx: number): number => {
        const seg = segments[Math.min(idx, segments.length - 1)];
        return seg ? seg.start : 0;
      };
      const getEndTimestamp = (idx: number): number => {
        const seg = segments[Math.min(idx, segments.length - 1)];
        return seg ? seg.end : totalDuration;
      };

      timing.history = {
        durationSec: Math.round(
          hEnd >= 0 ? getEndTimestamp(hEnd) - getTimestamp(0) : 0
        ),
      };
      timing.physical_exam = {
        durationSec: Math.round(
          pEnd > hEnd ? getEndTimestamp(pEnd) - getTimestamp(hEnd + 1) : 0
        ),
      };
      timing.education = {
        durationSec: Math.round(
          lastIndex > pEnd ? totalDuration - getTimestamp(pEnd + 1) : 0
        ),
      };
    } else if (hasTurnTimestamps) {
      // VP mode: client-recorded timestamps
      const totalDuration =
        totalDurationSec ||
        turnTimestamps[turnTimestamps.length - 1].elapsedSec;

      const getElapsed = (idx: number): number => {
        const ts = turnTimestamps[Math.min(idx, turnTimestamps.length - 1)];
        return ts ? ts.elapsedSec : 0;
      };

      timing.history = {
        durationSec: Math.round(
          hEnd >= 0
            ? (hEnd + 1 <= lastIndex
                ? getElapsed(hEnd + 1)
                : totalDuration) - getElapsed(0)
            : 0
        ),
      };
      timing.physical_exam = {
        durationSec: Math.round(
          pEnd > hEnd
            ? (pEnd + 1 <= lastIndex
                ? getElapsed(pEnd + 1)
                : totalDuration) - getElapsed(hEnd + 1)
            : 0
        ),
      };
      timing.education = {
        durationSec: Math.round(
          lastIndex > pEnd
            ? totalDuration - getElapsed(pEnd + 1)
            : 0
        ),
      };
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
