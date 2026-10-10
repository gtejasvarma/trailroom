import { loadPublishedCatalog } from "@trailroom/pipeline";
import { notFound } from "next/navigation";
import { getItem } from "@trailroom/catalog";
import { SignupScreen } from "../../../../../components/signup-screen";

export default async function SignupPage({
  params,
}: {
  params: Promise<{ itemId: string }>;
}) {
  const { itemId } = await params;
  await loadPublishedCatalog();
  if (!getItem(itemId)) notFound();
  return <SignupScreen itemId={itemId} />;
}
