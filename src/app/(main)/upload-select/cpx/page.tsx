import UploadClient from "./UploadClient";

export default async function Page({
    searchParams,
}: {
    searchParams: Promise<{ category?: string; case?: string }>;
}) {
    const params = await searchParams;
    const category = params.category ?? "";
    const caseName = params.case ?? "";

    return <UploadClient category={category} caseName={caseName} />;
}
