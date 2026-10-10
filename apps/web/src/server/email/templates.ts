// The messages: plain text plus simple HTML. Every string is in copy.ts; every link is absolute.
// Nothing here ever carries a rendered image of the person, or a link that shows one without
// signing in: a message names pieces and links to pages that ask for the usual sign-in.
import { copy } from "../../lib/copy";
import type { EmailMessage } from "./transport";

const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );

const usd = (n: number) => copy.item.price(n);

export interface NewsPiece {
  id: string;
  name: string;
  label: string;
  priceUsd: number;
}

export interface PriceChange {
  id: string;
  name: string;
  oldPriceUsd: number;
  newPriceUsd: number;
}

function wrap(
  to: string,
  subject: string,
  intro: string,
  lines: string[],
  cta: { label: string; url: string },
  unsubscribeUrl: string,
): EmailMessage {
  const text = [
    intro,
    "",
    ...lines.map((l) => `- ${l}`),
    "",
    `${cta.label}: ${cta.url}`,
    "",
    copy.email.why,
    `${copy.email.unsubscribe}: ${unsubscribeUrl}`,
    copy.email.footer,
  ].join("\n");
  const html = `<!doctype html><html><body style="margin:0;padding:24px;font-family:Helvetica,Arial,sans-serif;color:black;background:white">
<p style="font-size:16px;line-height:24px;margin:0 0 16px">${esc(intro)}</p>
<ul style="padding-left:20px;margin:0 0 20px;font-size:15px;line-height:24px">${lines
    .map((l) => `<li>${esc(l)}</li>`)
    .join("")}</ul>
<p style="margin:0 0 24px"><a href="${esc(cta.url)}" style="color:black;font-weight:600">${esc(cta.label)}</a></p>
<p style="font-size:12px;line-height:18px;color:dimgray;margin:0">${esc(copy.email.why)} <a href="${esc(unsubscribeUrl)}" style="color:dimgray">${esc(copy.email.unsubscribe)}</a></p>
<p style="font-size:12px;line-height:18px;color:dimgray;margin:8px 0 0">${esc(copy.email.footer)}</p>
</body></html>`;
  // A subject is one line: a line break in it would let text add headers to the message.
  const oneLine = subject.replace(/[\r\n\u2028\u2029]+/g, " ").trim();
  return { to, subject: oneLine, text, html, unsubscribeUrl };
}

/** At most this many pieces are listed; the rest are counted. */
export const NEWS_LISTED = 6;

export function newArrivalsEmail(
  to: string,
  pieces: NewsPiece[],
  origin: string,
  unsubscribeUrl: string,
): EmailMessage {
  const shown = pieces.slice(0, NEWS_LISTED);
  const lines = shown.map((p) =>
    copy.email.pieceLine(p.name, p.label, usd(p.priceUsd)),
  );
  if (pieces.length > shown.length) {
    lines.push(copy.email.newsMore(pieces.length - shown.length));
  }
  return wrap(
    to,
    copy.email.newsSubject(pieces.length, pieces[0]?.label ?? ""),
    copy.email.newsIntro,
    lines,
    { label: copy.email.newsCta, url: `${origin}/` },
    unsubscribeUrl,
  );
}

export function priceChangeEmail(
  to: string,
  changes: PriceChange[],
  origin: string,
  unsubscribeUrl: string,
): EmailMessage {
  return wrap(
    to,
    changes.length === 1
      ? copy.email.priceSubject(changes[0]!.name)
      : copy.email.priceSubjectMany(changes.length),
    copy.email.priceIntro,
    changes.map((c) =>
      copy.email.priceLine(c.name, usd(c.oldPriceUsd), usd(c.newPriceUsd)),
    ),
    { label: copy.email.priceCta, url: `${origin}/lists` },
    unsubscribeUrl,
  );
}
