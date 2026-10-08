import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";
import { expect, it } from "vitest";

const root = resolve(__dirname, "../../..");

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    if (["node_modules", ".next", ".turbo", "e2e"].includes(name)) return [];
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return /\.(ts|tsx|js|mjs)$/.test(name) ? [path] : [];
  });
}

it("publishRender is called from exactly one place outside packages/db", () => {
  const callers = ["apps", "packages"]
    .flatMap((d) => sources(join(root, d)))
    .filter((f) => !/\.test\.ts$/.test(f))
    .map((f) => relative(root, f))
    .filter((f) => !f.startsWith(["packages", "db"].join(sep) + sep))
    .filter((f) =>
      /\bpublishRender\s*\(/.test(readFileSync(join(root, f), "utf8")),
    );
  expect(callers).toEqual([join("packages", "pipeline", "src", "nodes.ts")]);

  const nodes = readFileSync(join(root, callers[0]!), "utf8");
  expect(nodes.match(/\bpublishRender\s*\(/g)).toHaveLength(1);
  // ...and that call sits inside publishPose, after the QA-verdict guard.
  const body = nodes.slice(nodes.indexOf("export async function publishPose"));
  const fnBody = body.slice(
    0,
    body.indexOf("\nexport async function failPose"),
  );
  expect(fnBody.indexOf('verdict !== "pass"')).toBeGreaterThan(-1);
  expect(fnBody.indexOf("publishRender(")).toBeGreaterThan(
    fnBody.indexOf('verdict !== "pass"'),
  );
});

it("no source file draws an in-pixel label (applyAiLabel is gone)", () => {
  const hits = ["apps", "packages"]
    .flatMap((d) => sources(join(root, d)))
    .filter((f) => !/\.test\.ts$/.test(f))
    .filter((f) => readFileSync(f, "utf8").includes("applyAiLabel"))
    .map((f) => relative(root, f));
  expect(hits).toEqual([]);
});
