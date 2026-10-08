import Link from "next/link";
import { CATALOG, DEMO_CATALOG_NOTICE } from "@trailroom/catalog";
import { copy } from "../../../lib/copy";
import { body, btnLink, caption, h1, h2, page } from "../../../lib/ui";

export default function CreditsPage() {
  return (
    <div className={`${page} max-w-[760px]`}>
      <h1 className={h1}>{copy.credits.title}</h1>
      <p className={`mt-2 ${body}`}>{copy.credits.intro}</p>
      <p className={`mt-1 ${caption}`}>{DEMO_CATALOG_NOTICE}</p>
      <ul className="mt-6 list-none space-y-6 p-0">
        {CATALOG.map((item) => (
          <li key={item.id}>
            <h2 className={h2}>{item.name}</h2>
            <dl className={`mt-2 ${body}`}>
              <div className="flex gap-2">
                <dt className="font-medium text-ink">{copy.credits.author}</dt>
                <dd>{item.credit.author}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="font-medium text-ink">{copy.credits.licence}</dt>
                <dd>{item.credit.licence}</dd>
              </div>
            </dl>
            <p className={`mt-1 break-words ${caption}`}>{item.credit.title}</p>
            <a
              href={item.credit.sourceUrl}
              target="_blank"
              rel="noreferrer"
              aria-label={copy.credits.sourceLink(item.credit.title)}
              className={btnLink}
            >
              {copy.credits.source}
            </a>
          </li>
        ))}
      </ul>
      <div className="mt-6">
        <Link href="/" className={btnLink}>
          {copy.credits.back}
        </Link>
      </div>
    </div>
  );
}
