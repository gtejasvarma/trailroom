import { loadPublishedCatalog } from "@trailroom/pipeline";
import { notFound } from "next/navigation";
import { getItem } from "@trailroom/catalog";
import { ProductView } from "../../../../components/product-view";

export default async function ProductPage({
  params,
}: {
  params: Promise<{ itemId: string }>;
}) {
  const { itemId } = await params;
  await loadPublishedCatalog();
  const item = getItem(itemId);
  if (!item) notFound();
  return <ProductView item={item} />;
}
