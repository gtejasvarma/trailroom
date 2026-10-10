import { CompareView } from "../../../components/compare-view";

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string | string[] }>;
}) {
  const { ids } = await searchParams;
  return (
    <CompareView idsRaw={Array.isArray(ids) ? ids.join(",") : (ids ?? "")} />
  );
}
