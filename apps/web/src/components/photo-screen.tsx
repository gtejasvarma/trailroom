"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { copy } from "../lib/copy";
import { messageOf, paths, startTryOnPath } from "../lib/flow";
import {
  alertStyle,
  body,
  btnPrimary,
  btnSecondary,
  h1,
  page,
} from "../lib/ui";

const ACCEPT = "image/jpeg,image/png,image/webp";
const pickerFocus =
  "focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-accent";

type Phase = "loading" | "ready" | "uploading" | "starting";

/**
 * Photo upload. A routed screen. The file input is not rendered until GET /api/me says consent
 * is on record; without consent this screen redirects to the consent screen instead.
 */
export function PhotoScreen({ itemId }: { itemId: string }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("loading");
  const [hasPhoto, setHasPhoto] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .me()
      .then((me) => {
        if (cancelled) return;
        if (!me.consented) return router.replace(paths.consent(itemId));
        setHasPhoto(me.hasPhoto);
        setPhase("ready");
      })
      .catch((e) => {
        if (cancelled) return;
        setError(messageOf(e));
      });
    return () => {
      cancelled = true;
    };
  }, [itemId, router]);

  useEffect(() => {
    if (!file) return setPreview(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function go() {
    setError(null);
    try {
      router.push(await startTryOnPath(itemId));
    } catch (e) {
      setError(messageOf(e));
      setPhase("ready");
    }
  }

  async function useChosen() {
    if (!file) return;
    setError(null);
    setPhase("uploading");
    try {
      await api.uploadPhoto(file);
    } catch (e) {
      setError(messageOf(e));
      setFile(null);
      setPhase("ready");
      return;
    }
    setHasPhoto(true);
    setFile(null);
    setPhase("starting");
    await go();
  }

  async function useCurrent() {
    setPhase("starting");
    await go();
  }

  const busy = phase === "uploading" || phase === "starting";
  const status =
    phase === "loading"
      ? copy.photo.loading
      : phase === "uploading"
        ? copy.photo.uploading
        : phase === "starting"
          ? copy.photo.starting
          : null;

  const picker = (label: string, className: string) => (
    <label className={`${className} ${pickerFocus} cursor-pointer`}>
      {label}
      <input
        type="file"
        accept={ACCEPT}
        disabled={busy}
        className="sr-only"
        onChange={(e) => {
          setError(null);
          setFile(e.target.files?.[0] ?? null);
          e.target.value = "";
        }}
      />
    </label>
  );

  return (
    <div className={`${page} max-w-[620px]`}>
      <h1 className={h1}>{copy.photo.title}</h1>
      {phase !== "loading" ? (
        <p className={`mt-2 ${body}`}>{copy.photo.guidance}</p>
      ) : null}
      {status ? (
        <p role="status" className={`mt-4 ${body}`}>
          {status}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className={`mt-4 ${alertStyle}`}>
          {error}
        </p>
      ) : null}

      {phase !== "loading" ? (
        <div className="mt-6 flex flex-col gap-4">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt={copy.photo.previewAlt}
              className="max-h-[480px] w-full rounded-lg bg-canvas object-contain"
            />
          ) : null}
          {file ? (
            <>
              <button
                type="button"
                onClick={useChosen}
                disabled={busy}
                className={btnPrimary}
              >
                {copy.photo.use}
              </button>
              {picker(copy.photo.chooseDifferent, btnSecondary)}
            </>
          ) : hasPhoto ? (
            <>
              <p className={body}>{copy.photo.currentBody}</p>
              <button
                type="button"
                onClick={useCurrent}
                disabled={busy}
                className={btnPrimary}
              >
                {copy.photo.useCurrent}
              </button>
              {picker(copy.photo.chooseDifferent, btnSecondary)}
            </>
          ) : (
            picker(copy.photo.choose, btnPrimary)
          )}
        </div>
      ) : null}
    </div>
  );
}
