import LiveCPXClientWrapper from "./LiveCPXClientWrapper";

export default async function Page({
    searchParams,
}: {
    searchParams: Promise<{ category?: string; case?: string; scenarioId?: string }>;
}) {
    const params = await searchParams;
    const category = params.category ?? "";
    const caseName = params.case ?? "";
    const scenarioId = params.scenarioId ?? "";

    return <LiveCPXClientWrapper category={category} caseName={caseName} scenarioId={scenarioId} />;
}
