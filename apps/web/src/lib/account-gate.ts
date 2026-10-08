"use client";
// Phase C hook. The prototype asks a guest to create an account between the upload and the
// "Your photo is in" screen. That gate is not built yet; until it is, this resolves at once and the
// guest goes straight on. Phase C replaces the body (and may open the account sheet).
export async function accountGateAfterUpload(): Promise<void> {
  return;
}
