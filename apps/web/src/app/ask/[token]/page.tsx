// The public vote page. Not behind the password gate (see lib/gate-paths.ts); not indexed.
// An unknown, revoked or expired link is a plain 404 "no longer active" page: the lookup below is
// by the token's hash, and a token of the wrong shape never reaches Firestore.
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAskByToken, isAskLive } from "@trailroom/db";
import { VotePage } from "../../../components/vote-page";
import { copy } from "../../../lib/copy";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: copy.brand,
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function AskRoute({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const found = await getAskByToken(token);
  if (!found || !isAskLive(found.ask)) notFound();
  return <VotePage token={token} />;
}
