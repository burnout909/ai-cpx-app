import ScoreClient from "./ScoreClient";

export default async function Page({
    searchParams,
}: {
    searchParams: Promise<{ s3Key?: string, transcriptS3Key?: string, caseName?: string, studentNumber?: string, origin?: string }>;
}) {
    const { s3Key, caseName, transcriptS3Key, studentNumber, origin } = await searchParams;
    return <ScoreClient s3Key={s3Key || ""} transcriptS3Key={transcriptS3Key || null} caseName={caseName || null} studentNumber={studentNumber || null} origin={origin as "VP" | "SP" || null} />;
}
