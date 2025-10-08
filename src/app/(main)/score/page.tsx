import ScoreClient from "./ScoreClient";

export default async function Page({
    searchParams,
}: {
    searchParams: Promise<{ s3Key?: string }>;
}) {
    const { s3Key } = await searchParams;
    return <ScoreClient s3Key={s3Key || ""} />;
}
