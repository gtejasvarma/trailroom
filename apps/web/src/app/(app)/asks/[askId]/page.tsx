import { SentScreen } from "../../../../components/sent-screen";

export default async function SentRoute({
  params,
}: {
  params: Promise<{ askId: string }>;
}) {
  return <SentScreen askId={(await params).askId} />;
}
