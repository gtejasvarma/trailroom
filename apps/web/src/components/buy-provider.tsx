"use client";
// Buy, and did it arrive. The labels are invented, so "Go to <label>" opens an in-app demo page
// (in a new tab) and records the intent; the person is asked once, afterwards, whether it
// arrived. The buy sheet is one place for every Buy button; a guest reaches it after signing in.
import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { getItem } from "@trailroom/catalog";
import { ApiError, api } from "../lib/api";
import { copy } from "../lib/copy";
import { useRenderImage } from "../lib/use-render-image";
import type { PurchaseBody } from "../server/purchases";
import { useMe } from "./me-provider";
import { Button, buttonClass } from "./ui/button";
import { Sheet } from "./ui/sheet";
import { useToast } from "./ui/toast";

const OpenBuy = createContext<(itemId: string) => void>(() => {});
/** Opens the buy sheet for a piece. Signed-in people only: use `useBuy` from a Buy button. */
export const useOpenBuySheet = () => useContext(OpenBuy);

/** After the demo tab opens, ask on return to this tab once this long has passed. */
const RETURN_DELAY_MS = 1200;

function Thumb({ itemId }: { itemId: string }) {
  const { tryOns } = useMe();
  const item = getItem(itemId);
  const mine = tryOns.find((t) => t.itemId === itemId);
  const { url } = useRenderImage(
    mine?.poseSetId ?? null,
    mine ? "front" : null,
    Boolean(mine),
    "tile",
  );
  const photo = item?.photos[0];
  const src = mine ? url : photo ? `/catalog/${photo.file}` : null;
  return (
    <span className="block aspect-[3/4] w-[76px] flex-none overflow-hidden rounded-[10px] bg-surface md:w-[104px]">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={item ? copy.buy.thumbAlt(item.name) : ""}
          className="size-full object-cover"
          style={{ objectPosition: mine ? "50% 30%" : photo?.focus }}
        />
      ) : null}
    </span>
  );
}

