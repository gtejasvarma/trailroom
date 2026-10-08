"use client";
// Account linking: the anonymous Guest Session is upgraded in place with Google, then the server
// is told (POST /api/account/attach) so the guest's records stop expiring. The uid does not
// change, so the renders stay and nothing is re-rendered.
import {
  GoogleAuthProvider,
  linkWithPopup,
  type AuthError,
} from "firebase/auth";
import { api } from "./api";
import { copy } from "./copy";
import { ensureUser, getFirebaseAuth } from "./firebase";

export async function isGuestNow(): Promise<boolean> {
  return (await ensureUser()).isAnonymous;
}

/** Resolves when the user is a real account and the server has attached it. Throws a plain Error. */
export async function continueWithGoogle(): Promise<void> {
  const user = await ensureUser();
  if (user.isAnonymous) {
    try {
      await linkWithPopup(user, new GoogleAuthProvider());
    } catch (e) {
      const code = (e as AuthError).code;
      console.error("linking with Google failed:", code);
      if (
        code === "auth/popup-closed-by-user" ||
        code === "auth/cancelled-popup-request"
      ) {
        throw new Error(copy.account.popupClosed);
      }
      throw new Error(copy.account.error);
    }
  }
  // A fresh token so the server sees the new sign-in provider rather than "anonymous".
  await getFirebaseAuth().currentUser?.getIdToken(true);
  try {
    await api.attach();
  } catch {
    throw new Error(copy.account.error);
  }
}
