"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { copy } from "../lib/copy";
import { messageOf, paths } from "../lib/flow";
import { alertStyle, body, btnLink, btnSecondary, h1, page } from "../lib/ui";
import { useAccount } from "./account-provider";
import { useMe } from "./me-provider";
import { TryOnsGrid } from "./try-ons-view";
import { YouPhotos } from "./you-photos";
import { Button } from "./ui/button";
import type { MeBody } from "../server/me";

type View = "loading" | "ready" | "deleting" | "deleted";

/** You: whether a photo is stored, and the visible discard (Design rule 3). No confirm modal. */
export function YouScreen() {
  const openAccount = useAccount();
  const { who, signOut, isGuest: sessionGuest } = useMe();
  const router = useRouter();
  const [me, setMe] = useState<MeBody | null>(null);
  const [view, setView] = useState<View>("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .me()
      .then((m) => {
        if (cancelled) return;
        setMe(m);
        setView("ready");
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
      setMe((m) =>
        m ? { ...m, photoCount: 0, defaultPhotoId: null, consented: false } : m,
      );
      setView("deleted");
    } catch (e) {
      setError(messageOf(e));
      setView("ready");
    }
  }

  return (
    <div className={`${page} max-w-[620px]`}>
      <h1 className={h1}>{copy.you.title}</h1>
      {view === "loading" && !error ? (
        <p role="status" className={`mt-4 ${body}`}>
          {copy.you.loading}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className={`mt-4 ${alertStyle}`}>
          {error}
        </p>
      ) : null}
      {me ? (
        <div className="mt-4" data-testid="you-account">
          <p className={body}>
            {me.isGuest
              ? copy.you.guest
              : copy.you.signedInAs(who?.name || copy.you.account)}
          </p>
          {me.isGuest ? (
            <p className={`mt-1 ${body}`}>{copy.you.signInLine}</p>
          ) : null}
          <div className="mt-3">
            {me.isGuest ? (
              <Button size="md" onClick={() => openAccount("signin")}>
                {copy.you.signIn}
              </Button>
            ) : (
              <Button
                variant="outline"
                size="md"
                onClick={() => void signOut().then(() => router.push("/"))}
              >
                {copy.nav.signOut}
              </Button>
            )}
          </div>
        </div>
      ) : null}
      {me ? (
        <section className="mt-8" aria-labelledby="tryons-heading">
          <h2
            id="tryons-heading"
            className="mb-3 text-[20px] leading-[26px] font-medium tracking-[-0.01em] text-ink"
          >
            {copy.you.tryOnsTitle}
          </h2>
          <TryOnsGrid />
        </section>
      ) : null}
      {view === "deleted" ? (
        <div
          role="status"
          data-testid="deleted"
          className="mt-4 rounded-md bg-success-bg px-4 py-4 text-success"
        >
          <p className="text-[17px] leading-6 font-semibold">
            {copy.you.deletedTitle}
          </p>
          <p className="mt-1 text-[14px] leading-5">{copy.you.deletedBody}</p>
        </div>
      ) : null}
      {me && view !== "deleted" ? (
        <>
          <YouPhotos
            onChange={(n) => setMe((m) => (m ? { ...m, photoCount: n } : m))}
          />
          {me.photoCount > 0 ? (
            <button
              type="button"
              onClick={remove}
              disabled={view === "deleting"}
              className={`mt-6 ${btnSecondary}`}
            >
              {view === "deleting" ? copy.you.deleting : copy.you.deleteAll}
            </button>
          ) : null}
        </>
      ) : null}
      <div className="mt-6">
        <Link href={paths.catalogue} className={btnLink}>
          {copy.you.browse}
        </Link>
      </div>
    </div>
  );
}
