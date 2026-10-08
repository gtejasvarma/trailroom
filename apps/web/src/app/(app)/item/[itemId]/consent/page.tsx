import { notFound } from "next/navigation";
import { getItem } from "@trailroom/catalog";
import { ConsentScreen } from "../../../../../components/consent-screen";

export default async function ConsentPage({
  params,
}: {
  params: Promise<{ itemId: string }>;
}) {
  const { itemId } = await params;
  if (!getItem(itemId)) notFound();
  return <ConsentScreen itemId={itemId} />;
}
