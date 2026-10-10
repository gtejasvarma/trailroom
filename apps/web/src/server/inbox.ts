// The Asks tab: asks the signed-in person opened through a link. There is no friend graph; this
// is the only way an ask reaches an inbox. A revoked or expired ask shows as closed and serves
// no images.
import {
  castVote,
  getAskById,
  getInboxAsk,
  isAskLive,
  listInbox,
  markInboxRead,
  setInboxVote,
} from "@trailroom/db";
import { askImage } from "./ask-image";
import { buildAskView, type AskView } from "./ask-view";
import { err, ok, type Result } from "./http";
import type { User } from "./auth";

export interface InboxSummary {
  askId: string;
  askerFirstName: string;
  question: string | null;
  itemIds: string[];
  votedItemId: string | null;
  unread: boolean;
  closed: boolean;
}

const guard = (u: User) => (u.isGuest ? err("account_required") : null);

export async function getInbox(
  user: User,
): Promise<Result<{ asks: InboxSummary[]; unread: number }>> {
  const g = guard(user);
  if (g) return g;
  const entries = await listInbox(user.uid);
  const asks: InboxSummary[] = await Promise.all(
    entries.map(async ({ askId, entry }) => {
      const found = await getAskById(askId);
      const closed = !found || !isAskLive(found.ask);
      return {
        askId,
        askerFirstName: entry.askerFirstName,
        question: entry.question,
        itemIds: entry.itemIds,
        votedItemId: entry.votedItemId,
        unread: entry.unread && !closed,
        closed,
      };
    }),
  );
  return ok({ asks, unread: asks.filter((a) => a.unread).length });
}

export type InboxDetail =
  AskView | { closed: true; askerFirstName: string; question: string | null };

export async function getInboxDetail(
  user: User,
  askId: string,
): Promise<Result<InboxDetail>> {
  const g = guard(user);
  if (g) return g;
  const entry = await getInboxAsk(user.uid, askId);
  if (!entry) return err("not_found");
  const found = await getAskById(askId);
  if (!found || !isAskLive(found.ask))
    return ok({
      closed: true as const,
      askerFirstName: entry.askerFirstName,
      question: entry.question,
    });
  await markInboxRead(user.uid, askId);
  return ok(
    await buildAskView(found.ask, {
      imageBase: `/api/inbox/${askId}/image`,
      myVote: entry.votedItemId,
      isAsker: false,
    }),
  );
}

export async function voteInbox(
  user: User,
  askId: string,
  itemId: unknown,
): Promise<Result<AskView>> {
  const g = guard(user);
  if (g) return g;
  if (typeof itemId !== "string") return err("invalid_request");
  if (!(await getInboxAsk(user.uid, askId))) return err("not_found");
  const found = await getAskById(askId);
  if (!found || found.ask.uid === user.uid)
    return err(found ? "own_ask" : "not_found");
  if (!isAskLive(found.ask)) return err("ask_closed");
  const cast = await castVote(askId, user.uid, user.uid, itemId);
  if (!cast.ok)
    return err(cast.error === "closed" ? "ask_closed" : "invalid_request");
  await setInboxVote(user.uid, askId, itemId);
  return ok(
    await buildAskView(
      { ...found.ask, counts: cast.counts },
      {
        imageBase: `/api/inbox/${askId}/image`,
        myVote: itemId,
        isAsker: false,
      },
    ),
  );
}

export async function getInboxImage(user: User, askId: string, itemId: string) {
  const g = guard(user);
  if (g) return g;
  if (!(await getInboxAsk(user.uid, askId))) return err("not_found");
  const found = await getAskById(askId);
  if (!found || !isAskLive(found.ask)) return err("not_found");
  return askImage(found.ask, itemId);
}
