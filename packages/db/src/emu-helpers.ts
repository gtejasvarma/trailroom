// Test-only helpers for emulator-backed tests.
import { firestore } from "./app";

export async function clearFirestore(): Promise<void> {
  const db = firestore();
  for (const c of await db.listCollections()) {
    await db.recursiveDelete(c);
  }
}
