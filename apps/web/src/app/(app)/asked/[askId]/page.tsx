import { AskedScreen } from "../../../../components/asked-screen";

export default async function AskedRoute({
  params,
}: {
  params: Promise<{ askId: string }>;
}) {
  return <AskedScreen askId={(await params).askId} />;
}
