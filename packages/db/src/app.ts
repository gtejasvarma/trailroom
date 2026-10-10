// The one lazy initialiser. Emulators are picked up by the Admin SDK from FIRESTORE_EMULATOR_HOST /
// FIREBASE_STORAGE_EMULATOR_HOST (set by `firebase emulators:exec`); in production it uses
// application default credentials.
//
// Env: GOOGLE_CLOUD_PROJECT | GCLOUD_PROJECT, else FIREBASE_CONFIG.projectId (App Hosting), else
// "demo-trailroom" ONLY when an emulator host is set. STORAGE_BUCKET, else
// FIREBASE_CONFIG.storageBucket, else "<project>.appspot.com" (the emulator bucket).
import { getApps, initializeApp, type App } from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getStorage } from "firebase-admin/storage";
import type { Bucket } from "@google-cloud/storage";

const APP_NAME = "trailroom-db";

function usingEmulator(): boolean {
  return Boolean(
    process.env.FIRESTORE_EMULATOR_HOST ||
    process.env.FIREBASE_STORAGE_EMULATOR_HOST,
  );
}

type Env = Record<string, string | undefined>;

/** FIREBASE_CONFIG is what Firebase App Hosting sets at runtime: JSON with projectId and storageBucket. */
function firebaseConfig(env: Env): {
  projectId?: string;
  storageBucket?: string;
} {
  if (!env.FIREBASE_CONFIG) return {};
  try {
    const parsed: unknown = JSON.parse(env.FIREBASE_CONFIG);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

// A placeholder from apphosting.yaml that nobody filled in must stop the app, not name a bucket.
function real(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (value.includes("REPLACE")) {
    throw new Error(`config value "${value}" is still a placeholder`);
  }
  return value;
}

/**
 * Cloud Run does not set GOOGLE_CLOUD_PROJECT, so on App Hosting the project comes from
 * FIREBASE_CONFIG. The explicit variables win so local tools and tests can point elsewhere.
 */
export function projectId(env: Env = process.env): string {
  const id =
    env.GOOGLE_CLOUD_PROJECT ||
    env.GCLOUD_PROJECT ||
    firebaseConfig(env).projectId;
  if (id) return id;
  if (usingEmulator()) return "demo-trailroom";
  throw new Error(
    "no project id: set GOOGLE_CLOUD_PROJECT (App Hosting provides it in FIREBASE_CONFIG)",
  );
}

export function bucketName(env: Env = process.env): string {
  return (
    real(env.STORAGE_BUCKET) ||
    firebaseConfig(env).storageBucket ||
    `${projectId(env)}.appspot.com`
  );
}

export function getApp(): App {
  const existing = getApps().find((a) => a.name === APP_NAME);
  if (existing) return existing;
  return initializeApp(
    { projectId: projectId(), storageBucket: bucketName() },
    APP_NAME,
  );
}

let fs: Firestore | undefined;
export function firestore(): Firestore {
  if (!fs) {
    fs = getFirestore(getApp());
    try {
      fs.settings({ ignoreUndefinedProperties: true });
    } catch {
      // The Firestore instance is shared per app, and a server component and a route handler can
      // load this module twice (separate bundles): the second settings() call is refused, and the
      // first one already set it.
    }
  }
  return fs;
}

export function bucket(): Bucket {
  return getStorage(getApp()).bucket(bucketName());
}

/** Admin Auth, on the same app (honours FIREBASE_AUTH_EMULATOR_HOST). */
export function auth(): Auth {
  return getAuth(getApp());
}
