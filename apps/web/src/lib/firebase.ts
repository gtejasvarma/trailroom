"use client";
// Client-only Firebase: Auth (anonymous sign-in on first need is the Guest Session) and one
// Firestore listener. Config, in order:
//   1. NEXT_PUBLIC_USE_EMULATORS=1  -> placeholder config for demo-trailroom + local emulators.
//   2. NEXT_PUBLIC_FIREBASE_API_KEY (+ _AUTH_DOMAIN, _PROJECT_ID, _APP_ID) -> explicit config.
//   3. Otherwise initializeApp() with no arguments: Firebase App Hosting injects
//      FIREBASE_WEBAPP_CONFIG and the firebase package's postinstall script picks it up
//      (https://firebase.google.com/docs/app-hosting/firebase-sdks).
import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  connectAuthEmulator,
  getAuth,
  signInAnonymously,
  type Auth,
  type User,
} from "firebase/auth";
import {
  connectFirestoreEmulator,
  getFirestore,
  type Firestore,
} from "firebase/firestore";

const useEmulators = process.env.NEXT_PUBLIC_USE_EMULATORS === "1";

let app: FirebaseApp | undefined;
let authWired = false;
let dbWired = false;

function getFirebaseApp(): FirebaseApp {
  if (app) return app;
  const existing = getApps()[0];
  if (existing) return (app = existing);
  if (useEmulators) {
    app = initializeApp({
      apiKey: "demo-key",
      authDomain: "demo-trailroom.firebaseapp.com",
      projectId: "demo-trailroom",
    });
  } else if (process.env.NEXT_PUBLIC_FIREBASE_API_KEY) {
    app = initializeApp({
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    });
  } else {
    app = initializeApp();
  }
  return app;
}

export function getFirebaseAuth(): Auth {
  const auth = getAuth(getFirebaseApp());
  if (useEmulators && !authWired) {
    authWired = true;
    connectAuthEmulator(auth, "http://localhost:9099", {
      disableWarnings: true,
    });
  }
  return auth;
}

export function getFirebaseDb(): Firestore {
  const db = getFirestore(getFirebaseApp());
  if (useEmulators && !dbWired) {
    dbWired = true;
    connectFirestoreEmulator(db, "localhost", 8080);
  }
  return db;
}

let pending: Promise<User> | null = null;

/** The current user; signs in anonymously (the Guest Session) when there is none. */
export function ensureUser(): Promise<User> {
  const auth = getFirebaseAuth();
  if (!pending) {
    pending = auth
      .authStateReady()
      .then(
        async () => auth.currentUser ?? (await signInAnonymously(auth)).user,
      )
      .finally(() => {
        pending = null;
      });
  }
  return pending;
}
