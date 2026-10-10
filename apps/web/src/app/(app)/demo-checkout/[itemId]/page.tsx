// Where "Go to <label>" lands. The labels are invented, so there is nothing to buy: this page says
// so plainly and says what the real product would do. It sells nothing and collects nothing.
import Link from "next/link";
import { notFound } from "next/navigation";
import { catalogUrl, getItem } from "@trailroom/catalog";
import { copy } from "../../../../lib/copy";
import { buttonClass } from "../../../../components/ui/button";

export default async function DemoCheckoutPage({
  params,
}: {
  params: Promise<{ itemId: string }>;
}) {
  const { itemId } = await params;
  const item = getItem(itemId);
  if (!item) notFound();
  const photo = item.photos[0]!;
  const label = item.label.toUpperCase();
  return (
    <div className="mx-auto w-full max-w-[560px] px-4 py-8 md:px-8 md:py-14">
      <p
        data-testid="demo-kicker"
        className="mb-1 text-[11px] leading-[15px] font-semibold tracking-[0.08em] text-ink-600 uppercase"
      >
        {copy.demo.kicker(label)}
      </p>
      <h1 className="text-[24px] leading-[30px] font-medium tracking-[-0.02em] text-ink md:text-[30px] md:leading-9">
        {copy.demo.title}
      </h1>
      <div className="mt-5 flex gap-4">
        <span className="block aspect-[3/4] w-[88px] flex-none overflow-hidden rounded-[10px] bg-surface md:w-[104px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={catalogUrl(photo.file)}
            alt={copy.demo.pieceAlt(item.name, item.label)}
            className="size-full object-cover"
            style={{ objectPosition: photo.focus }}
          />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[16px] leading-[22px] font-medium text-ink">
            {copy.buy.title(item.name, copy.item.price(item.priceUsd))}
          </p>
          <p
            data-testid="demo-body"
            className="mt-2 text-[15px] leading-[22px] text-ink-700"
          >
            {copy.demo.body}
          </p>
          <p className="mt-2 text-[15px] leading-[22px] text-ink-700">
            {copy.demo.real(label)}
          </p>
        </div>
      </div>
      <Link
        href={`/item/${item.id}`}
        className={buttonClass("filled", "lg", "mt-6 w-full")}
      >
        {copy.demo.back}
      </Link>
    </div>
  );
}
