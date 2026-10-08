import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  auth,
  bucket,
  claimDailyStart,
  FirestoreDailyLedger,
  utcDay,
  claimPoseSet,
  createJob,
  firestore,
  getJob,
  getPhoto,
  getPhotoBytes,
  putPhoto,
  recordConsent,
  savePhoto,
  poseSetId,
  updateJob,
} from "@trailroom/db";
import { getFakeCalls, setFakeScript } from "@trailroom/render";
import { clearFirestore } from "../../../../packages/db/src/emu-helpers";
import {
  clearBucket,
  listObjects,
  makeJob,
  personPhoto,
  POSE_LIST,
} from "../../../../packages/pipeline/src/testkit";
import {
  GET as pingGET,
  POST as pingPOST,
} from "../app/api/internal/ping/route";
import { POST as purgePOST } from "../app/api/internal/purge/route";
import { INTERNAL_ROUTES } from "./internal-routes";
import { useKeySourceForTests } from "./oidc";
import {
  AUDIENCE,
  bearer,
  keySourceFor,
  makeKey,
  SCHEDULER_SA,
  signToken,
  WORKFLOWS_SA,
} from "./oidc-testkit";
import { HANDLERS, makeDriver, signedRequest } from "./workflow-driver";
import { Timestamp } from "firebase-admin/firestore";
import { anonymousToken, emailToken, uidOf } from "./testkit";

const key = makeKey();

beforeEach(async () => {
  process.env.RENDER_PROVIDER = "fake";
  process.env.INTERNAL_AUDIENCE = AUDIENCE;
  process.env.WORKFLOWS_SA_EMAIL = WORKFLOWS_SA;
  process.env.SCHEDULER_SA_EMAIL = SCHEDULER_SA;
  delete process.env.DAILY_CAP_USD;
  useKeySourceForTests(keySourceFor(key));
  setFakeScript(null);
  await clearFirestore();
  await clearBucket();
});
afterEach(() => {
  useKeySourceForTests(null);
  vi.unstubAllEnvs();
});

const sampleBody = (segment: string, jobId = "someJob") => {
  switch (segment) {
    case "prepare":
    case "finalize-set":
      return { jobId };
    case "fail-pose":
      return { jobId, pose: "front" };
    case "fail-job":
      return { jobId, code: "internal" };
    default:
      return { jobId, pose: "front", attempt: 1 };
  }
};

describe("auth on every internal endpoint", () => {
  it("covers every registered route", () => {
    expect(Object.keys(HANDLERS).sort()).toEqual(
      INTERNAL_ROUTES.map((r) => r.segment).sort(),
    );
  });

  it.each(INTERNAL_ROUTES.map((r) => r.segment))(
    "%s: no token 401, Scheduler SA 401, Workflows SA gets past auth",
    async (segment) => {
      const j = await makeJob("u-auth");
      const body = sampleBody(segment, j.jobId);
      const h = HANDLERS[segment]!;
      const none = await h(
        new Request("http://x", { method: "POST", body: JSON.stringify(body) }),
      );
      expect(none.status).toBe(401);
      const sched = await h(signedRequest(key, segment, body, SCHEDULER_SA));
      expect(sched.status).toBe(401);
      const wf = await h(signedRequest(key, segment, { garbage: true }));
      expect(wf.status).toBe(400); // authenticated, then rejected on shape
      expect(getFakeCalls()).toHaveLength(0);
    },
  );

  it("fails closed with no config: every internal request is 401", async () => {
    delete process.env.INTERNAL_AUDIENCE;
    for (const [segment, h] of Object.entries(HANDLERS)) {
      const res = await h(signedRequest(key, segment, sampleBody(segment)));
      expect(res.status, segment).toBe(401);
    }
    expect((await pingGET(new Request("http://x"))).status).toBe(401);
  });

  it("purge: no token 401, Workflows SA 401, Scheduler SA 200", async () => {
    const mk = (headers: Record<string, string>) =>
      new Request("http://x/api/internal/purge", { method: "POST", headers });
    expect((await purgePOST(mk({}))).status).toBe(401);
    expect(
      (await purgePOST(mk(bearer(signToken(key, { email: WORKFLOWS_SA })))))
        .status,
    ).toBe(401);
    const ok = await purgePOST(
      mk(bearer(signToken(key, { email: SCHEDULER_SA }))),
    );
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ purged: 0, reaped: 0 });
  });

  it("ping: 401 without a token and for the Scheduler SA, 200 for the Workflows SA", async () => {
    expect((await pingGET(new Request("http://x"))).status).toBe(401);
    const asSched = bearer(signToken(key, { email: SCHEDULER_SA }));
    expect(
      (
        await pingPOST(
          new Request("http://x", { method: "POST", headers: asSched }),
        )
      ).status,
    ).toBe(401);
    const asWf = bearer(signToken(key));
    expect(
      (await pingGET(new Request("http://x", { headers: asWf }))).status,
    ).toBe(200);
  });
});

