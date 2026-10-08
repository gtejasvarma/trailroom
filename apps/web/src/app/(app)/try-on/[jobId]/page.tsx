import { TryOnScreen } from "../../../../components/try-on-screen";

export default async function TryOnPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  return <TryOnScreen jobId={jobId} />;
}
