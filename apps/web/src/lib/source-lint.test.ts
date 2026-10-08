import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const SRC = join(fileURLToPath(import.meta.url), "../..");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}
const files = walk(SRC);
const rel = (f: string) => relative(SRC, f);
const tsx = files.filter((f) => f.endsWith(".tsx"));
const isTest = (f: string) => /\.test\.tsx?$/.test(f);
const hasLetters = (s: string) => /[A-Za-z]/.test(s);

// Attributes whose string value is read aloud or shown.
const TEXT_ATTRS = new Set([
  "aria-label",
  "alt",
  "placeholder",
  "title",
  "aria-description",
  "aria-placeholder",
  "aria-roledescription",
]);
// State setters that put text on screen.
const TEXT_SETTERS = /^set(Error|Note|Message|Status|Text)$/;
// Short explicit allowlist: "path:text". Empty on purpose; add a line here only with a reason.
const ALLOW = new Set<string>([]);

function violations(file: string): string[] {
  const source = readFileSync(file, "utf8");
  const sf = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const out: string[] = [];
  const at = (n: ts.Node) =>
    sf.getLineAndCharacterOfPosition(n.getStart()).line + 1;
  const flag = (n: ts.Node, what: string, text: string) => {
    if (!ALLOW.has(`${rel(file)}:${text.trim()}`))
      out.push(`${rel(file)}:${at(n)} ${what}: "${text.trim()}"`);
  };
  const literal = (n: ts.Node): string | null =>
    ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)
      ? n.text
      : ts.isTemplateExpression(n)
        ? n.head.text + n.templateSpans.map((s) => s.literal.text).join("")
        : null;

  const visit = (n: ts.Node) => {
    if (ts.isJsxText(n) && hasLetters(n.text)) flag(n, "JSX text", n.text);
    if (
      ts.isJsxAttribute(n) &&
      TEXT_ATTRS.has(n.name.getText()) &&
      n.initializer
    ) {
      const init = ts.isJsxExpression(n.initializer)
        ? n.initializer.expression
        : n.initializer;
      const text = init ? literal(init) : null;
      if (text !== null && hasLetters(text))
        flag(n, `${n.name.getText()} literal`, text);
    }
    // {"text"} or {`text`} as a JSX child.
    if (
      ts.isJsxExpression(n) &&
      n.expression &&
      (ts.isJsxElement(n.parent) || ts.isJsxFragment(n.parent))
    ) {
      const text = literal(n.expression);
      if (text !== null && hasLetters(text)) flag(n, "JSX string child", text);
    }
    if (
      ts.isCallExpression(n) &&
      ts.isIdentifier(n.expression) &&
      TEXT_SETTERS.test(n.expression.text)
    ) {
      for (const arg of n.arguments) {
        const text = literal(arg);
        if (text !== null && hasLetters(text))
          flag(n, `${n.expression.text} literal`, text);
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return out;
}

describe("component source lint: copy cannot bypass copy.ts", () => {
  it("scans real component files", () => {
    expect(tsx.length).toBeGreaterThan(15);
  });

  it("no .tsx has user-visible string literals outside copy.ts", () => {
    expect(tsx.filter((f) => !isTest(f)).flatMap(violations)).toEqual([]);
  });

  it("the lint itself catches what it should", () => {
    const bad = `export const A = () => <p aria-label="Hello there">Plain text</p>;`;
    const sf = ts.createSourceFile(
      "x.tsx",
      bad,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    let jsxText = 0;
    let attr = 0;
    const walkNode = (n: ts.Node) => {
      if (ts.isJsxText(n) && hasLetters(n.text)) jsxText++;
      if (ts.isJsxAttribute(n) && TEXT_ATTRS.has(n.name.getText())) attr++;
      ts.forEachChild(n, walkNode);
    };
    walkNode(sf);
    expect([jsxText, attr]).toEqual([1, 1]);
  });
});

describe("design lint: no colour outside the Design.md §11 tokens", () => {
  const styled = files.filter(
    (f) =>
      /\.(tsx?|css)$/.test(f) &&
      !isTest(f) &&
      rel(f) !== join("app", "globals.css"),
  );
  const patterns: [string, RegExp][] = [
    [
      "hex colour",
      /(?<![\w&/])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])/,
    ],
    ["rgb()/rgba()", /\brgba?\s*\(/],
    ["hsl()/hsla()", /\bhsla?\s*\(/],
    ["oklch()/oklab()/color()", /\b(oklch|oklab|lch|lab|color)\s*\(/],
    [
      "gradient",
      /\b(linear|radial|conic|repeating-linear|repeating-radial)-gradient\b/,
    ],
    [
      "tailwind arbitrary colour",
      /\b(?:bg|text|border|fill|stroke|outline|ring|from|to|via|shadow|accent|caret|decoration|divide|placeholder)-\[(?:#|rgb|hsl|oklch|color:)/,
    ],
  ];

  it("scans real files", () => {
    expect(styled.length).toBeGreaterThan(20);
  });

  it.each(patterns)("no %s in app styles", (_name, re) => {
    const hits = styled
      .filter((f) => re.test(readFileSync(f, "utf8")))
      .map(rel);
    expect(hits).toEqual([]);
  });

  it("globals.css has exactly one gradient: the documented grey shimmer", () => {
    const css = readFileSync(join(SRC, "app", "globals.css"), "utf8");
    const gradients = css.match(/-gradient\(/g) ?? [];
    expect(gradients).toHaveLength(1);
    const skeleton = /\.skeleton\s*\{[^}]*linear-gradient\([^)]*\)/s.exec(css);
    expect(skeleton).not.toBeNull();
    // Grey only: neutral ramp tokens and the documented #d5d5d5.
    expect(skeleton![0]).toMatch(/var\(--ink-400\)/);
    expect(skeleton![0]).not.toMatch(
      /--accent|--info|--danger|--success|--warning/,
    );
  });
});
