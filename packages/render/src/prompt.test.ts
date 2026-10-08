import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { renderConfigFromEnv } from "./config";
import {
  buildPrompt,
  CATEGORIES,
  GENERIC_WEARING,
  POSES,
  PROMPT_VERSION,
  type Pose,
} from "./prompt";

const poses = Object.keys(POSES) as Pose[];

describe("the try-on prompt", () => {
  it("is still edit-v1", () => {
    expect(PROMPT_VERSION).toBe("edit-v1");
  });

  for (const pose of poses) {
    for (const category of CATEGORIES) {
      it(`matches the snapshot for ${pose} / ${category}`, () => {
        expect(
          buildPrompt({
            pose,
            category,
            wearing: GENERIC_WEARING,
            target: "demo garment",
          }),
        ).toMatchSnapshot();
      });
    }
  }

  // CLAUDE.md hard rule: never alter body proportion. The prompt may only ask to preserve it.
  it("asks to preserve body shape and never to change it", () => {
    for (const pose of poses) {
      for (const category of CATEGORIES) {
        const text = buildPrompt({
          pose,
          category,
          wearing: GENERIC_WEARING,
          target: "demo garment",
        });
        expect(text).toContain("body shape and proportions");
        expect(text).not.toMatch(
          /\b(slim\w*|thinner|smooth\w*|enhanc\w*|flatter\w*|lengthen\w*|taller|retouch\w*)\b/i,
        );
      }
    }
  });
});

describe("renderConfigFromEnv", () => {
  it("defaults to Nano Banana 2.1, $5 a day, 3:4 and the prompt's four poses", () => {
    expect(renderConfigFromEnv({})).toEqual({
      model: "nano-banana-2.1",
      dailyCapUsd: 5,
      aspectRatio: "3:4",
      poses: ["front", "three-quarter", "walking", "seated"],
    });
  });

  it("reads overrides", () => {
    const cfg = renderConfigFromEnv({
      RENDER_MODEL: "nano-banana-pro",
      DAILY_CAP_USD: "2.5",
      RENDER_POSES: "front, walking",
    });
    expect(cfg).toMatchObject({
      model: "nano-banana-pro",
      dailyCapUsd: 2.5,
      poses: ["front", "walking"],
    });
  });

  it("rejects a daily cap above the sanity bound, accepts the bound itself", () => {
    expect(() => renderConfigFromEnv({ DAILY_CAP_USD: "5000000" })).toThrow(
      /sanity bound/,
    );
    expect(renderConfigFromEnv({ DAILY_CAP_USD: "1000" }).dailyCapUsd).toBe(
      1000,
    );
  });

  it.each([
    { RENDER_MODEL: "gpt-image" },
    { DAILY_CAP_USD: "0" },
    { DAILY_CAP_USD: "-1" },
    { DAILY_CAP_USD: "" },
    { DAILY_CAP_USD: "five" },
    { DAILY_CAP_USD: "Infinity" },
    { RENDER_POSES: "front,handstand" },
    { RENDER_POSES: "front,front" },
    { RENDER_POSES: "" },
  ])("rejects %o instead of falling back", (env) => {
    expect(() => renderConfigFromEnv(env)).toThrow();
  });
});

// CLAUDE.md hard rule: never call an image model outside packages/render.
describe("the chokepoint", () => {
  const root = resolve(import.meta.dirname, "../../..");
  const skip = new Set(["node_modules", ".next", ".turbo", "dist", "build"]);

  function sources(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      if (skip.has(name)) return [];
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return sources(path);
      return /\.(ts|tsx|js|mjs|cjs)$/.test(name) ? [path] : [];
    });
  }

  // import, require(...) and dynamic import(...) all name the specifier in quotes; the REST host
  // would be a hand-rolled call that skips the SDK entirely.
  const SDK = /["'`]@google\/genai(\/[^"'`]*)?["'`]/;
  const HOST = /generativelanguage\.googleapis\.com/;
  const reachesModel = (src: string) => SDK.test(src) || HOST.test(src);

  it("the scan recognises every import form and the REST host", () => {
    for (const bad of [
      'import { GoogleGenAI } from "@google/genai";',
      "const g = require('@google/genai');",
      'const m = await import("@google/genai");',
      'import x from "@google/genai/node";',
      "fetch('https://generativelanguage.googleapis.com/v1/models')",
    ]) {
      expect(reachesModel(bad), bad).toBe(true);
    }
    expect(reachesModel('import { x } from "@trailroom/render";')).toBe(false);
  });

  it("is the only place that imports @google/genai or names the Gemini REST host", () => {
    const offenders = ["apps", "packages", "scripts"]
      .flatMap((d) => sources(join(root, d)))
      .filter((f) => !f.endsWith(".test.ts"))
      .filter(
        (f) =>
          !relative(root, f).startsWith(["packages", "render"].join(sep) + sep),
      )
      .filter((f) => reachesModel(readFileSync(f, "utf8")));
    expect(offenders.map((f) => relative(root, f))).toEqual([]);
  });
});