describe("validation", () => {
  const call = (segment: string, body: unknown) =>
    HANDLERS[segment]!(signedRequest(key, segment, body));

  it("unknown job is 404 on every route", async () => {
    for (const r of INTERNAL_ROUTES) {
      const res = await call(r.segment, sampleBody(r.segment, "nope"));
      expect(res.status, r.segment).toBe(404);
    }
  });

  it("a pose that is not in the job is 400", async () => {
    const j = await makeJob("u-val", "blouse", ["front", "walking"]);
    for (const segment of ["render-pose", "qa-pose", "publish-pose"]) {
      const res = await call(segment, {
        jobId: j.jobId,
        pose: "seated",
        attempt: 1,
      });
      expect(res.status, segment).toBe(400);
    }
    expect(
      (await call("fail-pose", { jobId: j.jobId, pose: "seated" })).status,
    ).toBe(400);
    expect(getFakeCalls()).toHaveLength(0);
  });

  it("a terminal job is 409 on render-pose: no reservation, no model call, not retried", async () => {
    const j = await makeJob("u-409");
    await updateJob(j.jobId, { status: "failed" });
    const res = await call("render-pose", {
      jobId: j.jobId,
      pose: "front",
      attempt: 1,
    });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "job_terminal" });
    expect(getFakeCalls()).toHaveLength(0);
    expect((await firestore().collection("spendLog").get()).size).toBe(0);
    // fail-job (the workflow's error handler) is a safe no-op on it.
    expect(
      (await call("fail-job", { jobId: j.jobId, code: "internal" })).status,
    ).toBe(200);
  });

  it("attempt outside 1..2 is 400", async () => {
    const j = await makeJob("u-val2");
    for (const attempt of [0, 3, 1.5, "1", null, -1]) {
      for (const segment of ["render-pose", "qa-pose", "publish-pose"]) {
        const res = await call(segment, {
          jobId: j.jobId,
          pose: "front",
          attempt,
        });
        expect(res.status, `${segment} ${String(attempt)}`).toBe(400);
      }
    }
    expect(getFakeCalls()).toHaveLength(0);
  });

  it("fail-job only accepts capacity or internal", async () => {
    const j = await makeJob("u-val3");
    for (const code of ["render_failed", "not_ready", "", 5, undefined]) {
      const res = await call("fail-job", { jobId: j.jobId, code });
      expect(res.status, String(code)).toBe(400);
    }
    expect((await getJob(j.jobId))!.status).toBe("queued");
    const ok = await call("fail-job", { jobId: j.jobId, code: "capacity" });
    expect(ok.status).toBe(200);
  });

  it("rejects extra keys, non-objects and non-JSON bodies", async () => {
    const j = await makeJob("u-val4");
    expect((await call("prepare", { jobId: j.jobId, extra: 1 })).status).toBe(
      400,
    );
    expect((await call("prepare", [j.jobId])).status).toBe(400);
    expect((await call("prepare", null)).status).toBe(400);
    expect((await call("prepare", { jobId: "../x" })).status).toBe(400);
    const raw = new Request("http://x", {
      method: "POST",
      headers: bearer(signToken(key)),
      body: "{not json",
    });
    expect((await HANDLERS.prepare!(raw)).status).toBe(400);
  });

  it("a thrown node error is a generic 500 with the detail only in the log", async () => {
    const j = await makeJob("u-val5");
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    // qa-pose before the pose was rendered throws inside the node.
    const res = await call("qa-pose", {
      jobId: j.jobId,
      pose: "front",
      attempt: 1,
    });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "internal" });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("a missing garment image in production: render-pose is a generic 500, the job ends failed/internal, no model call, no spend", async () => {
    const j = await makeJob("u-prod");
    await bucket().deleteFiles({ prefix: "catalog/", force: true });
    vi.stubEnv("NODE_ENV", "production");
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const seen: { segment: string; status: number; json: any }[] = [];
    await expect(
      makeDriver(key, {
        onCall: (segment, _b, status, json) =>
          seen.push({ segment, status, json }),
      })(j.jobId),
    ).rejects.toThrow(/render-pose answered 500/);
    const render = seen.find((s) => s.segment === "render-pose")!;
    expect(render.json).toEqual({ error: "internal" });
    expect(JSON.stringify(render.json)).not.toContain("catalog/");
    expect(spy.mock.calls.flat().join(" ")).toContain(
      "catalog/wrap-top-front.webp",
    );
    spy.mockRestore();
    vi.unstubAllEnvs();
    const job = (await getJob(j.jobId))!;
    expect(job.status).toBe("failed");
    expect(job.failure?.code).toBe("internal");
    expect(getFakeCalls()).toHaveLength(0);
    expect((await firestore().collection("spendLog").get()).size).toBe(0);
    expect(await listObjects("renders/")).toEqual([]);
    expect(await listObjects("catalog/")).toEqual([]);
  });
});

