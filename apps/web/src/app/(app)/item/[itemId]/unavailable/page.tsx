import { loadPublishedCatalog } from "@trailroom/pipeline";
import { redirect, notFound } from "next/navigation";
import { getItem, isRenderReady } from "@trailroom/catalog";
import { FailureScreen } from "../../../../../components/failure-screen";

export default async function UnavailablePage({
  params,
}: {
  params: Promise<{ itemId: string }>;
}) {
  const { itemId } = await params;
  await loadPublishedCatalog();
  const item = getItem(itemId);
  if (!item) notFound();
  if (isRenderReady(item)) redirect(`/item/${itemId}`);
  return <FailureScreen kind="not_ready" itemId={itemId} />;
}
