import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { findFitLanguage } from "@trailroom/catalog";
import { ERRORS } from "./errors";

describe("API error copy", () => {
  for (const [code, e] of Object.entries(ERRORS)) {
    it(`${code}: one plain sentence, no fit or size language`, () => {
      expect(findFitLanguage(e.message)).toBeNull();
      expect(e.message).toMatch(/^[A-Z]/);
      expect(e.message).toMatch(/\.$/);
      expect(e.status).toBeGreaterThanOrEqual(400);
    });
  }
});

const webSrc = resolve(__dirname, "..");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (name === "node_modules" || name === ".next") return [];
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return files(p);
    return /\.(ts|tsx)$/.test(name) ? [p] : [];
  });
}

describe("what apps/web may touch", () => {
  // Server modules that legitimately need the user's photo bytes or paths. Upload and delete go
  // through putPhoto/addPhoto/deleteAllForUser; the one reader is the owner-only thumbnail (the
  // person's own photo shown back to them, scoped to their uid in the path). Add a file only with
  // a reason.
  const ALLOWED: string[] = ["server/photo-library.ts"];
  const FORBIDDEN = ["staging/", "getStaging", "getPhotoBytes", "photoPath"];

  const product = files(webSrc)
    .filter((f) => !/\.test\.tsx?$/.test(f) && !f.endsWith("testkit.ts"))
    .map((f) => relative(webSrc, f));

  it("no product file reaches photos/ or staging/ objects", () => {
    const hits = product
      .filter((f) => !ALLOWED.includes(f))
      .filter((f) =>
        FORBIDDEN.some((s) =>
          readFileSync(join(webSrc, f), "utf8").includes(s),
        ),
      );
    expect(hits).toEqual([]);
  });

  it("publishRender is not referenced anywhere in apps/web", () => {
    const hits = files(resolve(webSrc, "..")).filter(
      (f) =>
        !f.endsWith("errors.test.ts") &&
        readFileSync(f, "utf8").includes("publishRender"),
    );
    expect(hits).toEqual([]);
  });
});
