"use client";
// Account linking: the anonymous Guest Session is upgraded in place with Google, then the server
// is told (POST /api/account/attach) so the guest's records stop expiring. The uid does not
// change, so the renders stay and nothing is re-rendered.
//
// If the Google account already has a Trailroom account, linking is refused by Firebase. We then
// sign into that account and ask the server to move the guest's photos and finished try-ons into
// it (POST /api/account/merge, which needs both the account's token and the guest's).
import {
  GoogleAuthProvider,
  linkWithPopup,
  signInWithCredential,
  signInWithPopup,
  signOut as firebaseSignOut,
  type AuthError,
} from "firebase/auth";
import { api } from "./api";
import { clearAskLinks } from "./ask-links";
import { copy } from "./copy";
import { ensureUser, getFirebaseAuth, peekUser } from "./firebase";

export async function isGuestNow(): Promise<boolean> {
  return (await ensureUser()).isAnonymous;
}

/** "existing": signed into an existing account and the guest's try-ons moved into it. "unmoved":
 * signed in, but the move failed (nothing was deleted from the guest). */
export type SignInResult = "linked" | "existing" | "unmoved";

const POPUP_CLOSED = [
  "auth/popup-closed-by-user",
  "auth/cancelled-popup-request",
];
const ALREADY_IN_USE = [
  "auth/credential-already-in-use",
  "auth/email-already-in-use",
];

/**
 * Resolves when the person is a real account and the server has attached it. "linked": the guest
 * session became the account. "existing": the Google account already had one; we signed into it
 * and moved the guest's things across. Throws a plain Error.
 */
export async function continueWithGoogle(): Promise<SignInResult> {
  const auth = getFirebaseAuth();
  // Never creates a guest just to sign in: a visitor with no session signs in directly.
  const current = await peekUser();
  let result: SignInResult = "linked";
  let guestToken: string | null = null;
  try {
    if (!current) await signInWithPopup(auth, new GoogleAuthProvider());
    else if (current.isAnonymous)
      await linkWithPopup(current, new GoogleAuthProvider());
  } catch (e) {
    const code = (e as AuthError).code;
    if (ALREADY_IN_USE.includes(code)) {
      const credential = GoogleAuthProvider.credentialFromError(e as AuthError);
      if (!credential) throw new Error(copy.account.error);
      // Taken before the switch: it is the proof, alongside the account's, that both are this person.
      guestToken = current
        ? await current.getIdToken().catch(() => null)
        : null;
      try {
        await signInWithCredential(auth, credential);
      } catch {
        throw new Error(copy.account.error);
      }
      result = "existing";
    } else {
      console.error("sign-in with Google failed:", code);
      throw new Error(
        POPUP_CLOSED.includes(code)
          ? copy.account.popupClosed
          : copy.account.error,
      );
    }
  }
  // A fresh token so the server sees the new sign-in provider rather than "anonymous".
  await auth.currentUser?.getIdToken(true);
  if (result === "existing" && guestToken) {
    try {
      await api.merge(guestToken);
    } catch {
      return "unmoved";
    }
  }
  try {
    await api.attach();
  } catch {
    throw new Error(copy.account.error);
  }
  return result;
}

/** Signs out. The next API call starts a clean guest session. */
export async function signOutNow(): Promise<void> {
  clearAskLinks(); // links made on this browser are the signed-out person's no longer
  await firebaseSignOut(getFirebaseAuth());
}