describe("purge", () => {
  const PAST = new Date(Date.now() - 5 * 24 * 3600 * 1000);

  async function seedUser(
    uid: string,
    opts: { guest: boolean; at: Date; withJob: boolean },
  ) {
    await recordConsent(uid, "v1");
    await putPhoto(uid, await personPhoto());
    const photo = await savePhoto(
      uid,
      { width: 768, height: 1024, isGuest: opts.guest },
      opts.at,
    );
    if (opts.withJob) {
      const psId = poseSetId(uid, photo.identityVersion, "blouse");
      const { id } = await createJob(
        {
          uid,
          itemId: "blouse",
          identityVersion: photo.identityVersion,
          poseSetId: psId,
          poseOrder: POSE_LIST,
          poses: Object.fromEntries(
            POSE_LIST.map((p) => [
              p,
              { status: "pending", attempt: 0, reasons: [] },
            ]),
          ),
          qaSkipped: [],
          model: "nano-banana-2.1",
          promptVersion: "edit-v1",
          isGuest: opts.guest,
          status: "complete", // seeded jobs are finished, so the stale-job sweep leaves them
        },
        opts.at,
      );
      await claimPoseSet(
        {
          uid,
          itemId: "blouse",
          identityVersion: photo.identityVersion,
          jobId: id,
          isGuest: opts.guest,
        },
        opts.at,
      );
      await bucket()
        .file(`renders/${uid}/${psId}/front.jpg`)
        .save(Buffer.from("x"));
      await bucket().file(`staging/${id}/front-1.png`).save(Buffer.from("x"));
    }
  }

  const purge = () =>
    purgePOST(
      new Request("http://x/api/internal/purge", {
        method: "POST",
        headers: bearer(signToken(key, { email: SCHEDULER_SA })),
      }),
    );

  it("deletes expired guests (docs, objects, Auth user) and nothing else", async () => {
    const expiredUid = uidOf(await anonymousToken());
    const freshUid = uidOf(await anonymousToken());
    const photoOnlyUid = uidOf(await anonymousToken());
    const promotedUid = uidOf(await anonymousToken());
    await seedUser(expiredUid, { guest: true, at: PAST, withJob: true });
    await seedUser(freshUid, { guest: true, at: new Date(), withJob: true });
    await seedUser(photoOnlyUid, { guest: true, at: PAST, withJob: false });
    // Promoted: an old account whose records no longer expire.
    await seedUser(promotedUid, { guest: false, at: PAST, withJob: true });

    const res = await purge();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ purged: 2 });

    for (const uid of [expiredUid, photoOnlyUid]) {
      expect(await getPhoto(uid)).toBeNull();
      expect(await getPhotoBytes(uid)).toBeNull();
      expect(await listObjects(`renders/${uid}/`)).toEqual([]);
      const jobs = await firestore()
        .collection("jobs")
        .where("uid", "==", uid)
        .get();
      expect(jobs.empty).toBe(true);
      await expect(auth().getUser(uid)).rejects.toMatchObject({
        code: "auth/user-not-found",
      });
    }
    for (const uid of [freshUid, promotedUid]) {
      expect(await getPhoto(uid)).not.toBeNull();
      expect(await getPhotoBytes(uid)).not.toBeNull();
      expect((await listObjects(`renders/${uid}/`)).length).toBe(1);
      const jobs = await firestore()
        .collection("jobs")
        .where("uid", "==", uid)
        .get();
      expect(jobs.size).toBe(1);
      expect((await auth().getUser(uid)).uid).toBe(uid);
    }
    // Running it again purges nothing.
    expect(await (await purge()).json()).toMatchObject({ purged: 0 });
  });

  it("tolerates a guest whose Auth user is already gone", async () => {
    await seedUser("ghost-guest", { guest: true, at: PAST, withJob: true });
    expect(await (await purge()).json()).toMatchObject({ purged: 1 });
    expect(await getPhoto("ghost-guest")).toBeNull();
  });

  it("promotes (never deletes) an expired 'guest' whose Auth user was linked to a provider", async () => {
    const linked = uidOf(await emailToken());
    const anon = uidOf(await anonymousToken());
    await seedUser(linked, { guest: true, at: PAST, withJob: true });
    await seedUser(anon, { guest: true, at: PAST, withJob: false });
    const body = await (await purge()).json();
    expect(body).toMatchObject({ purged: 1, promoted: 1 });
    const photo = (
      await firestore().collection("photos").doc(linked).get()
    ).data()!;
    expect(photo).toMatchObject({ isGuest: false, expiresAt: null });
    const jobs = await firestore()
      .collection("jobs")
      .where("uid", "==", linked)
      .get();
    expect(jobs.docs[0]!.data()).toMatchObject({
      isGuest: false,
      expiresAt: null,
    });
    expect((await auth().getUser(linked)).uid).toBe(linked);
    expect(await getPhotoBytes(linked)).not.toBeNull();
    await expect(auth().getUser(anon)).rejects.toMatchObject({
      code: "auth/user-not-found",
    });
  });

  it("sweeps consent-only guests past the TTL, not fresh ones, linked accounts or uploaders", async () => {
    const OLD = Timestamp.fromMillis(Date.now() - 49 * 3600 * 1000);
    const mk = (uid: string, at: Timestamp) =>
      firestore()
        .collection("consents")
        .doc(uid)
        .set({ version: "v1", acceptedAt: at, ageAttested18: true });
    const stale = uidOf(await anonymousToken());
    const fresh = uidOf(await anonymousToken());
    const linked = uidOf(await emailToken());
    await mk(stale, OLD);
    await mk(fresh, Timestamp.now());
    await mk(linked, OLD);
    await mk("ghost-no-auth", OLD);
    const body = await (await purge()).json();
    expect(body.consentOnly).toBe(2);
    expect(
      (await firestore().collection("consents").doc(stale).get()).exists,
    ).toBe(false);
    expect(
      (await firestore().collection("consents").doc("ghost-no-auth").get())
        .exists,
    ).toBe(false);
    await expect(auth().getUser(stale)).rejects.toMatchObject({
      code: "auth/user-not-found",
    });
    expect(
      (await firestore().collection("consents").doc(fresh).get()).exists,
    ).toBe(true);
    expect(
      (await firestore().collection("consents").doc(linked).get()).exists,
    ).toBe(true);
    expect((await auth().getUser(linked)).uid).toBe(linked);
  });

  it("settles a 20-minute-old reservation at its estimate, leaves a 1-minute-old one, and is a no-op twice", async () => {
    const mkLedger = (ageMs: number) =>
      new FirestoreDailyLedger(5, () => new Date(Date.now() - ageMs));
    await mkLedger(20 * 60_000).reserve(100_000, {
      jobId: "old",
      pose: "front",
      attempt: 1,
    });
    await mkLedger(60_000).reserve(100_000, {
      jobId: "new",
      pose: "front",
      attempt: 1,
    });
    const first = await (await purge()).json();
    expect(first.reaped).toBe(1);
    const old = await new FirestoreDailyLedger(5).findReservation(
      "old",
      "front",
      1,
    );
    expect(old!.log).toMatchObject({ state: "settled", actualMicros: 100_000 });
    const young = await new FirestoreDailyLedger(5).findReservation(
      "new",
      "front",
      1,
    );
    expect(young!.log.state).toBe("reserved");
    const day = (
      await firestore().collection("spend").doc(utcDay(new Date())).get()
    ).data()!;
    expect(day).toMatchObject({
      pendingMicros: 100_000,
      committedMicros: 100_000,
    });
    expect((await (await purge()).json()).reaped).toBe(0);
  });

  it("fails jobs stuck queued/rendering past the threshold and drops usage older than 3 days", async () => {
    const stuck = await makeJob("u-stuck");
    const fresh = await makeJob("u-fresh");
    await firestore()
      .collection("jobs")
      .doc(stuck.jobId)
      .update({
        status: "rendering",
        updatedAt: Timestamp.fromMillis(Date.now() - 30 * 60_000),
      });
    await claimDailyStart("u-old", 5, new Date(Date.now() - 5 * 24 * 3600_000));
    const body = await (await purge()).json();
    expect(body).toMatchObject({ staleJobs: 1, usageDeleted: 1 });
    expect((await getJob(stuck.jobId))!.status).toBe("failed");
    expect((await getJob(fresh.jobId))!.status).toBe("queued");
    expect((await (await purge()).json()).staleJobs).toBe(0);
  });
});
