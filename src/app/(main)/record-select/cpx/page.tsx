import RecordCPXClient from "./RecordCPXClient";

export default async function Page({
    searchParams,
}: {
    searchParams: Promise<{ category?: string; case?: string; checklistId?: string }>;
}) {
    const params = await searchParams;
    const category = params.category ?? "";
    const caseName = params.case ?? "";
    const checklistId = params.checklistId ?? "";

    return <RecordCPXClient category={category} caseName={caseName} checklistId={checklistId} />;
}
