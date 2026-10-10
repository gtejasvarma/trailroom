import Link from "next/link";
import { DEMO_CATALOG_NOTICE } from "@trailroom/catalog";
import { catalogFiles } from "@trailroom/catalog/server";
import { loadPublishedCatalog } from "@trailroom/pipeline";
import { copy } from "../../../lib/copy";
import { body, btnLink, caption, h1, page } from "../../../lib/ui";

export default async function CreditsPage() {
  await loadPublishedCatalog();
  return (
    <div className={`${page} max-w-[760px]`}>
      <h1 className={h1}>{copy.credits.title}</h1>
      <p className={`mt-2 ${body}`}>{copy.credits.intro}</p>
      <p className={`mt-1 ${caption}`}>{DEMO_CATALOG_NOTICE}</p>
      <ul
        aria-label={copy.credits.filesLabel}
        className="mt-6 list-none space-y-4 p-0"
      >
        {catalogFiles().map((file) => (
          <li key={file}>
            <p className="break-words text-[14px] leading-5 font-medium text-ink">
              {file}
            </p>
            <p className={caption}>{copy.credits.line}</p>
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
