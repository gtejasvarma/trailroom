import { ShareScreen } from "../../../../../components/share-screen";

export default async function ShareRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <ShareScreen listId={(await params).id} />;
}
