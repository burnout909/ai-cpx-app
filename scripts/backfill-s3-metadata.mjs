import "dotenv/config";
import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { PrismaClient, SessionStatus, TranscriptSource, UploadType } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const BUCKET = process.env.NEXT_PUBLIC_S3_BUCKET_NAME;
const REGION = process.env.NEXT_PUBLIC_S3_REGION;
const ACCESS_KEY = process.env.NEXT_PUBLIC_AWS_KEY;
const SECRET_KEY = process.env.NEXT_PUBLIC_AWS_SECRET;

if (!BUCKET || !REGION || !ACCESS_KEY || !SECRET_KEY) {
  console.error("Missing S3 env vars (bucket/region/key/secret).");
  process.exit(1);
}

const databaseUrl =
  process.env.DATABASE_URL?.trim() || process.env.DIRECT_URL?.trim();
if (!databaseUrl) {
  console.error("Missing DATABASE_URL (or DIRECT_URL) for Prisma.");
  process.exit(1);
}

const pool = new Pool({ connectionString: databaseUrl });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
const s3 = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: ACCESS_KEY,
    secretAccessKey: SECRET_KEY,
  },
});

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const skipText = args.includes("--skip-text");
const limitArg = args.find((v) => v.startsWith("--limit="));
const prefixArg = args.find((v) => v.startsWith("--prefix="));
const limit = limitArg ? Number(limitArg.split("=")[1]) : null;
const onlyPrefix = prefixArg ? prefixArg.split("=")[1] : null;

const PREFIXES = [
  { prefix: "SP_audio/", type: "audio", origin: "SP" },
  { prefix: "VP_user_audio/", type: "audio", origin: "VP" },
  { prefix: "SP_script/", type: "transcript", origin: "SP", source: "UPLOAD" },
  { prefix: "VP_script/", type: "transcript", origin: "VP", source: "LIVE" },
  { prefix: "SP_narrative/", type: "feedback", origin: "SP" },
  { prefix: "VP_narrative/", type: "feedback", origin: "VP" },
  { prefix: "SP_structuredScore/", type: "score", origin: "SP" },
  { prefix: "VP_structuredScore/", type: "score", origin: "VP" },
  { prefix: "uploads/", type: "audio", origin: "SP" },
];

const userCache = new Map();
const sessionCache = new Map();

function extractStudentNumber(key, prefix) {
  if (!key.startsWith(prefix)) return null;
  const rest = key.slice(prefix.length);
  const match = rest.match(/^([^/]+?)-/);
  return match?.[1] ?? null;
}

function extractSessionToken(key, prefix) {
  if (!key.startsWith(prefix)) return null;
  const rest = key.slice(prefix.length);
  const match = rest.match(/^[^/]+?-(.+)$/);
  if (!match) return null;
  let token = match[1];
  token = token.replace(/\.(mp3|txt|json)$/i, "");
  token = token.replace(/-part\d+$/i, "");
  return token;
}

function parseTimestampFromToken(token) {
  if (!token) return null;
  let m = token.match(/(\d{4})\.(\d{2})\.(\d{2})-(\d{2}):(\d{2}):(\d{2})/);
  if (m) {
    const [, y, mo, d, hh, mm, ss] = m;
    return new Date(`${y}-${mo}-${d}T${hh}:${mm}:${ss}+09:00`);
  }
  m = token.match(/(\d{4})-(\d{2})-(\d{2})[_T](\d{2})-(\d{2})-(\d{2})/);
  if (m) {
    const [, y, mo, d, hh, mm, ss] = m;
    return new Date(`${y}-${mo}-${d}T${hh}:${mm}:${ss}+09:00`);
  }
  return null;
}

async function streamToString(body) {
  if (!body) return "";
  if (typeof body.transformToString === "function") {
    return body.transformToString("utf-8");
  }
  const chunks = [];
  for await (const chunk of body) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf-8");
}

async function getObjectText(key) {
  const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  return streamToString(res.Body);
}

async function getUserId(studentNumber) {
  if (userCache.has(studentNumber)) return userCache.get(studentNumber);
  const profile = await prisma.profile.findFirst({
    where: { studentNumber },
    select: { id: true },
  });
  const id = profile?.id ?? null;
  userCache.set(studentNumber, id);
  return id;
}

