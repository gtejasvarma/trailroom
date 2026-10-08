import { notFound } from "next/navigation";
import { getItem } from "@trailroom/catalog";
import { LibraryScreen } from "../../../../../components/library-screen";

export default async function PhotosPage({
  params,
}: {
  params: Promise<{ itemId: string }>;
}) {
  const { itemId } = await params;
  if (!getItem(itemId)) notFound();
  return <LibraryScreen itemId={itemId} />;
}
