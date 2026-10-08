"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { copy } from "../lib/copy";
import { messageOf, paths } from "../lib/flow";
import { alertStyle, body, btnLink, btnSecondary, h1, page } from "../lib/ui";
import type { MeBody } from "../server/me";

type View = "loading" | "ready" | "deleting" | "deleted";

/** You: whether a photo is stored, and the visible discard (Design rule 3). No confirm modal. */
export function YouScreen() {
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
  }, []);

  async function remove() {
    setError(null);
    setView("deleting");
    try {
      await api.deletePhoto();
      setMe((m) => (m ? { ...m, hasPhoto: false, consented: false } : m));
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
        <p className={`mt-4 ${body}`}>
          {me.isGuest ? copy.you.guest : copy.you.account}
        </p>
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
          <p className={`mt-4 ${body}`} data-testid="photo-state">
            {me.hasPhoto ? copy.you.hasPhoto : copy.you.noPhoto}
          </p>
          {me.hasPhoto ? (
            <button
              type="button"
              onClick={remove}
              disabled={view === "deleting"}
              className={`mt-6 ${btnSecondary}`}
            >
              {view === "deleting" ? copy.you.deleting : copy.you.delete}
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
