import { loadPublishedCatalog } from "@trailroom/pipeline";
import { notFound } from "next/navigation";
import { getItem } from "@trailroom/catalog";
import { FailureScreen } from "../../../../../components/failure-screen";

export default async function LimitPage({
  params,
}: {
  params: Promise<{ itemId: string }>;
}) {
  const { itemId } = await params;
  await loadPublishedCatalog();
  if (!getItem(itemId)) notFound();
  return <FailureScreen kind="daily_limit" itemId={itemId} />;
}
