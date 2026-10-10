import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveTarget } from "./script-guard";

describe("resolveTarget", () => {
  const both = {
    FIRESTORE_EMULATOR_HOST: "127.0.0.1:8080",
    FIREBASE_STORAGE_EMULATOR_HOST: "127.0.0.1:9199",
  };
  it("accepts the emulators (both hosts)", () => {
    expect(resolveTarget(both).kind).toBe("emulator");
    expect(
      resolveTarget({ ...both, GOOGLE_CLOUD_PROJECT: "demo-x" }).projectId,
    ).toBe("demo-x");
  });
  it("refuses half an emulator, whatever the flag says", () => {
    expect(() =>
      resolveTarget(
        { FIRESTORE_EMULATOR_HOST: "h:1", GOOGLE_CLOUD_PROJECT: "p" },
        "p",
      ),
    ).toThrow(/only one/);
  });
  it("refuses a real project without the flag, or with the wrong one", () => {
    const env = { GOOGLE_CLOUD_PROJECT: "virtual-tryon-tejas" };
    expect(() => resolveTarget(env)).toThrow(/--allow-real-project/);
    expect(() => resolveTarget(env, "another-project")).toThrow(/refusing/);
    expect(() => resolveTarget({})).toThrow(/no project id/);
    expect(() => resolveTarget({ FIREBASE_CONFIG: "not json" })).toThrow();
  });
  it("accepts a real project only when the flag names it", () => {
    expect(resolveTarget({ GOOGLE_CLOUD_PROJECT: "p" }, "p")).toEqual({
      kind: "project",
      projectId: "p",
    });
    expect(
      resolveTarget(
        { FIREBASE_CONFIG: JSON.stringify({ projectId: "q" }) },
        "q",
      ).projectId,
    ).toBe("q");
  });
});

describe("scripts/publish-piece.ts", () => {
  it("refuses a real project without the flag, before anything is touched", () => {
    const root = resolve(__dirname, "../../..");
    const r = spawnSync(
      "npx",
      ["tsx", "scripts/publish-piece.ts", "--spec", "nothing.json"],
      {
        cwd: root,
        // No emulator hosts, no credentials: if it got as far as Firebase it would fail loudly.
        env: {
          PATH: process.env.PATH,
          HOME: process.env.HOME,
          NODE_ENV: "test",
          GOOGLE_CLOUD_PROJECT: "virtual-tryon-tejas",
        },
        encoding: "utf8",
        timeout: 60_000,
      },
    );
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(
      /refusing to run against the real project "virtual-tryon-tejas"/,
    );
    expect(r.stdout).not.toMatch(/published/);
  });

  it("also refuses with the wrong project named in the flag", () => {
    const root = resolve(__dirname, "../../..");
    const r = spawnSync(
      "npx",
      [
        "tsx",
        "scripts/publish-piece.ts",
        "--spec",
        "nothing.json",
        "--allow-real-project",
        "other",
      ],
      {
        cwd: root,
        env: {
          PATH: process.env.PATH,
          HOME: process.env.HOME,
          NODE_ENV: "test",
          GOOGLE_CLOUD_PROJECT: "virtual-tryon-tejas",
        },
        encoding: "utf8",
        timeout: 60_000,
      },
    );
    expect(r.status).toBe(2);
  });
});
