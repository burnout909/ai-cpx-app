import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import OpenAI from "openai";
import s3 from "@/lib/s3";
import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { generateDownloadUrl } from "@/app/api/s3/s3";

export const runtime = "nodejs";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const BUCKET = process.env.NEXT_PUBLIC_S3_BUCKET_NAME!;

// Scenario data for enriched prompt generation
interface ScenarioContext {
  description?: string;
  diagnosis?: string;
  attitude?: string;
  history?: Record<string, unknown>;
  meta?: {
    chief_complaint?: string;
    vitals?: { bp?: string; hr?: number; rr?: number; bt?: number };
    [key: string]: unknown;
  };
}

/**
 * Extract clinically relevant visual cues from scenario data.
 * These describe observable physical characteristics that DALL-E should render.
 */
function extractVisualCues(scenario: ScenarioContext): string[] {
  const cues: string[] = [];

  // From attitude (e.g., "매우 고통스러워하며 말함")
  if (scenario.attitude) {
    cues.push(`demeanor: ${scenario.attitude}`);
  }

  // From diagnosis — extract body-type and visible condition cues
  const diagnosis = (scenario.diagnosis || "").toLowerCase();
  const description = (scenario.description || "").toLowerCase();
  const combined = `${diagnosis} ${description}`;

  // Body habitus cues
  if (/비만|obesity|obese|과체중|overweight|체중.?증가|weight.?gain|bmi.*(3[0-9]|[4-9][0-9])/.test(combined)) {
    cues.push("visibly overweight or obese body habitus");
  }
  if (/저체중|underweight|마른|emaciated|cachexia|악액질|체중.?감소|weight.?loss/.test(combined)) {
    cues.push("thin and underweight appearance");
  }

  // Skin / complexion cues
  if (/황달|jaundice|icterus/.test(combined)) {
    cues.push("yellowish skin tone suggesting jaundice");
  }
  if (/창백|pallor|anemia|빈혈/.test(combined)) {
    cues.push("pale complexion");
  }
  if (/청색증|cyanosis/.test(combined)) {
    cues.push("bluish discoloration around lips");
  }
  if (/발진|rash|두드러기|urticaria/.test(combined)) {
    cues.push("visible skin rash");
  }
  if (/부종|edema|붓/.test(combined)) {
    cues.push("facial or periorbital swelling");
  }
  if (/발열|fever|열/.test(combined)) {
    cues.push("flushed and sweaty appearance");
  }

  // Respiratory cues
  if (/호흡곤란|dyspnea|tachypnea|숨/.test(combined)) {
    cues.push("labored breathing, slightly leaning forward");
  }

  // Pain cues
  if (/복통|abdominal.?pain|배.?아/.test(combined)) {
    cues.push("grimacing with hand on abdomen");
  }
  if (/가슴.?통|chest.?pain|흉통/.test(combined)) {
    cues.push("hand pressed against chest, uncomfortable expression");
  }
  if (/두통|headache|머리.?아/.test(combined)) {
    cues.push("pressing temples with pained expression");
  }
  if (/어지럼|dizziness|vertigo|현기증/.test(combined)) {
    cues.push("unsteady posture, slightly disoriented look");
  }

  // General distress from vitals
  const vitals = scenario.meta?.vitals;
  if (vitals) {
    if (vitals.bt && vitals.bt >= 38.0) {
      if (!cues.some(c => c.includes("flush") || c.includes("sweat"))) {
        cues.push("flushed and sweaty");
      }
    }
    if (vitals.hr && vitals.hr >= 100) {
      cues.push("visibly anxious or distressed");
    }
  }

  // From history — scan for additional observable cues
  if (scenario.history) {
    const historyStr = JSON.stringify(scenario.history).toLowerCase();
    if (/구토|vomiting|nausea|메스꺼/.test(historyStr) && !cues.some(c => c.includes("nausea"))) {
      cues.push("nauseated expression");
    }
    if (/기침|cough/.test(historyStr) && !cues.some(c => c.includes("cough"))) {
      cues.push("hand near mouth as if coughing");
    }
  }

  return cues;
}

/**
 * Generate DALL-E prompt based on patient parameters and scenario context.
 * Designed to produce realistic, ordinary-looking Korean patient portraits.
 */
