import ScoreClient from "./ScoreClient";

export default async function Page({
    searchParams,
}: {
    searchParams: Promise<{ s3Key?: string, s3KeyList?: string, transcriptS3Key?: string, caseName?: string, studentNumber?: string, origin?: string, sessionId?: string, checklistId?: string, timestampsS3Key?: string, scenarioId?: string }>;
}) {
    const { s3Key, s3KeyList, caseName, transcriptS3Key, studentNumber, origin, sessionId, checklistId, timestampsS3Key, scenarioId } = await searchParams;

    let parsedAudioKeys: string[] = [];
    if (s3KeyList) {
        try {
            const arr = JSON.parse(s3KeyList);
            if (Array.isArray(arr)) {
                parsedAudioKeys = arr.filter((v) => typeof v === "string");
            }
        } catch (e) {
            console.error("Failed to parse s3KeyList", e);
        }
    }
    if (parsedAudioKeys.length === 0 && s3Key) {
        parsedAudioKeys = [s3Key];
    }

    const normalizedOrigin = origin === "VP" ? "VP" : "SP";

    return <ScoreClient audioKeys={parsedAudioKeys} transcriptS3Key={transcriptS3Key || null} caseName={caseName || null} studentNumber={studentNumber || null} origin={normalizedOrigin} sessionId={sessionId || null} checklistId={checklistId || null} timestampsS3Key={timestampsS3Key || null} scenarioId={scenarioId || null} />;
}
