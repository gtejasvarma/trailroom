"use client";
// You on a phone, Studio from 768px: the same account, laid out as the two prototypes. Header with
// real counts, your try-ons (phone), your photos, who you follow, how photos are handled, and the
// account: sign out, and Delete everything (real and immediate, with its result shown right here;
// no modal). A guest sees their photo row, the invitation to create an account, Details, and
// Delete everything for their guest data. Notification settings and fit are not built, so not shown.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { clearAskLinks } from "../lib/ask-links";
import { api } from "../lib/api";
import { copy } from "../lib/copy";
import { messageOf, paths } from "../lib/flow";
import { useWide } from "../lib/use-wide";
import { alertStyle, body, btnLink } from "../lib/ui";
import { useAccount } from "./account-provider";
import { useMe } from "./me-provider";
import { EmailPrefs } from "./email-prefs";
import { TryOnsGrid } from "./try-ons-view";
import { Button } from "./ui/button";
import {
  FollowingList,
  PrivacyRow,
  SectionLabel,
  YouHeader,
} from "./you-parts";
import { YouPhotos } from "./you-photos";
import type { MeBody } from "../server/me";

type View = "loading" | "ready" | "deleting" | "deleted";

export function YouScreen() {
  const wide = useWide();
  const openAccount = useAccount();
  const { signOut, isGuest: sessionGuest, refresh } = useMe();
  const router = useRouter();
  const [me, setMe] = useState<MeBody | null>(null);
  const [view, setView] = useState<View>("loading");
  const [error, setError] = useState<string | null>(null);
  // After Delete everything the sign-in is gone: do not read /api/me again (that would start a
  // fresh guest session just to show this screen).
  const deleted = useRef(false);

  useEffect(() => {
    if (deleted.current) return;
    let cancelled = false;
    api
      .me()
      .then((m) => {
        if (cancelled) return;
        setMe(m);
        setView((v) => (v === "loading" ? "ready" : v));
      })
      .catch((e) => {
        if (!cancelled) setError(messageOf(e));
      });
    return () => {
      cancelled = true;
    };
  }, [sessionGuest]);

  async function remove() {
    setError(null);
    setView("deleting");
    try {
      await api.deleteEverything();
      deleted.current = true;
      clearAskLinks();
      // The sign-in is gone too: leave it locally, so the next visit starts clean.
      await signOut();
      await refresh();
      setMe((m) =>
        m ? { ...m, photoCount: 0, defaultPhotoId: null, consented: false } : m,
      );
      setView("deleted");
    } catch (e) {
      setError(messageOf(e));
      setView("ready");
    }
  }

  if (wide === null) {
    return (
      <p role="status" className={`${body} px-4 py-6`}>
        {copy.you.loading}
      </p>
    );
  }

  const guest = me?.isGuest ?? true;
  const shell = wide
    ? "mx-auto w-full max-w-[1100px] px-10 py-7"
    : "mx-auto w-full px-4 pt-4 pb-6";

  const gap = wide ? "mb-4" : "mb-5";
  const photos = me ? (
    <div className={view === "deleted" ? "hidden" : gap}>
      {wide ? null : <SectionLabel>{copy.you.photosHeading}</SectionLabel>}
      <YouPhotos
        wide={wide}
        onChange={(n) => setMe((m) => (m ? { ...m, photoCount: n } : m))}
      />
    </div>
  ) : null;

  return (
    <div className={shell} data-testid={wide ? "studio" : "you"}>
      <h1
        className={
          wide
            ? "mb-1 text-[32px] leading-[38px] font-medium tracking-[-0.025em] text-ink"
            : "mb-4 text-[26px] leading-8 font-medium tracking-[-0.02em] text-ink"
        }
      >
        {wide ? copy.you.studioTitle : copy.you.title}
      </h1>
      {wide ? (
        <p className="mb-7 text-[15px] leading-[21px] text-ink-700">
          {copy.you.studioSub}
        </p>
      ) : null}
      {view === "loading" && !error ? (
        <p role="status" className={body}>
          {copy.you.loading}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className={`mb-4 ${alertStyle}`}>
          {error}
        </p>
      ) : null}

      {view === "deleted" ? (
        <div
          role="status"
          data-testid="deleted"
          className="mb-5 rounded-md bg-success-bg px-4 py-4 text-success"
        >
          <p className="text-[17px] leading-6 font-semibold">
            {copy.you.deletedTitle}
          </p>
          <p className="mt-1 text-[14px] leading-5">{copy.you.deletedBody}</p>
        </div>
      ) : null}

      {me && view !== "deleted" ? (
        <>
          {guest ? (
            <div
              data-testid="you-account"
              className="mb-5 rounded-lg border border-line p-4"
            >
              <p className="text-[17px] leading-6 font-semibold text-ink">
                {copy.you.guestHeading}
              </p>
              <p className="mt-1 text-[14px] leading-5 text-ink-700">
                {copy.you.guestBody}
              </p>
              <Button
                size="md"
                onClick={() => openAccount("signin")}
                className="mt-3"
              >
                {copy.you.signIn}
              </Button>
            </div>
          ) : (
            <YouHeader />
          )}

          {!guest && !wide ? (
            <section className="mb-[22px]" aria-labelledby="tryons-heading">
              <SectionLabel id="tryons-heading">
                {copy.you.tryOnsTitle}
              </SectionLabel>
              <TryOnsGrid variant="strip" />
            </section>
          ) : null}

          {photos}

          {!guest ? (
            <section
              className="mb-5"
              aria-labelledby="following-heading"
              data-testid="following"
            >
              {wide ? (
                <h2
                  id="following-heading"
                  className="mb-1 text-[17px] leading-[23px] font-semibold tracking-[-0.01em] text-ink"
                >
                  {copy.you.followingTitle}
                </h2>
              ) : (
                <SectionLabel id="following-heading">
                  {copy.you.followingTitle}
                </SectionLabel>
              )}
              <FollowingList />
            </section>
          ) : null}

          {!guest && me.emailEnabled ? <EmailPrefs /> : null}

          <div className="mb-5">
            <PrivacyRow />
          </div>
        </>
      ) : null}

      {me ? (
        <section
          aria-labelledby="account-heading"
          data-testid="account-actions"
          className="mt-2"
        >
          <SectionLabel id="account-heading">
            {copy.you.accountTitle}
          </SectionLabel>
          <div className="flex flex-wrap items-center gap-3">
            {!guest && view !== "deleted" ? (
              <Button
                variant="outline"
                size="md"
                onClick={() => void signOut().then(() => router.push("/"))}
              >
                {copy.nav.signOut}
              </Button>
            ) : null}
            {view !== "deleted" ? (
              <Button
                variant="outline"
                size="md"
                onClick={() => void remove()}
                disabled={view === "deleting"}
                data-testid="delete-everything"
              >
                {view === "deleting" ? copy.you.deleting : copy.you.deleteAll}
              </Button>
            ) : null}
          </div>
          {view !== "deleted" ? (
            <p className="mt-2 text-[12px] leading-[17px] text-ink-600">
              {copy.you.deleteHint}
            </p>
          ) : null}
        </section>
      ) : null}

      <div className="mt-6">
        <Link href={paths.catalogue} className={btnLink}>
          {copy.you.browse}
        </Link>
      </div>
    </div>
  );
}
