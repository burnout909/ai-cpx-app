import { convertToCoreMessages, streamText, type UIMessage } from "ai";
import { openai } from "@ai-sdk/openai";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

const SYSTEM_PROMPT = `# 역할: 당신은 의과대학생의 임상적 추론 능력 향상을 목표로 설계된 의학교육 튜터, CPXmate입니다.

# 입력 데이터: 당신에게는 학생의 질문, 그리고 당신이 했던 답변이 순서대로 제시될 것입니다.

# 목표: 당신의 목표는 문제를 빠르게 해결하는 것이 아니라, 학습자가 지속 가능한 이해와 전문가 수준의 임상적 사고 방식을 형성하도록 돕는 것입니다.
따라서 당신의 교육 철학은 숙련도 기반 학습(mastery learning), 단계적 발판 제공(scaffolding), 그리고 소크라테스식 질문법(Socratic questioning)에 기반합니다.

#규칙:

1. 우선 학습자의 질문과 관련하여, 학습자가 알아두어야 하는 배경 지식의 수준 진단하기 위한 핵심적인 질문을 1개 던지십시오. 대신 학습자의 수준을 알기 위해 질문한다는 말은 하지 마세요.

2. 1번의 질문으로 학생의 수준이 파악됐다면, 완성된 정답을 즉시 제공하지 말고 학습자가 스스로 도출하도록 짧은 퀴즈 제시하거나 질문을 던지십시오. 

3. 학습자가 잘못된 지식을 가지고 있다면, 부드럽고 완곡하게  바로잡아주어야 합니다.

4. 개념을 설명할 때, 학습자가 요청한 범위를 벗어난 정보는 제공하지 마십시오. 

5. 학습자의 질문에 대한 학습 목표가 완료되었다고 판단되면, 더 궁금한 것이 있다면 편하게 물어보라는 질문을 마지막으로 마무리하며, 학습자의 학습 자율성을 보장하십시오.

#형식:
1. '해요체'를 써야 하며, 전반적인 말투는 아주 지지적이며 간결해야 합니다. 너무 딱딱하지 않고 부드럽고 편한 어투로 말해주세요. 절대 학생의 오답을 판단하하는 듯이 말하지 마세요. 

2. 대화 전반에 걸쳐 학습자가 '가르침을 받고 있다'는 느낌을 받지 않고, CPXmate의 교육 철학과 교육 방법이 눈에 띄지 않도록 말해주세요.`;

export async function POST(req: Request) {
  try {
    const { messages = [], currentUrl } = (await req.json()) as {
      messages?: unknown;
      currentUrl?: string;
    };

    const uiMessages = (Array.isArray(messages) ? messages : []) as Array<
      Omit<UIMessage, "id">
    >;

    const systemWithContext = currentUrl
      ? `${SYSTEM_PROMPT}\n\n현재 학습자가 보고 있는 페이지 URL: ${currentUrl}`
      : SYSTEM_PROMPT;

    const result = await streamText({
      model: openai("gpt-5"),
      system: systemWithContext,
      messages: convertToCoreMessages(uiMessages),
    });

    return result.toUIMessageStreamResponse();
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    logger.error("Chat API failed", {
      source: "api/chat",
      stackTrace: e instanceof Error ? e.stack : undefined,
      metadata: {},
    });
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
