import { describe, expect, it } from "vitest";
import {
  chipLines,
  queueLines,
  statusLine,
  toJobView,
  type JobStatus,
  type JobView,
} from "./job";

const POSES = ["front", "three-quarter", "walking", "seated"];

function job(status: JobStatus, poses: Record<string, string>): JobView {
  return {
    jobId: "j",
    poseSetId: "p",
    itemId: "vest",
    status,
    failure: null,
    poseOrder: POSES,
    poses: Object.fromEntries(
      POSES.map((p) => [p, { status: poses[p] ?? "pending" }]),
    ),
    qaSkipped: [],
  };
}

describe("statusLine", () => {
  const cases: [string, JobView, string][] = [
    ["queued", job("queued", {}), "Waiting to start"],
    [
      "first pose rendering",
      job("rendering", { front: "rendering" }),
      "Rendering four poses. 0 of 4 ready.",
    ],
    [
      "none done yet",
      job("rendering", {}),
      "Rendering four poses. 0 of 4 ready.",
    ],
    [
      "one passed, the rest rendering at the same time",
      job("rendering", { front: "passed", "three-quarter": "rendering" }),
      "Rendering four poses. 1 of 4 ready.",
    ],
    [
      "a failed pose is finished but not ready",
      job("rendering", { front: "passed", walking: "failed" }),
      "Rendering four poses. 1 of 4 ready.",
    ],
    [
      "three ready",
      job("rendering", {
        front: "passed",
        "three-quarter": "passed",
        walking: "passed",
      }),
      "Rendering four poses. 3 of 4 ready.",
    ],
    [
      "complete",
      job("complete", {
        front: "passed",
        "three-quarter": "passed",
        walking: "passed",
        seated: "passed",
      }),
      "4 of 4 poses ready",
    ],
    [
      "partial",
      job("complete_partial", {
        front: "passed",
        "three-quarter": "passed",
        walking: "passed",
        seated: "failed",
      }),
      "3 of 4 poses ready",
    ],
    [
      "failed",
      job("failed", { front: "failed" }),
      "This try-on could not be finished",
    ],
  ];
  it.each(cases)("%s", (_name, j, expected) => {
    expect(statusLine(j)).toBe(expected);
  });

  it("only ever says a real state, for every status and pose combination", () => {
    const REAL = [
      /^Waiting to start$/,
      /^Rendering four poses\. [0-4] of 4 ready\.$/,
      /^[0-4] of 4 poses ready$/,
      /^This try-on could not be finished$/,
    ];
    const statuses: JobStatus[] = [
      "queued",
      "rendering",
      "complete",
      "complete_partial",
      "failed",
    ];
    const poseStates = ["pending", "rendering", "passed", "failed"];
    for (const status of statuses) {
      for (let mask = 0; mask < 4 ** 4; mask++) {
        const poses: Record<string, string> = {};
        POSES.forEach(
          (p, i) => (poses[p] = poseStates[(mask >> (2 * i)) & 3]!),
        );
        const line = statusLine(job(status, poses));
        expect(
          REAL.some((re) => re.test(line)),
          `${status} ${mask}: ${line}`,
        ).toBe(true);
      }
    }
  });

  it("uses the job's own pose count, not a constant", () => {
    const three = { ...job("rendering", {}), poseOrder: POSES.slice(0, 3) };
    expect(statusLine(three)).toBe("Rendering three poses. 0 of 3 ready.");
  });
});

describe("toJobView", () => {
  it("maps an API or Firestore body and rejects non-jobs", () => {
    const v = toJobView("j1", {
      status: "rendering",
      poseSetId: "ps",
      itemId: "i",
      failure: null,
      poseOrder: ["front"],
      poses: { front: { status: "passed", attempt: 1, reasons: [] } },
      qaSkipped: ["identity"],
    });
    expect(v).toMatchObject({
      jobId: "j1",
      poseSetId: "ps",
      qaSkipped: ["identity"],
    });
    expect(v?.poses.front?.status).toBe("passed");
    expect(toJobView("j", {})).toBeNull();
  });
});

describe("chipLines: a true count, never a sequence", () => {
  it("counts the poses that are ready", () => {
    expect(chipLines(job("rendering", {}), "Wool car coat")).toEqual({
      title: "Putting the wool car coat on you",
      sub: "0 of 4 poses ready · you can keep browsing",
    });
    const two = job("rendering", {
      front: "passed",
      walking: "passed",
      seated: "rendering",
    });
    expect(chipLines(two, "Wool car coat").sub).toBe(
      "2 of 4 poses ready · you can keep browsing",
    );
    expect(chipLines(two, "Wool car coat").sub).not.toMatch(/pose \d of/i);
  });
  it("does not hard-code four", () => {
    const six = ["a", "b", "c", "d", "e", "f"];
    const j: JobView = {
      ...job("rendering", {}),
      poseOrder: six,
      poses: Object.fromEntries(
        six.map((p, i) => [p, { status: i < 3 ? "passed" : "pending" }]),
      ),
    };
    expect(chipLines(j, "x").sub).toBe(
      "3 of 6 poses ready · you can keep browsing",
    );
  });
  it("a failed pose is not ready", () => {
    expect(
      chipLines(job("rendering", { front: "passed", seated: "failed" }), "x")
        .sub,
    ).toBe("1 of 4 poses ready · you can keep browsing");
  });
});

describe("queueLines", () => {
  const all = {
    front: "passed",
    "three-quarter": "passed",
    walking: "passed",
    seated: "passed",
  };
  it("running", () => {
    expect(queueLines(job("rendering", {}), "Wool car coat", false)).toEqual({
      title: "4 poses, coming up",
      line: "Your photo, the wool car coat, 4 poses. 0 of 4 ready, and you can leave this screen while it renders.",
    });
  });
  it("done for a guest: ready, and an account opens them", () => {
    expect(queueLines(job("complete", all), "Wool car coat", false)).toEqual({
      title: "4 poses, ready",
      line: "The wool car coat on your photo, 4 poses. Create an account to open them.",
    });
  });
  it("done signed in: on you", () => {
    expect(queueLines(job("complete", all), "Wool car coat", true)).toEqual({
      title: "4 poses, on you",
      line: "The wool car coat on your photo, 4 poses.",
    });
  });
  it("a partial set states the real count", () => {
    const three = { ...all, seated: "failed" };
    expect(queueLines(job("complete_partial", three), "x", true).title).toBe(
      "3 poses, on you",
    );
  });
});
