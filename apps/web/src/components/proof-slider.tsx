"use client";
import { useState } from "react";
import {
  PROOF_MODEL_FILE,
  PROOF_ON_PERSON_FILE,
  catalogUrl,
} from "@trailroom/catalog";
import { copy } from "../lib/copy";
import { Chip } from "./ui/chip";
import { ButtonLink } from "./ui/button";

/**
 * Two photographs of the same framing under a draggable divider: the label's model shot, and
 * the same piece rendered on Maya's photo. The control is a real range input, so it works by
 * pointer, touch and keyboard.
 */
export function ProofSlider({ uploadHref }: { uploadHref: string }) {
  const [x, setX] = useState(52);
  const img = "absolute inset-0 size-full object-cover";
  const focus = { objectPosition: "50% 30%" };
  return (
    <section
      data-testid="proof"
      className="rise mx-4 mt-3.5 mb-1 overflow-hidden rounded-lg border border-line md:mx-auto md:mt-10 md:max-w-[560px] md:border-0 md:text-center"
    >
      <div className="proof relative aspect-[4/5] overflow-hidden bg-canvas md:aspect-[3/2] md:rounded-lg md:border md:border-line">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={catalogUrl(PROOF_MODEL_FILE)}
          alt={copy.discover.proofModelAlt}
          className={img}
          style={focus}
        />
        <span
          className="absolute inset-0"
          style={{ clipPath: `inset(0 ${100 - x}% 0 0)` }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={catalogUrl(PROOF_ON_PERSON_FILE)}
            alt={copy.discover.proofOnPersonAlt}
            className={img}
            style={focus}
          />
        </span>
        <span
          aria-hidden="true"
          className="absolute inset-y-0 w-0.5 bg-canvas shadow-4"
          style={{ left: `${x}%` }}
        />
        <span
          aria-hidden="true"
          className="absolute top-1/2 grid size-[38px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-canvas text-[13px] text-ink shadow-4"
          style={{ left: `${x}%` }}
        >
          ↔
        </span>
        <input
          type="range"
          min={2}
          max={98}
          value={x}
          onChange={(e) => setX(Number(e.target.value))}
          aria-label={copy.discover.proofSlider}
          data-testid="proof-range"
          className="proof-range absolute inset-0 m-0 size-full cursor-ew-resize opacity-0"
        />
        <Chip upper className="absolute top-3 left-3">
          {copy.discover.proofOnHer}
        </Chip>
        <span className="absolute top-3 right-3 md:hidden">
          <Chip upper tone="light">
            {copy.discover.proofModel}
          </Chip>
        </span>
        <span className="absolute right-3.5 bottom-3.5 hidden md:block">
          <Chip upper tone="light">
            {copy.discover.proofModelDesktop}
          </Chip>
        </span>
      </div>
      <div className="px-4 pt-3.5 pb-4 md:px-0 md:pt-5 md:pb-0">
        <h2 className="mb-1 text-[19px] leading-[25px] font-semibold tracking-[-0.015em] text-ink md:text-[24px] md:leading-8">
          {copy.discover.proofTitle}
        </h2>
        <p className="mb-3 text-[14px] leading-5 text-ink-700 md:mx-auto md:mb-5 md:max-w-[460px] md:text-[16px] md:leading-6">
          {copy.discover.proofBody}
        </p>
        <ButtonLink
          href={uploadHref}
          size="lg"
          className="w-full md:w-auto md:px-9"
        >
          {copy.discover.upload}
        </ButtonLink>
      </div>
    </section>
  );
}
