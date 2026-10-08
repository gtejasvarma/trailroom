import Link from "next/link";
import { CATALOG, DEMO_CATALOG_NOTICE } from "@trailroom/catalog";
import { ItemCard } from "../../components/item-card";
import { copy } from "../../lib/copy";
import { body, btnLink, caption, h1, page } from "../../lib/ui";

export default function CataloguePage() {
  return (
    <div className={page}>
      <h1 className={h1}>{copy.catalogue.title}</h1>
      <p className={`mt-2 ${body}`}>{copy.catalogue.intro}</p>
      <ul
        aria-label={copy.catalogue.gridLabel}
        className="mt-6 grid list-none grid-cols-2 gap-3 p-0 md:grid-cols-3 md:gap-5 min-[1200px]:grid-cols-4"
      >
        {CATALOG.map((item) => (
          <li key={item.id}>
            <ItemCard item={item} />
          </li>
        ))}
      </ul>
      <p className={`mt-8 ${caption}`}>{DEMO_CATALOG_NOTICE}</p>
      <Link href="/credits" className={btnLink}>
        {copy.catalogue.creditsLink}
      </Link>
    </div>
  );
}
