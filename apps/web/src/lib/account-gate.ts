"use client";
// The prototype asks a guest to create an account between the upload and the "Your photo is in"
// screen. This runs after a guest's photo has been accepted: it rises the account sheet (through
// `open`) and reports that it did, so the caller stays put. A signed-in person goes straight on.
import { isGuestNow } from "./account";

export async function accountGateAfterUpload(
  open: () => void,
): Promise<boolean> {
  if (!(await isGuestNow())) return false;
  open();
  return true;
}
