"use client";
// Choose or take a photo, check it in the browser, preview it, and upload it. One component for
// every place a photo can be added (phone upload, desktop capture, You). The consent line sits
// directly under the controls; the server repeats every check and records the consent.
import { useEffect, useRef, useState } from "react";
import { api, type UploadedPhoto } from "../lib/api";
import { copy } from "../lib/copy";
import { messageOf } from "../lib/flow";
import { inspectPhoto } from "../lib/photo-client";
import { alertStyle } from "../lib/ui";
import { CameraView } from "./camera-view";
import { ConsentLine } from "./privacy-line";
import { Button } from "./ui/button";

const ACCEPT = "image/jpeg,image/png,image/webp";

type Phase = "idle" | "checking" | "preview" | "uploading";

export function PhotoAdd({
  onAdded,
  busyText,
}: {
  /** Called after the server has stored the photo. May navigate. */
  onAdded: (photo: UploadedPhoto) => Promise<void> | void;
  /** Shown while the caller does what comes after the upload (starting a try-on, say). */
  busyText?: string | null;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [file, setFile] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [camera, setCamera] = useState(false);
  const [over, setOver] = useState(false);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function choose(f: Blob | undefined | null) {
    if (!f) return;
    setError(null);
    setPhase("checking");
    const r = await inspectPhoto(f);
    if (!r.ok) {
      setFile(null);
      setError(r.message);
      setPhase("idle");
      return;
    }
    setFile(f);
    setPhase("preview");
  }

  async function use() {
    if (!file) return;
    setError(null);
    setPhase("uploading");
    let added: UploadedPhoto;
    try {
      added = await api.uploadPhoto(file);
    } catch (e) {
      setError(messageOf(e));
      setFile(null);
      setPhase("idle");
      return;
    }
    try {
      await onAdded(added);
    } catch (e) {
      setError(messageOf(e));
    }
    setFile(null);
    setPhase("idle");
  }

  const busy = phase === "checking" || phase === "uploading";
  const status =
    busyText ??
    (phase === "checking"
      ? copy.photo.checking
      : phase === "uploading"
        ? copy.photo.uploading
        : null);

  const openPicker = () => input.current?.click();
  const hidden = (
    <input
      ref={input}
      type="file"
      accept={ACCEPT}
      disabled={busy}
      tabIndex={-1}
      aria-label={copy.photo.fileInput}
      className="sr-only"
      onChange={(e) => {
        void choose(e.target.files?.[0]);
        e.target.value = "";
      }}
    />
  );

  return (
    <div>
      {hidden}
      {status ? (
        <p role="status" className="mb-3 text-[14px] leading-5 text-ink-700">
          {status}
        </p>
      ) : null}
      {error ? (
        <p
          role="alert"
          data-testid="photo-error"
          className={`mb-3 ${alertStyle}`}
        >
          {error}
        </p>
      ) : null}

      {file && preview ? (
        <div className="flex flex-col gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt={copy.photo.previewAlt}
            data-testid="photo-preview"
            className="mx-auto max-h-[420px] w-full rounded-lg bg-canvas object-contain"
          />
          <Button onClick={use} disabled={busy} size="lg" className="w-full">
            {copy.photo.use}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setFile(null);
              setPhase("idle");
              openPicker();
            }}
            disabled={busy}
            className="w-full"
          >
            {copy.photo.chooseAnother}
          </Button>
        </div>
      ) : (
        <>
          {/* Phone: the system picker is the primary control. */}
          <div className="md:hidden">
            <Button
              variant="outline"
              size="lg"
              onClick={openPicker}
              disabled={busy}
              className="w-full"
            >
              {copy.photo.browse}
            </Button>
          </div>
          {/* Desktop: a drop zone with Browse files. */}
          <div
            role="group"
            aria-label={copy.photo.dropLabel}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(true);
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setOver(false);
              void choose(e.dataTransfer.files?.[0]);
            }}
            className={`hidden min-h-[260px] flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 text-center md:flex ${
              over
                ? "border-accent bg-accent-tint"
                : "border-line bg-surface-alt"
            }`}
          >
            <p className="mb-1.5 text-[17px] leading-6 font-medium text-ink">
              {copy.photo.dropTitle}
            </p>
            <p className="mb-4 max-w-[280px] text-[14px] leading-5 text-ink-700">
              {copy.photo.dropSub}
            </p>
            <Button variant="outline" onClick={openPicker} disabled={busy}>
              {copy.photo.browseFiles}
            </Button>
          </div>
          <div className="mt-2 text-center md:mt-3">
            <Button
              variant="quiet"
              onClick={() => setCamera(true)}
              disabled={busy}
              className="min-h-11"
            >
              {copy.photo.takeOne}
            </Button>
          </div>
        </>
      )}

      <div className="mt-4">
        <ConsentLine />
      </div>

      {camera ? (
        <CameraView
          onClose={() => setCamera(false)}
          onFallback={() => {
            setCamera(false);
            openPicker();
          }}
          onCapture={(f) => {
            setCamera(false);
            void choose(f);
          }}
        />
      ) : null}
    </div>
  );
}
