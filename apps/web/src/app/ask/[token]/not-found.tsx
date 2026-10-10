import { Brand } from "../../../components/vote-page";
import { copy } from "../../../lib/copy";

export const metadata = { robots: { index: false, follow: false } };

export default function AskGone() {
  return (
    <main className="mx-auto w-full max-w-[760px] px-4 pt-5 pb-10 md:px-8 md:pt-9">
      <Brand />
      <div className="mt-6" data-testid="closed">
        <h1 className="mb-1 text-[24px] leading-[30px] font-medium tracking-[-0.02em] text-ink md:text-[30px] md:leading-9">
          {copy.vote.closedTitle}
        </h1>
        <p className="text-[15px] leading-[22px] text-ink-700">
          {copy.vote.closedBody}
        </p>
      </div>
    </main>
  );
}