function generatePrompt(
  sex: string,
  age: number,
  chiefComplaint: string,
  scenario?: ScenarioContext
): string {
  const gender = sex === "남성" ? "male" : "female";
  const ageGroup =
    age < 30 ? "young adult" : age < 50 ? "middle-aged" : age < 65 ? "older adult" : "elderly";

  // Extract visual cues from scenario if available
  const visualCues = scenario ? extractVisualCues(scenario) : [];

  // Fallback symptom expression if no scenario cues extracted
  if (visualCues.length === 0) {
    visualCues.push("looking unwell and uncomfortable");
  }

  const cueDescription = visualCues.join(", ");

  return [
    `Medical chart ID photo of a ${ageGroup} Korean ${gender} patient, approximately ${age} years old.`,
    `This is NOT a fashion photo. The person is a real hospital patient, plain and unremarkable in appearance.`,
    `Average-looking with common facial features, slightly tired eyes, mild undereye circles.`,
    `Gentle expression but subtly showing discomfort from illness.`,
    `Wearing a faded hospital gown or old plain t-shirt.`,
    `Clinical appearance: ${cueDescription}.`,
    `Flat, even hospital lighting. Plain white or light blue background.`,
    `Single person portrait, slightly washed out colors, not stylized.`,
    `Absolutely NO beautification, NO glamour, NO studio lighting. No text or watermarks.`,
  ].join(" ");
}

