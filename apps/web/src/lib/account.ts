"use client";
// Account linking: the anonymous Guest Session is upgraded in place with Google, then the server
// is told (POST /api/account/attach) so the guest's records stop expiring. The uid does not
// change, so the renders stay and nothing is re-rendered.
//
// If the Google account already has a Trailroom account, linking is refused by Firebase. We then
// sign into that account instead and say so: the guest's try-on stays with the guest session
// (it is not merged and not deleted by us; the purge clears it later).
import {
  GoogleAuthProvider,
  linkWithPopup,
  signInWithCredential,
  signInWithPopup,
  signOut as firebaseSignOut,
  type AuthError,
} from "firebase/auth";
import { api } from "./api";
import { copy } from "./copy";
import { ensureUser, getFirebaseAuth, peekUser } from "./firebase";

export async function isGuestNow(): Promise<boolean> {
  return (await ensureUser()).isAnonymous;
}

export type SignInResult = "linked" | "existing";

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
 * session became the account. "existing": the Google account already had one, and we signed into
 * it. Throws a plain Error.
 */
export async function continueWithGoogle(): Promise<SignInResult> {
  const auth = getFirebaseAuth();
  // Never creates a guest just to sign in: a visitor with no session signs in directly.
  const current = await peekUser();
  let result: SignInResult = "linked";
  try {
    if (!current) await signInWithPopup(auth, new GoogleAuthProvider());
    else if (current.isAnonymous)
      await linkWithPopup(current, new GoogleAuthProvider());
  } catch (e) {
    const code = (e as AuthError).code;
    if (ALREADY_IN_USE.includes(code)) {
      const credential = GoogleAuthProvider.credentialFromError(e as AuthError);
      if (!credential) throw new Error(copy.account.error);
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
  try {
    await api.attach();
  } catch {
    throw new Error(copy.account.error);
  }
  return result;
}

/** Signs out. The next API call starts a clean guest session. */
export async function signOutNow(): Promise<void> {
  await firebaseSignOut(getFirebaseAuth());
}
