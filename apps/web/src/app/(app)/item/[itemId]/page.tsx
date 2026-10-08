import Link from "next/link";
import { notFound } from "next/navigation";
import { DEMO_CATALOG_NOTICE, getItem } from "@trailroom/catalog";
import { TryOnButton } from "../../../../components/tryon-button";
import { copy } from "../../../../lib/copy";
import { btnLink, caption, h1, labelStyle, page } from "../../../../lib/ui";

export default async function ProductPage({
  params,
}: {
  params: Promise<{ itemId: string }>;
}) {
  const { itemId } = await params;
  const item = getItem(itemId);
  if (!item) notFound();
  return (
    <div className={`${page} md:grid md:grid-cols-2 md:gap-10`}>
      <div>
        <Link href="/" className={btnLink}>
          {copy.item.back}
        </Link>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.image}
          alt={copy.item.imageAlt(item.name, item.label)}
          width={600}
          height={800}
          className="mt-2 aspect-tryon w-full rounded-lg bg-canvas object-cover"
        />
      </div>
      <div className="mt-6 md:mt-14">
        <p className={labelStyle}>{item.label}</p>
        <h1 className={`mt-1 ${h1}`}>{item.name}</h1>
        <p className="mt-2 mb-6 text-[16px] leading-5 font-medium text-ink tabular-nums">
          {copy.item.price(item.priceUsd)}
        </p>
        <TryOnButton itemId={item.id} name={item.name} />
        <p className={`mt-6 ${caption}`}>{DEMO_CATALOG_NOTICE}</p>
      </div>
    </div>
  );
}
