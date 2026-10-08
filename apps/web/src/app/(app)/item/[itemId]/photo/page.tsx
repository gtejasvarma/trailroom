import { notFound } from "next/navigation";
import { getItem } from "@trailroom/catalog";
import { UploadScreen } from "../../../../../components/upload-screen";

export default async function PhotoPage({
  params,
}: {
  params: Promise<{ itemId: string }>;
}) {
  const { itemId } = await params;
  if (!getItem(itemId)) notFound();
  return <UploadScreen itemId={itemId} />;
}
