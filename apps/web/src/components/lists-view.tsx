"use client";
import { copy } from "../lib/copy";
import { Button } from "./ui/button";
import { useToast } from "./ui/toast";

/** Signed-out and empty Lists. Creating a list arrives in a later phase: the control says so. */
export function ListsView() {
  const say = useToast();
  return (
    <div className="rise mx-auto w-full max-w-[760px] px-4 py-4 pb-8 md:px-10 md:py-10">
      <h1 className="mb-3 text-[24px] leading-[30px] font-medium tracking-[-0.02em] text-ink md:text-[32px] md:leading-[38px]">
        {copy.lists.title}
      </h1>
      <div className="mb-3 flex items-baseline justify-end">
        <button
          type="button"
          onClick={() => say(copy.toasts.listsSoon)}
          className="min-h-11 text-[14px] font-semibold text-accent"
        >
          {copy.lists.create}
        </button>
      </div>
      <div className="rounded-lg border border-line p-[18px]">
        <p className="text-[15px] leading-[22px] text-ink-700">
          {copy.lists.intro}
        </p>
        <Button
          size="lg"
          className="mt-4 w-full md:w-auto"
          onClick={() => say(copy.toasts.listsSoon)}
        >
          {copy.lists.create}
        </Button>
      </div>
    </div>
  );
}
