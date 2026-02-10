import { NextResponse } from 'next/server';
import s3 from '@/lib/s3';
import { GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { prisma } from '@/lib/prisma';

const BUCKET = process.env.NEXT_PUBLIC_S3_BUCKET_NAME;

const S3_SEARCH_PREFIXES = [
    { prefix: 'VP_script/', category: 'script', origin: 'VP' as const },
    { prefix: 'SP_script/', category: 'script', origin: 'SP' as const },
    { prefix: 'VP_narrative/', category: 'narrative', origin: 'VP' as const },
    { prefix: 'SP_narrative/', category: 'narrative', origin: 'SP' as const },
    { prefix: 'VP_structuredScore/', category: 'structured', origin: 'VP' as const },
    { prefix: 'SP_structuredScore/', category: 'structured', origin: 'SP' as const },
    { prefix: 'VP_user_audio/', category: 'audio', origin: 'VP' as const },
    { prefix: 'SP_audio/', category: 'audio', origin: 'SP' as const },
] as const;

async function listS3KeysByStudent(prefix: string, studentNumber: string): Promise<VersionItem[]> {
    const results: VersionItem[] = [];
    let continuationToken: string | undefined;
    do {
        const res = await s3.send(new ListObjectsV2Command({
            Bucket: BUCKET!,
            Prefix: `${prefix}${studentNumber}`,
            ContinuationToken: continuationToken,
        }));
        for (const item of res.Contents || []) {
            if (item.Key) {
                results.push({ key: item.Key, lastModified: item.LastModified?.getTime() || 0 });
            }
        }
        continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
    } while (continuationToken);
    return results.sort((a, b) => b.lastModified - a.lastModified);
}

type StructuredScores = Record<string, any[]>;
type VersionItem = { key: string; lastModified: number };

async function streamToString(body: any) {
    if (!body) return '';
    if (typeof body.transformToString === 'function') {
        return body.transformToString('utf-8');
    }
    const chunks: Buffer[] = [];
    for await (const chunk of body) {
        chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString('utf-8');
}

async function readObjectText(key: string) {
    if (!BUCKET) return '';
    try {
        const res = await s3.send(
            new GetObjectCommand({
                Bucket: BUCKET,
                Key: key,
            })
        );
        return streamToString(res.Body);
    } catch (err) {
        console.warn('[readObjectText failed]', key, err);
        return '';
    }
}

async function loadNarrative(key: string) {
    if (!key) return null;
    const raw = await readObjectText(key);
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch {
        return { content: raw };
    }
}

async function loadStructuredScores(key: string): Promise<StructuredScores | null> {
    if (!key) return null;
    const raw = await readObjectText(key);
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch (err) {
        console.warn('[structuredScore parse failed]', err);
        return null;
    }
}

export async function POST(req: Request) {
    try {
        if (!BUCKET) {
            return NextResponse.json({ error: 'S3 bucket is not configured' }, { status: 500 });
        }
        const body = await req.json().catch(() => ({}));
        const studentNumber = body.studentNumber as string | undefined;
        if (!studentNumber) {
            return NextResponse.json({ error: 'studentNumber is required' }, { status: 400 });
        }

        // 1. studentNumber로 Profile 조회
        const profile = await prisma.profile.findFirst({
            where: { studentNumber },
            select: { id: true },
        });

        // 2. S3에서 학번으로 직접 검색 (항상 수행)
        const s3Searches = S3_SEARCH_PREFIXES.map(async (p) => {
            const items = await listS3KeysByStudent(p.prefix, studentNumber);
            return { ...p, items };
        });

        // DB 조회 (Profile이 있을 때만)
        const dbPromise = profile
            ? Promise.all([
                prisma.transcript.findMany({
                    where: { userId: profile.id },
                    orderBy: { createdAt: 'desc' },
                    select: { s3Key: true, origin: true, createdAt: true },
                }),
                prisma.score.findMany({
                    where: { userId: profile.id },
                    orderBy: { createdAt: 'desc' },
                    select: { s3Key: true, origin: true, createdAt: true },
                }),
                prisma.upload.findMany({
                    where: { userId: profile.id },
                    orderBy: { createdAt: 'desc' },
                    select: { s3Key: true, origin: true, type: true, createdAt: true },
                }),
                prisma.feedback.findMany({
                    where: { userId: profile.id },
                    orderBy: { createdAt: 'desc' },
                    select: { s3Key: true, origin: true, createdAt: true },
                }),
            ])
            : Promise.resolve(null);

        const [s3Results, dbResults] = await Promise.all([Promise.all(s3Searches), dbPromise]);

        // S3 결과 분류
        const s3Map: Record<string, VersionItem[]> = {};
        for (const r of s3Results) {
            s3Map[`${r.origin}_${r.category}`] = r.items;
        }

        // DB 결과 분류
        const dbMap: Record<string, VersionItem[]> = {};
        if (dbResults) {
            const [transcripts, scores, uploads, feedbacks] = dbResults;
            const toVersionItem = (item: { s3Key: string; createdAt: Date }): VersionItem => ({
                key: item.s3Key,
                lastModified: item.createdAt.getTime(),
            });
            dbMap['VP_script'] = transcripts.filter(t => t.origin === 'VP').map(toVersionItem);
            dbMap['SP_script'] = transcripts.filter(t => t.origin === 'SP').map(toVersionItem);
            dbMap['VP_structured'] = scores.filter(s => s.origin === 'VP').map(toVersionItem);
            dbMap['SP_structured'] = scores.filter(s => s.origin === 'SP').map(toVersionItem);
            dbMap['SP_audio'] = uploads.filter(u => u.origin === 'SP' && u.type === 'AUDIO').map(toVersionItem);
            dbMap['VP_narrative'] = feedbacks.filter(f => f.origin === 'VP').map(toVersionItem);
            dbMap['SP_narrative'] = feedbacks.filter(f => f.origin === 'SP').map(toVersionItem);
        }

        // DB + S3 머지 (key 기준 중복 제거, 최신순 정렬)
        const merge = (dbItems: VersionItem[], s3Items: VersionItem[]): VersionItem[] => {
            const seen = new Set(dbItems.map(i => i.key));
            const merged = [...dbItems];
            for (const item of s3Items) {
                if (!seen.has(item.key)) {
                    merged.push(item);
                    seen.add(item.key);
                }
            }
            return merged.sort((a, b) => b.lastModified - a.lastModified);
        };

        const keys = ['VP_script', 'SP_script', 'VP_narrative', 'SP_narrative', 'VP_structured', 'SP_structured', 'SP_audio'] as const;
        const merged: Record<string, VersionItem[]> = {};
        for (const k of keys) {
            merged[k] = merge(dbMap[k] || [], s3Map[k] || []);
        }

        const totalFound = keys.reduce((sum, k) => sum + merged[k].length, 0);
        if (totalFound === 0) {
            return NextResponse.json({ error: 'Student not found' }, { status: 404 });
        }

        const vpScripts = merged['VP_script'];
        const spScripts = merged['SP_script'];
        const vpNarratives = merged['VP_narrative'];
        const spNarratives = merged['SP_narrative'];
        const vpStructureds = merged['VP_structured'];
        const spStructureds = merged['SP_structured'];
        const spAudios = merged['SP_audio'];

        const pickLatestKey = (arr: VersionItem[]) => arr[0]?.key || null;

        const vpScriptKey = pickLatestKey(vpScripts);
        const vpNarrativeKey = pickLatestKey(vpNarratives);
        const vpStructuredKey = pickLatestKey(vpStructureds);

        const spScriptKey = pickLatestKey(spScripts);
        const spNarrativeKey = pickLatestKey(spNarratives);
        const spStructuredKey = pickLatestKey(spStructureds);
        const spAudioKey = pickLatestKey(spAudios);

        // 4. 최신 데이터 로드
        const [vpScriptText, vpNarrative, vpStructured, spScriptText, spNarrative, spStructured] =
            await Promise.all([
                vpScriptKey ? readObjectText(vpScriptKey) : Promise.resolve(null),
                vpNarrativeKey ? loadNarrative(vpNarrativeKey) : Promise.resolve(null),
                vpStructuredKey ? loadStructuredScores(vpStructuredKey) : Promise.resolve(null),
                spScriptKey ? readObjectText(spScriptKey) : Promise.resolve(null),
                spNarrativeKey ? loadNarrative(spNarrativeKey) : Promise.resolve(null),
                spStructuredKey ? loadStructuredScores(spStructuredKey) : Promise.resolve(null),
            ]);

        // 5. 날짜별 그룹화
        const toDateKey = (ts: number) => new Intl.DateTimeFormat('sv-SE', {
            timeZone: 'Asia/Seoul',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        }).format(ts);

        const groupByDate = (versions: VersionItem[]) => {
            const map: Record<string, VersionItem[]> = {};
            versions.forEach((v) => {
                const dateKey = toDateKey(v.lastModified);
                if (!map[dateKey]) map[dateKey] = [];
                map[dateKey].push(v);
            });
            return map;
        };

        return NextResponse.json({
            vp: {
                script: { latestKey: vpScriptKey, latestText: vpScriptText, latest: vpScriptText, versions: vpScripts, byDate: groupByDate(vpScripts) },
                narrative: { latestKey: vpNarrativeKey, latest: vpNarrative, versions: vpNarratives, byDate: groupByDate(vpNarratives) },
                structured: { latestKey: vpStructuredKey, latest: vpStructured, versions: vpStructureds, byDate: groupByDate(vpStructureds) },
            },
            sp: {
                script: { latestKey: spScriptKey, latestText: spScriptText, latest: spScriptText, versions: spScripts, byDate: groupByDate(spScripts) },
                narrative: { latestKey: spNarrativeKey, latest: spNarrative, versions: spNarratives, byDate: groupByDate(spNarratives) },
                structured: { latestKey: spStructuredKey, latest: spStructured, versions: spStructureds, byDate: groupByDate(spStructureds) },
                audio: { latestKey: spAudioKey, versions: spAudios, byDate: groupByDate(spAudios) },
            },
        });
    } catch (err: any) {
        console.error(err);
        return NextResponse.json({ error: err?.message || 'Failed to load student data' }, { status: 500 });
    }
}
