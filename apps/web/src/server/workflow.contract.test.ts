// Cloud Workflows has no emulator, so this is what stands in for one: the YAML must parse, every
// call must hit a registered node route with a body that route accepts, and the shape must match
// GRAPH. The parity emulator test (parity.emu.test.ts) covers the behaviour.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { GRAPH } from "@trailroom/pipeline";
import { INTERNAL_ROUTES, PIPELINE_BASE } from "./internal-routes";

const file = resolve(__dirname, "../../../../workflows/render-pose-set.yaml");
const text = readFileSync(file, "utf8");
const doc = parse(text) as Record<string, any>;

type Obj = Record<string, any>;

function walk(node: unknown, visit: (o: Obj) => void): void {
  if (Array.isArray(node)) node.forEach((n) => walk(n, visit));
  else if (node && typeof node === "object") {
    visit(node as Obj);
    Object.values(node).forEach((n) => walk(n, visit));
  }
}

const calls: Obj[] = [];
const tryWrappers: Obj[] = [];
walk(doc, (o) => {
  if (o.call === "http.post") calls.push(o);
  if (o.try && typeof o.try === "object" && o.try.call === "http.post") {
    tryWrappers.push(o);
  }
});

const URL_RE = /^\$\{baseUrl \+ "(\/api\/internal\/pipeline\/[a-z-]+)"\}$/;
const routeOf = (c: Obj) => {
  const m = URL_RE.exec(c.args.url);
  expect(m, `url ${c.args.url}`).not.toBeNull();
  return INTERNAL_ROUTES.find((r) => r.path === m![1]);
};

