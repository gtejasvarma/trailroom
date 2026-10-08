"use client";
// The device camera, in the page. A full-screen layer with the framing outline and a shutter.
// Guidance is static ("Full body in frame, even light, one person"); the only live signal is a
// brightness hint computed from the video frame itself. Every track is stopped on close/unmount.
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { copy } from "../lib/copy";
import { DIM_BELOW, frameBrightness } from "../lib/photo-client";
import { ConsentLine } from "./privacy-line";

type Facing = "user" | "environment";
type State = "starting" | "live" | "denied" | "unavailable";

export function CameraView({
  onCapture,
  onClose,
  onFallback,
}: {
  onCapture: (file: File) => void;
  onClose: () => void;
  /** Camera unavailable: close and open the picker instead. */
  onFallback: () => void;
}) {
  const titleId = useId();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [state, setState] = useState<State>("starting");
  const [facing, setFacing] = useState<Facing>("environment");
  const [canSwitch, setCanSwitch] = useState(false);
  const [dim, setDim] = useState(false);

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setState("unavailable");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: facing,
            width: { ideal: 1080 },
            height: { ideal: 1440 },
          },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        stop();
        streamRef.current = stream;
        const v = videoRef.current;
        if (v) {
          v.srcObject = stream;
          await v.play().catch(() => undefined);
        }
        setState("live");
        const devices = await navigator.mediaDevices.enumerateDevices();
        if (!cancelled) {
          setCanSwitch(
            devices.filter((d) => d.kind === "videoinput").length > 1,
          );
        }
      } catch (e) {
        if (cancelled) return;
        const name = (e as { name?: string }).name;
        setState(
          name === "NotFoundError" || name === "OverconstrainedError"
            ? "unavailable"
            : "denied",
        );
      }
    }
    setState("starting");
    void start();
    return () => {
      cancelled = true;
      stop();
    };
  }, [facing, stop]);

  // The brightness hint: read a tiny copy of the frame twice a second.
  useEffect(() => {
    if (state !== "live") return;
    const id = window.setInterval(() => {
      const v = videoRef.current;
      const b = v ? frameBrightness(v) : null;
      setDim(b !== null && b < DIM_BELOW);
    }, 500);
    return () => window.clearInterval(id);
  }, [state]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function take() {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    const c = document.createElement("canvas");
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext("2d")?.drawImage(v, 0, 0);
    c.toBlob(
      (blob) => {
        if (!blob) return;
        stop();
        onCapture(new File([blob], "camera.jpg", { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.92,
    );
  }

  const failed = state === "denied" || state === "unavailable";
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      data-testid="camera"
      className="fixed inset-0 z-50 flex flex-col bg-ink text-canvas"
    >
      <h2 id={titleId} className="sr-only">
        {copy.camera.title}
      </h2>
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <video
          ref={videoRef}
          playsInline
          muted
          aria-label={copy.camera.videoLabel}
          className="size-full object-cover"
        />
        {state === "live" ? (
          <div
            aria-hidden="true"
            data-testid="camera-frame"
            className="absolute inset-x-14 top-12 bottom-[120px] mx-auto max-w-[420px] rounded-[140px_140px_28px_28px] border-2 border-canvas/75"
          />
        ) : null}
        {state === "starting" ? (
          <p
            role="status"
            className="absolute inset-0 grid place-items-center text-[16px]"
          >
            {copy.camera.starting}
          </p>
        ) : null}
        {failed ? (
          <div className="absolute inset-0 grid place-items-center px-8 text-center">
            <div>
              <p
                role="alert"
                data-testid="camera-error"
                className="mb-4 text-[17px] leading-6"
              >
                {state === "denied"
                  ? copy.camera.denied
                  : copy.camera.unavailable}
              </p>
              <button
                type="button"
                onClick={onFallback}
                className="min-h-12 rounded-full bg-canvas px-6 text-[16px] font-semibold text-ink"
              >
                {copy.camera.fallback}
              </button>
            </div>
          </div>
        ) : null}
        {state === "live" ? (
          <p className="absolute inset-x-0 bottom-[150px] px-8 text-center text-[20px] leading-7 font-medium">
            {dim ? (
              <span data-testid="camera-dim">{copy.camera.dim}</span>
            ) : (
              copy.camera.guidance
            )}
          </p>
        ) : null}
      </div>
      <div className="flex-none bg-ink px-4 pt-4 pb-6 text-center">
        <div className="mx-auto mb-3 max-w-[420px] text-left">
          <ConsentLine tone="dark" />
        </div>
        <div className="mx-auto flex max-w-[420px] gap-2">
          <button
            type="button"
            onClick={take}
            disabled={state !== "live"}
            className="min-h-12 flex-1 rounded-full bg-canvas text-[16px] font-semibold text-ink disabled:opacity-40"
          >
            {copy.camera.take}
          </button>
          {canSwitch ? (
            <button
              type="button"
              onClick={() =>
                setFacing((f) => (f === "user" ? "environment" : "user"))
              }
              className="min-h-12 rounded-full border border-ink-500 px-5 text-[15px] font-medium"
            >
              {copy.camera.switch}
            </button>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-3 min-h-11 px-4 text-[14px] font-medium text-ink-400"
        >
          {copy.camera.cancel}
        </button>
      </div>
    </div>
  );
}
