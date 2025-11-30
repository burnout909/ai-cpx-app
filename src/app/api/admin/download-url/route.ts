import { NextResponse } from 'next/server';
import { generateDownloadUrl } from '../../s3/s3';

const BUCKET = process.env.NEXT_PUBLIC_S3_BUCKET_NAME;

export async function POST(req: Request) {
    try {
        if (!BUCKET) {
            return NextResponse.json({ error: 'S3 bucket is not configured' }, { status: 500 });
        }
        const body = await req.json().catch(() => ({}));
        const key = body.key as string | undefined;
        if (!key) {
            return NextResponse.json({ error: 'key is required' }, { status: 400 });
        }
        const url = await generateDownloadUrl(BUCKET, key);
        return NextResponse.json({ url });
    } catch (err: any) {
        console.error(err);
        return NextResponse.json({ error: err?.message || 'Failed to generate download url' }, { status: 500 });
    }
}
