// `tr_hp=1` means "this browser has a photo", so the server can render the home page without the
// hero for a returning visitor and with it for a new one. It holds nothing personal.
export const PHOTO_COOKIE = "tr_hp";

export function setPhotoCookie(has: boolean): void {
  if (typeof document === "undefined") return;
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = has
    ? `${PHOTO_COOKIE}=1; Path=/; Max-Age=31536000; SameSite=Lax${secure}`
    : `${PHOTO_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
}
