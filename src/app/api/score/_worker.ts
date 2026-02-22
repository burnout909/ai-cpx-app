// src/app/api/score/_worker.ts
// Score job queue worker — processes scoring jobs within a single serverless function

import { Redis } from "@upstash/redis";
import { getOpenAIClient } from "../_lib";
import { collectEvidenceForSection } from "@/lib/pipeline/collectEvidence";
import { classifySectionsCore } from "@/lib/pipeline/classifySections";
import { transcribeFromS3 } from "@/lib/pipeline/transcribe";
import { generateDownloadUrl, generateUploadUrl } from "../s3/s3";
import { loadChecklistByCase } from "@/utils/loadChecklist";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { SessionStatus } from "@prisma/client";
import type { EvidenceModule, EvidenceChecklist } from "@/utils/loadChecklist";
import type { SectionId } from "@/lib/pipeline/collectEvidence";
import type { GradeItem, SectionTimingMap } from "@/types/score";
import type { ClassifySectionsInput } from "@/lib/pipeline/classifySections";
import type { TranscribeSegment } from "@/lib/pipeline/transcribe";

const MAX_CONCURRENT = 10;

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

/* =========================
   Job Types
========================= */
export type PipelineStage =
  | "transcribing"    // 전사 중
  | "loading"         // 체크리스트 로드
  | "collecting"      // 증거 수집 중
  | "grading"         // 점수 계산 중
  | "saving";         // 결과 저장 중

export interface ScoreJob {
  caseName: string;
  origin: "VP" | "SP";
  userId: string;
  audioKeys?: string[];
  transcriptS3Key?: string;
  sessionId?: string;
  checklistId?: string;
  scenarioId?: string;
  timestampsS3Key?: string;
  cachedTranscriptS3Key?: string;
  status: "waiting" | "processing" | "done" | "failed";
  progress?: number;         // 0-100
  stage?: PipelineStage;
  result?: {
    gradesBySection: Record<string, GradeItem[]>;
    timingBySection: SectionTimingMap;
  };
  error?: string;
  createdAt: number;
}

export interface ScoreJobStatus {
  status: "waiting" | "processing" | "done" | "failed";
  position?: number;
  progress?: number;
  stage?: PipelineStage;
  result?: ScoreJob["result"];
  error?: string;
}

/* =========================
   Checklist loading (server-side)
========================= */
async function loadChecklistForJob(job: ScoreJob): Promise<EvidenceModule> {
  if (job.scenarioId) {
    const scenario = await prisma.scenario.findUnique({
      where: { id: job.scenarioId },
      select: { checklistItemsSnapshot: true, checklistIncludedMap: true },
    });
    if (!scenario?.checklistItemsSnapshot) {
      throw new Error("시나리오 체크리스트 스냅샷이 없습니다");
    }
    const raw = scenario.checklistItemsSnapshot as unknown as Record<string, any>;
    const includedMap = (scenario.checklistIncludedMap ?? {}) as Record<string, boolean>;
    const filterItems = <T extends { id: string }>(items: T[] | undefined): T[] => {
      if (!items) return [];
      return items.filter((item) => includedMap[item.id] !== false);
    };
    return {
      HistoryEvidenceChecklist: filterItems(raw.HistoryEvidenceChecklist || raw.history),
      PhysicalexamEvidenceChecklist: filterItems(raw.PhysicalexamEvidenceChecklist || raw.physicalExam),
      EducationEvidenceChecklist: filterItems(raw.EducationEvidenceChecklist || raw.education),
      PpiEvidenceChecklist: filterItems(raw.PpiEvidenceChecklist || raw.ppi),
    };
  }

  if (job.checklistId) {
    const checklist = await prisma.evidenceChecklist.findUnique({
      where: { id: job.checklistId },
    });
    if (!checklist?.checklistJson) throw new Error("체크리스트 데이터가 없습니다");
    return checklist.checklistJson as unknown as EvidenceModule;
  }

  const loaded = await loadChecklistByCase(job.caseName);
  return loaded.evidence;
}

