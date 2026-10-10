import { loadPublishedCatalog } from "@trailroom/pipeline";
import { notFound } from "next/navigation";
import { getLabel } from "@trailroom/catalog";
import { LabelView } from "../../../../components/label-view";

export default async function LabelPage({
  params,
}: {
  params: Promise<{ labelSlug: string }>;
}) {
  const { labelSlug } = await params;
  await loadPublishedCatalog();
  const label = getLabel(labelSlug);
  if (!label) notFound();
  return <LabelView label={label} />;
}
