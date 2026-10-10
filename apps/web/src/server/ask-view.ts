// What a person holding an ask (by link or by inbox) is shown. Piece names and prices come from the
// catalogue; the asker is only ever a first name. No uid, no voter identity, no token hash.
import { getItem } from "@trailroom/catalog";
import { type AskDoc } from "@trailroom/db";
import { loadPublishedCatalog } from "@trailroom/pipeline";
import { askImageSource } from "./ask-image";

export interface AskPieceView {
  itemId: string;
  name: string;
  label: string;
  priceUsd: number;
  /** True when the image is the asker's AI-generated render (it carries the AI caption). */
  rendered: boolean;
  imageUrl: string;
}

export interface AskView {
  closed: false;
  askerFirstName: string;
  /** The name of the list it came from, as the asker named it. */
  listName: string;
  question: string | null;
  pieces: AskPieceView[];
  /** The piece this viewer voted for. */
  myVote: string | null;
  /** The viewer is the asker (they see the page, but cannot vote on it). */
  isAsker: boolean;
  /** The split so far: only for someone who has voted, and for the asker. */
  counts: Record<string, number> | null;
}

export async function buildAskView(
  ask: AskDoc,
  opts: { imageBase: string; myVote: string | null; isAsker: boolean },
): Promise<AskView> {
  await loadPublishedCatalog();
  const pieces = await Promise.all(
    ask.itemIds.map(async (id): Promise<AskPieceView | null> => {
      const item = getItem(id);
      if (!item) return null;
      return {
        itemId: id,
        name: item.name,
        label: item.label,
        priceUsd: item.priceUsd,
        rendered: (await askImageSource(ask, id)) === "render",
        imageUrl: `${opts.imageBase}/${id}`,
      };
    }),
  );
  return {
    closed: false,
    askerFirstName: ask.askerFirstName,
    listName: ask.listName,
    question: ask.question,
    pieces: pieces.filter((p): p is AskPieceView => p !== null),
    myVote: opts.myVote,
    isAsker: opts.isAsker,
    counts: opts.myVote || opts.isAsker ? ask.counts : null,
  };
}