export function BuyProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const say = useToast();
  const { loaded, isGuest, tryOns } = useMe();
  const signedIn = loaded && !isGuest;
  const [buyFor, setBuyFor] = useState<string | null>(null);
  const [buyOpen, setBuyOpen] = useState(false);
  const [arrivedFor, setArrivedFor] = useState<string | null>(null);
  const [arrivedOpen, setArrivedOpen] = useState(false);
  const [purchases, setPurchases] = useState<PurchaseBody[] | null>(null);
  const purchasesRef = useRef<PurchaseBody[] | null>(null);
  purchasesRef.current = purchases;
  /** Pieces whose label tab this tab opened, waiting for the person to come back. */
  const awaiting = useRef<Set<string>>(new Set());
  /** Pieces already asked about in this page load, so a dismissed sheet does not return at once. */
  const asked = useRef<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!signedIn) {
      setPurchases(null);
      return;
    }
    let cancelled = false;
    api
      .purchases()
      .then((r) => {
        if (!cancelled) setPurchases(r.purchases);
      })
      .catch(() => {
        if (!cancelled) setPurchases([]);
      });
    return () => {
      cancelled = true;
    };
  }, [signedIn]);

  const openBuy = useCallback((itemId: string) => {
    setBuyFor(itemId);
    setBuyOpen(true);
  }, []);

  const askArrived = useCallback((itemId: string) => {
    asked.current.add(itemId);
    setArrivedFor(itemId);
    setArrivedOpen(true);
  }, []);

  const pendingFor = (itemId: string) =>
    purchasesRef.current?.find((p) => p.itemId === itemId)?.arrived === null;

  // The next time the person is on that piece's result: ask, once.
  const loadedPurchases = purchases !== null;
  useEffect(() => {
    if (!loadedPurchases) return;
    const m = /^\/try-on\/([^/]+)$/.exec(pathname);
    if (!m) return;
    const itemId = tryOns.find((t) => t.jobId === m[1])?.itemId;
    if (itemId && pendingFor(itemId) && !asked.current.has(itemId)) {
      askArrived(itemId);
    }
    // Deliberately not re-run when purchases change: pressing Go to the label must not ask at once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, loadedPurchases, tryOns.length, askArrived]);

  // Or on return to this tab, after a short pause (the prototype's behaviour).
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const back = () => {
      if (document.visibilityState !== "visible" || awaiting.current.size === 0)
        return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        const next = [...awaiting.current][0];
        if (!next) return;
        awaiting.current.delete(next);
        if (pendingFor(next) && !arrivedOpen) askArrived(next);
      }, RETURN_DELAY_MS);
    };
    document.addEventListener("visibilitychange", back);
    window.addEventListener("focus", back);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", back);
      window.removeEventListener("focus", back);
    };
  }, [askArrived, arrivedOpen]);

  const onGo = (itemId: string) => {
    // The link opens the demo page in a new tab; this records the intent beside it.
    awaiting.current.add(itemId);
    setBuyOpen(false);
    void api
      .recordPurchase(itemId)
      .then((r) =>
        setPurchases((prev) => [
          ...(prev ?? []).filter((p) => p.itemId !== itemId),
          r.purchase,
        ]),
      )
      .catch(() => say(copy.toasts.buyFailed));
  };

  const answer = async (itemId: string, arrived: boolean) => {
    setBusy(true);
    try {
      const r = await api.answerArrived(itemId, arrived);
      setPurchases((prev) =>
        (prev ?? []).map((p) => (p.itemId === itemId ? r.purchase : p)),
      );
      if (arrived) say(copy.toasts.markedMine);
    } catch (e) {
      // Answered before (another tab): nothing more to ask.
      if (!(e instanceof ApiError && e.code === "already_answered"))
        say(copy.toasts.buyFailed);
    }
    setBusy(false);
    setArrivedOpen(false);
  };

  const buyItem = buyFor ? getItem(buyFor) : undefined;
  const arrivedItem = arrivedFor ? getItem(arrivedFor) : undefined;
  const value = useMemo(() => openBuy, [openBuy]);
  return (
    <OpenBuy.Provider value={value}>
      {children}
      {buyItem ? (
        <Sheet
          open={buyOpen}
          kicker={copy.buy.kicker(buyItem.label.toUpperCase())}
          title={copy.buy.title(
            buyItem.name,
            copy.item.price(buyItem.priceUsd),
          )}
          onClose={() => setBuyOpen(false)}
        >
          <div className="mt-3.5 mb-4 flex gap-2.5 md:gap-4">
            <Thumb itemId={buyItem.id} />
            <div className="min-w-0 flex-1">
              <p
                className={`text-[14px] leading-5 font-semibold ${
                  buyItem.stock.low ? "text-danger" : "text-ink"
                }`}
              >
                {buyItem.stock.line}
              </p>
              <p className="mt-[3px] text-[14px] leading-5 text-ink-700">
                {copy.buy.line}
              </p>
            </div>
          </div>
          <a
            href={`/demo-checkout/${buyItem.id}`}
            target="_blank"
            rel="noopener"
            data-testid="go-to-label"
            onClick={() => onGo(buyItem.id)}
            className={buttonClass("filled", "lg", "w-full")}
          >
            {copy.buy.go(buyItem.label.toUpperCase())}
          </a>
          <Button
            variant="quiet"
            size="md"
            onClick={() => setBuyOpen(false)}
            className="mt-2.5 w-full !text-ink-600 !no-underline"
          >
            {copy.buy.keep}
          </Button>
        </Sheet>
      ) : null}
      {arrivedItem ? (
        <Sheet
          open={arrivedOpen}
          title={copy.buy.arrivedTitle(arrivedItem.name)}
          onClose={() => setArrivedOpen(false)}
        >
          <div className="mt-3.5 mb-4 flex gap-3">
            <Thumb itemId={arrivedItem.id} />
            <p className="min-w-0 flex-1 text-[14px] leading-5 text-ink-700">
              {copy.buy.arrivedBody}
            </p>
          </div>
          <Button
            size="lg"
            disabled={busy}
            onClick={() => void answer(arrivedItem.id, true)}
            data-testid="arrived-yes"
            className="w-full"
          >
            {copy.buy.yes}
          </Button>
          <Button
            variant="quiet"
            size="md"
            disabled={busy}
            onClick={() => void answer(arrivedItem.id, false)}
            data-testid="arrived-no"
            className="mt-2.5 w-full !text-ink-600 !no-underline"
          >
            {copy.buy.no}
          </Button>
        </Sheet>
      ) : null}
    </OpenBuy.Provider>
  );
}
