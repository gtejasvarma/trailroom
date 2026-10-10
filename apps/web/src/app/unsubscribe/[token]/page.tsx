// The public unsubscribe page. Not behind the password gate (see lib/gate-paths.ts); never indexed.
// It looks nothing up: every token, real or not, gets this same page.
import type { Metadata } from "next";
import { UnsubscribeForm } from "../../../components/unsubscribe-form";
import { copy } from "../../../lib/copy";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: copy.brand,
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function UnsubscribeRoute({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <UnsubscribeForm token={token} />;
}
