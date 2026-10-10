import { Timestamp } from "firebase-admin/firestore";

/** Guest records live 48 hours. */
export const GUEST_TTL_MS = 48 * 60 * 60 * 1000;

/** createdAt + 48h for guests, null for signed-in users. */
export function expiryFor(isGuest: boolean, createdAt: Date): Timestamp | null {
  return isGuest
    ? Timestamp.fromMillis(createdAt.getTime() + GUEST_TTL_MS)
    : null;
}

export type JobStatus =
  "queued" | "rendering" | "complete" | "complete_partial" | "failed";
export type PoseStatus = "pending" | "rendering" | "passed" | "failed";
export type FailureCode =
  "render_failed" | "capacity" | "not_ready" | "internal";

export interface ConsentDoc {
  version: string;
  acceptedAt: Timestamp;
  ageAttested18: true;
}

/** follows/{uid}: the label slugs this user follows. Written only by the server. */
export interface FollowsDoc {
  labels: string[];
  updatedAt: Timestamp;
}

/** photos/{uid}/items/{photoId}: one full-body photo. The object lives at photos/{uid}/{photoId}.jpg. */
export interface PhotoDoc {
  storagePath: string;
  width: number;
  height: number;
  label: string;
  isGuest: boolean;
  createdAt: Timestamp;
  expiresAt: Timestamp | null;
}

/**
 * photos/{uid}: the small parent doc. It names the default photo and carries the guest expiry
 * (refreshed on every add), so the purge can find expired guests without a collection-group query.
 */
export interface PhotosDoc {
  defaultPhotoId: string | null;
  isGuest: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  expiresAt: Timestamp | null;
}

/** At most this many photos per person. */
export const MAX_PHOTOS = 6;

/** What the pipeline durably records per (pose, attempt); this is what makes its nodes replayable. */
export interface AttemptRecord {
  outcome?: "rendered" | "blocked" | "no_image" | "model_error" | "capacity";
  // Free-text detail is NOT stored here: the owner can read this doc. It goes to jobInternals.
  qa?: { verdict: "pass" | "fail"; reasons: string[] };
}

export interface PoseState {
  status: PoseStatus;
  attempt: number;
  reasons: string[];
  /** Keyed by attempt number as a string. Absent on jobs created before the pipeline existed. */
  attempts?: Record<string, AttemptRecord>;
}

/**
 * What a job renders: one piece on the four poses, two pieces together in one image, or (an
 * "arrival") one new piece on the Front pose only, which nobody asked for.
 */
export type RenderKind = "tryon" | "outfit" | "arrival";

export interface JobDoc {
  uid: string;
  itemId: string;
  /** Absent on documents from before outfits: a try-on. */
  kind?: RenderKind;
  /** Both pieces of an outfit, canonical (sorted) order; itemId is the first. Absent on a try-on. */
  itemIds?: string[];
  photoId: string;
  poseSetId: string;
  status: JobStatus;
  failure: null | { code: FailureCode };
  poses: Record<string, PoseState>;
  poseOrder: string[];
  qaSkipped: string[];
  model: string;
  promptVersion: string;
  isGuest: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  expiresAt: Timestamp | null;
}

export type PoseSetStatus =
  "rendering" | "complete" | "complete_partial" | "failed";

export interface PoseSetDoc {
  uid: string;
  itemId: string;
  kind?: RenderKind;
  itemIds?: string[];
  photoId: string;
  jobId: string;
  status: PoseSetStatus;
  poses: string[];
  createdAt: Timestamp;
  expiresAt: Timestamp | null;
}

/** At most this many lists per person, and pieces per list. */
export const MAX_LISTS = 30;
export const MAX_LIST_ITEMS = 12;
/** An ask carries 1 to this many pieces, and at most this many asks are live per person. */
export const MAX_ASK_ITEMS = 4;
export const MAX_LIVE_ASKS = 20;
/** Vote documents one ask may hold; more are refused, so a link cannot grow without bound. */
export const MAX_VOTES_PER_ASK = 500;
export const MAX_QUESTION_LENGTH = 120;
export const MAX_LIST_NAME_LENGTH = 60;
/** An ask link works for 7 days; the purge deletes it 30 days after that. */
export const ASK_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const ASK_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

/** lists/{listId}. Written only by the server; clients read it through /api/lists. */
export interface ListDoc {
  uid: string;
  name: string;
  /** Catalogue ids, unique, in the order added. */
  itemIds: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * asks/{askId}. The raw link token is never stored: only its SHA-256 hash, which is how the
 * public page finds the ask. `uid` is the asker's and is never sent to a voter.
 */
export interface AskDoc {
  uid: string;
  askerFirstName: string;
  listId: string;
  listName: string;
  question: string | null;
  itemIds: string[];
  /** Frozen at creation: the asker's finished try-on for each piece, if any. */
  poseSetIds: Record<string, string | null>;
  /**
   * Frozen with `poseSetIds`: the job id each of those sets had. Pose-set ids are deterministic,
   * so a removed and re-rendered try-on reuses the id; the job id tells them apart. Missing on
   * asks made before this field existed, which show the label photograph.
   */
  poseSetJobIds?: Record<string, string | null>;
  tokenHash: string;
  createdAt: Timestamp;
  expiresAt: Timestamp;
  revokedAt: Timestamp | null;
  counts: Record<string, number>;
  /** How many vote documents the ask holds (capped at MAX_VOTES_PER_ASK). Never sent to a viewer. */
  voteCount?: number;
  /** Uids of signed-in people whose inbox holds this ask, so deleting the ask can clear them. Private. */
  openedBy?: string[];
}

/** asks/{askId}/votes/{voterKey}: one vote per voter. `voterUid` is null for cookie voters. */
export interface VoteDoc {
  itemId: string;
  createdAt: Timestamp;
  voterUid: string | null;
}

/** inbox/{uid}/asks/{askId}: an ask this signed-in person opened. */
export interface InboxAskDoc {
  askerFirstName: string;
  question: string | null;
  itemIds: string[];
  firstOpenedAt: Timestamp;
  votedItemId: string | null;
  unread: boolean;
}

/**
 * purchases/{uid}_{itemId}: the person pressed "Go to <label>" on a piece (the intent), and later
 * said whether it arrived (`arrived`, set once). Written only by the server.
 */
export interface PurchaseDoc {
  uid: string;
  itemId: string;
  clickedAt: Timestamp;
  arrived: boolean | null;
  answeredAt?: Timestamp;
}

/** A job or pose set's kind, with the default for documents from before outfits. */
export const kindOf = (d: { kind?: RenderKind }): RenderKind =>
  d.kind ?? "tryon";