describe("render-pose-set workflow", () => {
  it("parses, with a main workflow taking one argument", () => {
    expect(doc.main.params).toEqual(["args"]);
    expect(calls.length).toBeGreaterThan(0);
  });

  it("every http.post targets APP_URL plus a registered pipeline route, with OIDC on that audience", () => {
    for (const c of calls) {
      const r = routeOf(c);
      expect(r, c.args.url).toBeDefined();
      expect(c.args.auth).toEqual({ type: "OIDC", audience: "${baseUrl}" });
    }
    // baseUrl comes from the workflow environment, in every scope that uses it.
    const assigns: string[] = [];
    walk(doc, (o) => {
      if (Array.isArray(o.assign)) {
        for (const a of o.assign) {
          if ("baseUrl" in a) assigns.push(a.baseUrl);
        }
      }
    });
    expect(assigns.length).toBeGreaterThan(0);
    for (const a of assigns) expect(a).toBe('${sys.get_env("APP_URL")}');
  });

  it("the execution argument never builds a URL, and only supplies jobId", () => {
    for (const c of calls) {
      expect(c.args.url).not.toMatch(/args/);
      expect(JSON.stringify(c.args.auth)).not.toMatch(/args/);
    }
    const uses = text.match(/\bargs\.[A-Za-z_]+/g) ?? [];
    expect(uses.filter((u) => u !== "args.jobId")).toEqual([]);
    // the one use is the job id assignment
    expect(text.match(/\bargs\.jobId/g)).toHaveLength(1);
  });

  it("each call body has the route's keys and passes the route's strict validator", () => {
    const sample = (v: unknown): unknown => {
      if (v === "${jobId}") return "job1";
      if (v === "${pose}") return "front";
      if (typeof v === "string" && v.startsWith("${")) return "text";
      return v;
    };
    for (const c of calls) {
      const r = routeOf(c)!;
      const keys = Object.keys(c.body ?? c.args.body);
      const body = c.args.body as Obj;
      const bodyKeys = Object.keys(body);
      expect(keys).toBeDefined();
      for (const k of r.keys) expect(bodyKeys, r.path).toContain(k);
      for (const k of bodyKeys) {
        expect([...r.keys, ...r.optionalKeys], `${r.path} ${k}`).toContain(k);
      }
      const parsed = r.parse(
        Object.fromEntries(bodyKeys.map((k) => [k, sample(body[k])])),
      );
      expect(parsed, r.path).not.toBeNull();
    }
  });

  it("every HTTP step has a bounded retry policy with backoff", () => {
    expect(tryWrappers).toHaveLength(calls.length);
    for (const w of tryWrappers) {
      expect(w.retry.predicate).toMatch(/^\$\{[a-z_]+\}$/);
      expect(w.retry.max_retries).toBeGreaterThan(0);
      expect(w.retry.max_retries).toBeLessThanOrEqual(10);
      expect(w.retry.backoff.initial_delay).toBeGreaterThan(0);
      expect(w.retry.backoff.max_delay).toBeGreaterThanOrEqual(
        w.retry.backoff.initial_delay,
      );
      expect(w.retry.backoff.multiplier).toBeGreaterThan(1);
      // the predicate subworkflow exists
      const name = /^\$\{([a-z_]+)\}$/.exec(w.retry.predicate)![1]!;
      expect(doc[name]?.params).toEqual(["e"]);
    }
  });

  it("4xx other than 429 is never retried by the predicates", () => {
    for (const name of ["transient_error", "transient_error_not_timeout"]) {
      const src = JSON.stringify(doc[name]);
      expect(src).toContain("429");
      expect(src).toContain("e.code >= 500");
      expect(src).not.toMatch(/e\.code (==|>=) 4(?!29)/);
    }
  });

  it("runs the poses in a parallel for over what prepare returned", () => {
    const prepare = calls.find((c) => routeOf(c)?.node === "prepare")!;
    const prepareResult = tryWrappers.find((w) => w.try === prepare)!.try
      .result;
    let par: Obj | undefined;
    walk(doc, (o) => {
      if (o.parallel?.for) par = o.parallel;
    });
    expect(par).toBeDefined();
    expect(par!.for.in).toBe(`\${${prepareResult}.body.poses}`);
    expect(par!.shared).toContain("capacityHit");
  });

  it("attempt numbers are exactly 1..GRAPH.branch.maxAttempts", () => {
    const attempts = new Set<number>();
    for (const c of calls) {
      if (c.args.body.attempt !== undefined) {
        attempts.add(c.args.body.attempt);
      }
    }
    expect([...attempts].sort()).toEqual(
      Array.from({ length: GRAPH.branch.maxAttempts }, (_, i) => i + 1),
    );
  });

  it("uses exactly the nodes in GRAPH, and the registry has no other route", () => {
    const graphNodes = new Set<string>([
      ...GRAPH.sequence.filter((s) => s !== "poses"),
      ...GRAPH.branch.steps,
      ...Object.values(GRAPH.branch.routes),
      GRAPH.onCapacity.node,
      GRAPH.onError.node,
    ]);
    const used = new Set(calls.map((c) => routeOf(c)!.node));
    expect([...used].sort()).toEqual([...graphNodes].sort());
    expect(INTERNAL_ROUTES.map((r) => r.node).sort()).toEqual(
      [...graphNodes].sort(),
    );
    for (const r of INTERNAL_ROUTES) {
      expect(r.path).toBe(`${PIPELINE_BASE}/${r.segment}`);
    }
  });

  it("the top-level except calls fail-job with internal, then re-raises", () => {
    const guarded = doc.main.steps.find((s: Obj) => s.guarded).guarded;
    const steps = guarded.except.steps as Obj[];
    const failCall = steps
      .map((s) => Object.values(s)[0] as Obj)
      .find((s) => s.try?.call === "http.post")!;
    expect(failCall.try.args.url).toBe(
      `\${baseUrl + "${PIPELINE_BASE}/${GRAPH.onError.node === "failJob" ? "fail-job" : ""}"}`,
    );
    expect(failCall.try.args.body.code).toBe(GRAPH.onError.code);
    const last = Object.values(steps[steps.length - 1]!)[0] as Obj;
    expect(last.raise).toBe("${e}");
  });

  it("no step raises a bare string (the handler reads `message` from a map)", () => {
    const raises: unknown[] = [];
    walk(doc, (o) => {
      if ("raise" in o) raises.push(o.raise);
    });
    expect(raises.length).toBeGreaterThan(0);
    for (const r of raises) {
      if (r === "${e}") continue; // re-raise of the caught error
      expect(typeof r, JSON.stringify(r)).toBe("object");
      expect(r).toHaveProperty("message");
      expect(r).toHaveProperty("code");
    }
  });

  it("the except handler checks the error's type before reading message", () => {
    const guarded = doc.main.steps.find((s: Obj) => s.guarded).guarded;
    const src = JSON.stringify(guarded.except);
    expect(src).toContain("get_type(e)");
    const mapGet = src.indexOf('map.get(e, \\"message\\")');
    expect(mapGet).toBeGreaterThan(src.indexOf("get_type(e)"));
  });

  it("render-pose waits just above the endpoint's 300 s limit, never longer", () => {
    const renders = calls.filter((c) => routeOf(c)?.node === "renderPose");
    expect(renders.length).toBe(2);
    for (const c of renders) {
      expect(c.args.timeout).toBeGreaterThan(300);
      expect(c.args.timeout).toBeLessThanOrEqual(330);
    }
  });

  it("the capacity branch calls fail-job with capacity and finalize-set otherwise", () => {
    const bodies = calls
      .filter((c) => routeOf(c)?.node === "failJob")
      .map((c) => c.args.body.code);
    expect(bodies.sort()).toEqual([GRAPH.onCapacity.code, GRAPH.onError.code]);
    expect(text).toContain("capacityHit");
    expect(text).toMatch(
      /condition: \$\{capacityHit\}\s+next: fail_for_capacity/,
    );
  });

  it("routes render-pose capacity out of the branch before QA", () => {
    const branch = doc.pose_branch.steps as Obj[];
    const names = branch.map((s) => Object.keys(s)[0]);
    expect(names.indexOf("capacity_after_render_1")).toBe(
      names.indexOf("render_1") + 1,
    );
    expect(names.indexOf("capacity_after_render_2")).toBe(
      names.indexOf("render_2") + 1,
    );
    expect(
      JSON.stringify(branch[names.indexOf("capacity_after_render_1")]),
    ).toContain(GRAPH.branch.capacityOutcome);
  });
});