/**
 * POST: Generate new patient image
 *
 * Body:
 * - scenarioId?: string - Optional scenario to associate with
 * - sex: "남성" | "여성"
 * - age: number
 * - chiefComplaint: string
 * - scenarioContext?: ScenarioContext - Optional scenario data for enriched prompts
 * - customPrompt?: string - Optional custom prompt (overrides auto-generated prompt)
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { scenarioId, sex, age, chiefComplaint, scenarioContext, customPrompt, action } = body;

    // Preview prompt without generating image
    if (action === "preview-prompt") {
      if (!sex || !age || !chiefComplaint) {
        return NextResponse.json(
          { error: "성별, 나이, 주호소가 필요합니다." },
          { status: 400 }
        );
      }
      const prompt = generatePrompt(sex, age, chiefComplaint, scenarioContext);
      return NextResponse.json({ prompt });
    }

    // Validate required fields
    if (!sex || !age || !chiefComplaint) {
      return NextResponse.json(
        { error: "성별, 나이, 주호소가 필요합니다." },
        { status: 400 }
      );
    }

    if (!["남성", "여성"].includes(sex)) {
      return NextResponse.json(
        { error: "성별은 '남성' 또는 '여성'이어야 합니다." },
        { status: 400 }
      );
    }

    // Use custom prompt if provided, otherwise auto-generate
    const prompt = customPrompt?.trim() || generatePrompt(sex, age, chiefComplaint, scenarioContext);

    // Call DALL-E 3 API
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt,
      n: 1,
      size: "1024x1024",
      quality: "standard",
      response_format: "url",
    });

    const imageUrl = response.data?.[0]?.url;

    if (!imageUrl) {
      return NextResponse.json(
        { error: "이미지 생성에 실패했습니다." },
        { status: 500 }
      );
    }

    // Download image from OpenAI
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      return NextResponse.json(
        { error: "생성된 이미지 다운로드에 실패했습니다." },
        { status: 500 }
      );
    }

    const imageBuffer = await imageResponse.arrayBuffer();
    const sizeBytes = imageBuffer.byteLength;

    // Generate S3 key
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const s3Key = `patient-images/${timestamp}-${chiefComplaint}.png`;

    // Upload to S3
    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: s3Key,
        Body: Buffer.from(imageBuffer),
        ContentType: "image/png",
      })
    );
    // Create PatientImage record
    const patientImage = await prisma.patientImage.create({
      data: {
        scenarioId: scenarioId || null,
        sex,
        age,
        chiefComplaint,
        s3Key,
        prompt,
        model: "dall-e-3",
        sizeBytes,
      },
    });

    // If scenarioId provided, update scenario's activeImageId
    if (scenarioId) {
      await prisma.scenario.update({
        where: { id: scenarioId },
        data: { activeImageId: patientImage.id },
      });
    }

    // Generate signed URL for immediate display
    const signedUrl = await generateDownloadUrl(BUCKET, s3Key);

    return NextResponse.json({
      success: true,
      patientImage: {
        ...patientImage,
        url: signedUrl,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`Patient image generation failed: ${msg}`, {
      source: "api/admin/patient-image POST",
      stackTrace: err instanceof Error ? err.stack : undefined,
      metadata: { method: "POST" },
    });
    return NextResponse.json(
      { error: `이미지 생성 실패: ${msg}` },
      { status: 500 }
    );
  }
}

/**
 * GET: Retrieve patient image
 *
 * Query params:
 * - id: Image ID
 * - scenarioId: Get active image for scenario
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const scenarioId = searchParams.get("scenarioId");

    if (id) {
      // Get specific image
      const patientImage = await prisma.patientImage.findUnique({
        where: { id },
      });

      if (!patientImage) {
        return NextResponse.json(
          { error: "이미지를 찾을 수 없습니다." },
          { status: 404 }
        );
      }

      const signedUrl = await generateDownloadUrl(BUCKET, patientImage.s3Key);

      return NextResponse.json({
        patientImage: {
          ...patientImage,
          url: signedUrl,
        },
      });
    }

    if (scenarioId) {
      // Get scenario's active image
      const scenario = await prisma.scenario.findUnique({
        where: { id: scenarioId },
        select: { activeImageId: true },
      });

      if (!scenario?.activeImageId) {
        return NextResponse.json({ patientImage: null });
      }

      const patientImage = await prisma.patientImage.findUnique({
        where: { id: scenario.activeImageId },
      });

      if (!patientImage) {
        return NextResponse.json({ patientImage: null });
      }

      const signedUrl = await generateDownloadUrl(BUCKET, patientImage.s3Key);

      return NextResponse.json({
        patientImage: {
          ...patientImage,
          url: signedUrl,
        },
      });
    }

    return NextResponse.json(
      { error: "id 또는 scenarioId가 필요합니다." },
      { status: 400 }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const { searchParams } = new URL(req.url);
    logger.error(`Patient image GET failed: ${msg}`, {
      source: "api/admin/patient-image GET",
      stackTrace: err instanceof Error ? err.stack : undefined,
      metadata: { id: searchParams.get("id"), scenarioId: searchParams.get("scenarioId") },
    });
    return NextResponse.json(
      { error: `조회 실패: ${msg}` },
      { status: 500 }
    );
  }
}

/**
 * DELETE: Delete patient image
 *
 * Query params:
 * - id: Image ID to delete
 */
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "id가 필요합니다." },
        { status: 400 }
      );
    }

    const patientImage = await prisma.patientImage.findUnique({
      where: { id },
    });

    if (!patientImage) {
      return NextResponse.json(
        { error: "이미지를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // Delete from S3
    try {
      await s3.send(
        new DeleteObjectCommand({
          Bucket: BUCKET,
          Key: patientImage.s3Key,
        })
      );
    } catch (s3Err) {
      const s3Msg = s3Err instanceof Error ? s3Err.message : String(s3Err);
      logger.warn(`S3 delete warning: ${s3Msg}`, {
        source: "api/admin/patient-image DELETE",
        stackTrace: s3Err instanceof Error ? s3Err.stack : undefined,
        metadata: { id, s3Key: patientImage.s3Key },
      });
    }

    // If this image is active on a scenario, clear the activeImageId
    if (patientImage.scenarioId) {
      const scenario = await prisma.scenario.findUnique({
        where: { id: patientImage.scenarioId },
        select: { activeImageId: true },
      });

      if (scenario?.activeImageId === id) {
        await prisma.scenario.update({
          where: { id: patientImage.scenarioId },
          data: { activeImageId: null },
        });
      }
    }

    // Delete from database
    await prisma.patientImage.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: "이미지가 삭제되었습니다.",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const id = new URL(req.url).searchParams.get("id");
    logger.error(`Patient image DELETE failed: ${msg}`, {
      source: "api/admin/patient-image DELETE",
      stackTrace: err instanceof Error ? err.stack : undefined,
      metadata: { id },
    });
    return NextResponse.json(
      { error: `삭제 실패: ${msg}` },
      { status: 500 }
    );
  }
}