async function getSessionId({ userId, origin, token, fallbackDate }) {
  const cacheKey = `${userId}|${origin}|${token || "none"}`;
  if (sessionCache.has(cacheKey)) return sessionCache.get(cacheKey);

  const startedAt = parseTimestampFromToken(token) || fallbackDate || new Date();

  let session = null;
  if (token) {
    session = await prisma.cpxSession.findFirst({
      where: { userId, origin, startedAt },
    });
  }

  if (!session && !dryRun) {
    session = await prisma.cpxSession.create({
      data: {
        userId,
        origin,
        status: SessionStatus.IN_PROGRESS,
        startedAt,
      },
    });
  }

  const sessionId = session?.id ?? null;
  if (sessionId) sessionCache.set(cacheKey, sessionId);
  return sessionId;
}

function guessContentType(key) {
  if (key.endsWith(".mp3")) return "audio/mpeg";
  if (key.endsWith(".txt")) return "text/plain";
  if (key.endsWith(".json")) return "application/json";
  return null;
}

function computeTotalFromScore(dataJson) {
  if (!dataJson || typeof dataJson !== "object") return null;
  let total = 0;
  let found = false;
  for (const section of Object.values(dataJson)) {
    if (!Array.isArray(section)) continue;
    for (const item of section) {
      if (item && typeof item === "object" && "point" in item) {
        const val = Number(item.point);
        if (Number.isFinite(val)) {
          total += val;
          found = true;
        }
      }
    }
  }
  return found ? total : null;
}

async function upsertUpload({ userId, sessionId, origin, key, size, createdAt }) {
  const existing = await prisma.upload.findFirst({ where: { userId, s3Key: key } });
  const data = {
    userId,
    sessionId: existing?.sessionId ?? sessionId,
    origin,
    type: UploadType.AUDIO,
    s3Key: key,
    fileName: key.split("/").pop() || null,
    contentType: guessContentType(key),
    sizeBytes: size ?? null,
  };

  if (dryRun) return { created: !existing, updated: !!existing, sessionId: data.sessionId };

  if (existing) {
    const updated = await prisma.upload.update({
      where: { id: existing.id },
      data,
    });
    return { created: false, updated: true, sessionId: updated.sessionId };
  }
  const created = await prisma.upload.create({
    data: { ...data, createdAt },
  });
  return { created: true, updated: false, sessionId: created.sessionId };
}

async function upsertTranscript({ userId, sessionId, origin, key, size, createdAt, source, text }) {
  const existing = await prisma.transcript.findFirst({ where: { userId, s3Key: key } });
  const textLength = text != null ? text.length : null;
  const textExcerpt = text ? text.slice(0, 200) : null;
  const data = {
    userId,
    sessionId: existing?.sessionId ?? sessionId,
    origin,
    s3Key: key,
    source,
    sizeBytes: size ?? null,
    textLength,
    textExcerpt,
  };

  if (dryRun) return { created: !existing, updated: !!existing, sessionId: data.sessionId };

  if (existing) {
    const updated = await prisma.transcript.update({
      where: { id: existing.id },
      data,
    });
    return { created: false, updated: true, sessionId: updated.sessionId };
  }
  const created = await prisma.transcript.create({
    data: { ...data, createdAt },
  });
  return { created: true, updated: false, sessionId: created.sessionId };
}

async function upsertFeedback({ userId, sessionId, origin, key, size, createdAt, text }) {
  const existing = await prisma.feedback.findFirst({ where: { userId, s3Key: key } });
  const textLength = text != null ? text.length : null;
  const data = {
    userId,
    sessionId: existing?.sessionId ?? sessionId,
    origin,
    s3Key: key,
    sizeBytes: size ?? null,
    textLength,
  };

  if (dryRun) return { created: !existing, updated: !!existing, sessionId: data.sessionId };

  if (existing) {
    const updated = await prisma.feedback.update({
      where: { id: existing.id },
      data,
    });
    return { created: false, updated: true, sessionId: updated.sessionId };
  }
  const created = await prisma.feedback.create({
    data: { ...data, createdAt },
  });
  return { created: true, updated: false, sessionId: created.sessionId };
}

async function upsertScore({ userId, sessionId, origin, key, size, createdAt, text, dataJson }) {
  const existing = await prisma.score.findFirst({ where: { userId, s3Key: key } });
  const textLength = text != null ? text.length : null;
  const total = computeTotalFromScore(dataJson);
  const data = {
    userId,
    sessionId: existing?.sessionId ?? sessionId,
    origin,
    s3Key: key,
    sizeBytes: size ?? null,
    textLength,
    total,
    dataJson: dataJson ?? undefined,
  };

  if (dryRun) return { created: !existing, updated: !!existing, sessionId: data.sessionId };

  if (existing) {
    const updated = await prisma.score.update({
      where: { id: existing.id },
      data,
    });
    return { created: false, updated: true, sessionId: updated.sessionId };
  }
  const created = await prisma.score.create({
    data: { ...data, createdAt },
  });
  return { created: true, updated: false, sessionId: created.sessionId };
}

