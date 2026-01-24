import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import OpenAI from "openai";
import s3 from "@/lib/s3";
import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { generateDownloadUrl } from "@/app/api/s3/s3";

export const runtime = "nodejs";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const BUCKET = process.env.NEXT_PUBLIC_S3_BUCKET_NAME!;

// Symptom-specific expressions for prompt generation
const SYMPTOM_EXPRESSIONS: Record<string, string> = {
  급성복통: "with a pained expression, holding their abdomen",
  호흡곤란: "breathing heavily with worried expression",
  가슴통증: "with discomfort, hand near chest",
  어지럼: "looking dizzy and unsteady",
  두통: "with a pained expression, pressing temples",
  발열: "looking flushed and unwell",
  기침: "covering mouth while coughing",
  구토: "looking nauseated and pale",
  설사: "looking uncomfortable",
  피로: "appearing exhausted and tired",
};

/**
 * Generate DALL-E prompt based on patient parameters
 */
function generatePrompt(sex: string, age: number, chiefComplaint: string): string {
  const gender = sex === "남성" ? "male" : "female";
  const ageGroup = age < 30 ? "young adult" : age < 50 ? "middle-aged" : "elderly";
  const symptomExpression = SYMPTOM_EXPRESSIONS[chiefComplaint] || "looking unwell";

  return `Upper body portrait photograph of a ${ageGroup} Korean ${gender} outpatient, approximately ${age} years old, wearing casual everyday clothes, ${symptomExpression}, in a clinic consultation room setting, natural lighting, high quality portrait photography style, no text or watermarks`;
}

/**
 * POST: Generate new patient image
 *
 * Body:
 * - scenarioId?: string - Optional scenario to associate with
 * - sex: "남성" | "여성"
 * - age: number
 * - chiefComplaint: string
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { scenarioId, sex, age, chiefComplaint } = body;

    console.log("[patient-image POST] Request:", { scenarioId, sex, age, chiefComplaint });

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

    // Generate prompt
    const prompt = generatePrompt(sex, age, chiefComplaint);

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
    console.log("[patient-image POST] DALL-E response URL:", imageUrl ? "received" : "null");

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
    console.log("[patient-image POST] S3 upload complete:", s3Key);

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

    console.log("[patient-image POST] DB record created:", patientImage.id);

    // If scenarioId provided, update scenario's activeImageId
    if (scenarioId) {
      await prisma.scenario.update({
        where: { id: scenarioId },
        data: { activeImageId: patientImage.id },
      });
      console.log("[patient-image POST] Scenario activeImageId updated");
    }

    // Generate signed URL for immediate display
    const signedUrl = await generateDownloadUrl(BUCKET, s3Key);
    console.log("[patient-image POST] Signed URL generated");

    return NextResponse.json({
      success: true,
      patientImage: {
        ...patientImage,
        url: signedUrl,
      },
    });
  } catch (err) {
    console.error("Patient image generation error:", err);
    const msg = err instanceof Error ? err.message : String(err);
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

    console.log("[patient-image GET] id:", id, "scenarioId:", scenarioId);

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

      console.log("[patient-image GET] scenario:", scenario);

      if (!scenario?.activeImageId) {
        console.log("[patient-image GET] No activeImageId found");
        return NextResponse.json({ patientImage: null });
      }

      const patientImage = await prisma.patientImage.findUnique({
        where: { id: scenario.activeImageId },
      });

      console.log("[patient-image GET] patientImage:", patientImage?.id, patientImage?.s3Key);

      if (!patientImage) {
        return NextResponse.json({ patientImage: null });
      }

      const signedUrl = await generateDownloadUrl(BUCKET, patientImage.s3Key);
      console.log("[patient-image GET] signedUrl generated, length:", signedUrl?.length);

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
      console.warn("S3 delete warning:", s3Err);
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
    return NextResponse.json(
      { error: `삭제 실패: ${msg}` },
      { status: 500 }
    );
  }
}
