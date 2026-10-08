import { notFound } from "next/navigation";
import { getItem } from "@trailroom/catalog";
import { PhotoScreen } from "../../../../../components/photo-screen";

export default async function PhotoPage({
  params,
}: {
  params: Promise<{ itemId: string }>;
}) {
  const { itemId } = await params;
  if (!getItem(itemId)) notFound();
  return <PhotoScreen itemId={itemId} />;
}