/* =========================
   Main worker
========================= */
export async function processNextJob(): Promise<void> {
  // Worker slot lock: 개별 키에 TTL → 함수 비정상 종료 시 자동 복구
  const workerId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const lockKey = `score:worker:${workerId}`;

  // 현재 활성 worker 수 확인 (score:worker:* 키 개수)
  const keys = await redis.keys("score:worker:*");
  if (keys.length >= MAX_CONCURRENT) {
    return;
  }

  // Lock 획득 (TTL 300초 = maxDuration과 동일)
  await redis.set(lockKey, "1", { ex: 300 });

  const jobId = await redis.rpop<string>("score:queue");
  if (!jobId) {
    await redis.del(lockKey);
    return;
  }

  let job: ScoreJob | null = null;
  try {
    job = await redis.get<ScoreJob>(`score:job:${jobId}`);
    if (!job) {
      await redis.del(lockKey);
      return;
    }

    // Helper to update progress
    async function setProgress(stage: PipelineStage, progress: number) {
      await redis.set(
        `score:job:${jobId}`,
        { ...job!, status: "processing", stage, progress },
        { ex: 600 },
      );
    }

    // Mark as processing
    await setProgress("transcribing", 0);

    const openai = await getOpenAIClient();
    const bucket = process.env.NEXT_PUBLIC_S3_BUCKET_NAME!;

    // 1. Prepare transcript
    let transcript: string;
    let allSegments: TranscribeSegment[] = [];
    let turnTimestamps: Array<{ text: string; elapsedSec: number }> | undefined;
    let sessionDurationSec: number | undefined;

    if (job.origin === "VP" && job.transcriptS3Key) {
      // VP: download transcript from S3
      const url = await generateDownloadUrl(bucket, job.transcriptS3Key);
      const res = await fetch(url);
      if (!res.ok) throw new Error("Transcript 다운로드 실패");
      transcript = await res.text();

      // Load timestamps if available
      if (job.timestampsS3Key) {
        try {
          const tsUrl = await generateDownloadUrl(bucket, job.timestampsS3Key);
          const tsRes = await fetch(tsUrl);
          if (tsRes.ok) {
            const tsData = await tsRes.json();
            turnTimestamps = tsData.turns;
            sessionDurationSec = tsData.sessionDurationSec;
          }
        } catch {
          // timestamps optional
        }
      }
    } else if (job.cachedTranscriptS3Key) {
      // SP with cached transcript
      const url = await generateDownloadUrl(bucket, job.cachedTranscriptS3Key);
      const res = await fetch(url);
      if (!res.ok) throw new Error("Transcript 다운로드 실패");
      transcript = await res.text();
    } else if (job.audioKeys && job.audioKeys.length > 0) {
      // SP: transcribe from audio
      const transcriptParts = await Promise.all(
        job.audioKeys.map((key) => transcribeFromS3(openai, key, bucket))
      );
      transcript = transcriptParts.map((p) => p.text).join("\n");

      let timeOffset = 0;
      for (const part of transcriptParts) {
        for (const seg of part.segments) {
          allSegments.push({
            ...seg,
            id: allSegments.length + 1,
            start: seg.start + timeOffset,
            end: seg.end + timeOffset,
          });
        }
        if (part.segments.length > 0) {
          timeOffset = part.segments[part.segments.length - 1].end + timeOffset;
        }
      }
    } else {
      throw new Error("transcript 또는 audio가 필요합니다");
    }

    // 2. Load checklist
    await setProgress("loading", 20);
    const evidence = await loadChecklistForJob(job);
    const checklistMap = {
      history: evidence.HistoryEvidenceChecklist || [],
      physical_exam: evidence.PhysicalexamEvidenceChecklist || [],
      education: evidence.EducationEvidenceChecklist || [],
      ppi: evidence.PpiEvidenceChecklist || [],
    };
    const sectionIds = Object.keys(checklistMap) as SectionId[];

    // 3. Parallel: collectEvidence x4 + classifySections
    await setProgress("collecting", 30);
    const classifyInput: ClassifySectionsInput = {
      transcript,
      caseName: job.caseName,
    };
    if (allSegments.length > 0) {
      classifyInput.segments = allSegments;
    }
    if (turnTimestamps && turnTimestamps.length > 0) {
      classifyInput.turnTimestamps = turnTimestamps;
      if (sessionDurationSec) classifyInput.totalDurationSec = sessionDurationSec;
    } else if (job.origin === "VP") {
      classifyInput.totalDurationSec = 720;
    }

    const [evidenceResults, classifyResult] = await Promise.all([
      Promise.all(
        sectionIds.map((sectionId) =>
          collectEvidenceForSection(openai, transcript, checklistMap[sectionId], sectionId)
            .then((evidenceList) => ({ sectionId, evidenceList }))
        )
      ),
      classifySectionsCore(openai, classifyInput).catch((err) => {
        logger.warn(`classifySections failed in worker: ${err instanceof Error ? err.message : String(err)}`, {
          source: "score/_worker",
        });
        return null;
      }),
    ]);

    // 4. Grade calculation
    await setProgress("grading", 80);
    const gradesBySection: Record<string, GradeItem[]> = {
      history: [],
      physical_exam: [],
      education: [],
      ppi: [],
    };

    for (const { sectionId, evidenceList } of evidenceResults) {
      const checklist = checklistMap[sectionId];
      gradesBySection[sectionId] = checklist.map((item: EvidenceChecklist) => {
        const ev = evidenceList.find((e) => e.id === item.id);
        const evidenceArr = ev?.evidence ?? [];
        const point = Math.min(evidenceArr.length, 1);
        return {
          id: item.id,
          title: item.title,
          criteria: item.criteria,
          evidence: evidenceArr,
          point,
          max_evidence_count: 1,
        };
      });
    }

    const timingBySection = classifyResult?.timing ?? {};

    const result = { gradesBySection, timingBySection };

    // 5. Save result to KV
    await setProgress("saving", 90);
    await redis.set(
      `score:job:${jobId}`,
      { ...job, status: "done", result } satisfies ScoreJob,
      { ex: 600 },
    );

    // 6. S3 + DB save (retry up to 3 times)
    const uploadPayload = {
      ...gradesBySection,
      ...(Object.keys(timingBySection).length > 0 ? { timingBySection } : {}),
    };

    let dbSaved = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        // S3 upload
        let s3Key: string | undefined;
        if (bucket) {
          const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
          s3Key = `${job.origin}_structuredScore/${timestamp}.json`;
          const uploadUrl = await generateUploadUrl(bucket, s3Key);
          const body = JSON.stringify(uploadPayload, null, 2);
          const uploadRes = await fetch(uploadUrl, {
            method: "PUT",
            headers: { "Content-Type": "application/json; charset=utf-8" },
            body,
          });
          if (!uploadRes.ok) s3Key = undefined;
        }

        const total = Object.values(gradesBySection).reduce(
          (sum, items) => sum + items.reduce((s, g) => s + g.point, 0),
          0,
        );

        // Resolve case
        const caseRecord = job.caseName
          ? await prisma.case.findFirst({ where: { name: job.caseName } })
          : null;

        // Resolve or create session
        let sessionId = job.sessionId ?? null;
        if (sessionId) {
          const existing = await prisma.cpxSession.findFirst({
            where: { id: sessionId, userId: job.userId },
          });
          if (!existing) sessionId = null;
        }
        if (!sessionId) {
          const session = await prisma.cpxSession.create({
            data: {
              userId: job.userId,
              caseId: caseRecord?.id ?? null,
              origin: job.origin,
              status: SessionStatus.IN_PROGRESS,
            },
          });
          sessionId = session.id;
        }

        // Create score record
        await prisma.score.create({
          data: {
            userId: job.userId,
            sessionId,
            origin: job.origin,
            s3Key: s3Key ?? "",
            total,
            dataJson: uploadPayload as any,
            sizeBytes: JSON.stringify(uploadPayload).length,
            textLength: JSON.stringify(gradesBySection).length,
          },
        });

        // Mark session completed
        await prisma.cpxSession.update({
          where: { id: sessionId },
          data: { status: SessionStatus.COMPLETED, endedAt: new Date() },
        });

        dbSaved = true;
        break;
      } catch (saveErr) {
        logger.warn(`Score DB save attempt ${attempt + 1}/3 failed: ${saveErr instanceof Error ? saveErr.message : String(saveErr)}`, {
          source: "score/_worker",
        });
        if (attempt < 2) await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      }
    }

    // DB 저장 실패 시 KV에 결과를 1시간 보관 (복구용)
    if (!dbSaved) {
      logger.error(`Score DB save failed after 3 attempts for job ${jobId}`, {
        source: "score/_worker",
      });
      await redis.set(
        `score:unsaved:${jobId}`,
        { job, result: uploadPayload, failedAt: Date.now() },
        { ex: 3600 },
      );
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(`Score worker job ${jobId} failed: ${msg}`, {
      source: "score/_worker",
      stackTrace: err instanceof Error ? err.stack : undefined,
    });
    if (job) {
      await redis.set(
        `score:job:${jobId}`,
        { ...job, status: "failed", error: msg } satisfies ScoreJob,
        { ex: 600 },
      ).catch(() => {});
    }
  } finally {
    await redis.del(lockKey);
    // Process next waiting job if any
    const queueLen = await redis.llen("score:queue");
    if (queueLen > 0) {
      await processNextJob();
    }
  }
}