async function markSessionCompleted(sessionId, endedAt) {
  if (!sessionId || dryRun) return;
  await prisma.cpxSession.updateMany({
    where: { id: sessionId, status: { not: SessionStatus.COMPLETED } },
    data: {
      status: SessionStatus.COMPLETED,
      endedAt: endedAt || new Date(),
    },
  });
}

async function processPrefix(config) {
  let processed = 0;
  let skippedNoUser = 0;
  let skippedNoStudent = 0;
  let created = 0;
  let updated = 0;

  let token = undefined;
  do {
    const res = await s3.send(
      new ListObjectsV2Command({
        Bucket: BUCKET,
        Prefix: config.prefix,
        ContinuationToken: token,
      })
    );
    const items = res.Contents || [];
    for (const item of items) {
      if (!item.Key) continue;
      if (limit && processed >= limit) break;

      const key = item.Key;
      processed += 1;

      const studentNumber = extractStudentNumber(key, config.prefix);
      if (!studentNumber) {
        skippedNoStudent += 1;
        continue;
      }
      const userId = await getUserId(studentNumber);
      if (!userId) {
        skippedNoUser += 1;
        continue;
      }

      const sessionToken = extractSessionToken(key, config.prefix);
      const fallbackDate = item.LastModified || new Date();
      const sessionId = await getSessionId({
        userId,
        origin: config.origin,
        token: sessionToken,
        fallbackDate,
      });

      const createdAt = parseTimestampFromToken(sessionToken) || fallbackDate;
      const sizeBytes = typeof item.Size === "number" ? item.Size : null;

      let text = null;
      let dataJson = null;
      if (!skipText && (config.type === "transcript" || config.type === "feedback" || config.type === "score")) {
        try {
          text = await getObjectText(key);
          if (config.type === "score") {
            try {
              dataJson = JSON.parse(text);
            } catch {
              dataJson = null;
            }
          }
        } catch (err) {
          console.warn(`[text read failed] ${key}`, err?.message || err);
        }
      }

      let result = null;
      if (config.type === "audio") {
        result = await upsertUpload({
          userId,
          sessionId,
          origin: config.origin,
          key,
          size: sizeBytes,
          createdAt,
        });
      } else if (config.type === "transcript") {
        result = await upsertTranscript({
          userId,
          sessionId,
          origin: config.origin,
          key,
          size: sizeBytes,
          createdAt,
          source:
            config.source === "LIVE"
              ? TranscriptSource.LIVE
              : TranscriptSource.UPLOAD,
          text,
        });
      } else if (config.type === "feedback") {
        result = await upsertFeedback({
          userId,
          sessionId,
          origin: config.origin,
          key,
          size: sizeBytes,
          createdAt,
          text,
        });
        await markSessionCompleted(sessionId, createdAt);
      } else if (config.type === "score") {
        result = await upsertScore({
          userId,
          sessionId,
          origin: config.origin,
          key,
          size: sizeBytes,
          createdAt,
          text,
          dataJson,
        });
        await markSessionCompleted(sessionId, createdAt);
      }

      if (result?.created) created += 1;
      if (result?.updated) updated += 1;
      if (result?.sessionId && sessionToken) {
        const cacheKey = `${userId}|${config.origin}|${sessionToken}`;
        sessionCache.set(cacheKey, result.sessionId);
      }
    }

    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token && (!limit || processed < limit));

  return {
    prefix: config.prefix,
    processed,
    created,
    updated,
    skippedNoStudent,
    skippedNoUser,
  };
}

async function main() {
  const configs = onlyPrefix
    ? PREFIXES.filter((p) => p.prefix === onlyPrefix)
    : PREFIXES;

  if (configs.length === 0) {
    console.error("No matching prefixes to process.");
    process.exit(1);
  }

  const results = [];
  for (const config of configs) {
    console.log(`Processing ${config.prefix}...`);
    const res = await processPrefix(config);
    results.push(res);
  }

  console.log("Done.");
  for (const res of results) {
    console.log(
      `${res.prefix} processed=${res.processed} created=${res.created} updated=${res.updated} skippedNoStudent=${res.skippedNoStudent} skippedNoUser=${res.skippedNoUser}`
    );
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
