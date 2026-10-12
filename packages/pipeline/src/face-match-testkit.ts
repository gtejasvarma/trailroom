// Test-only: a local HTTP server that stands in for the face-match service, so the gate and the
// client are tested over real HTTP. Never imported by product code.
import { createServer, type IncomingMessage, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import sharp from "sharp";

export interface FakeFaceRequest {
  authorization: string | undefined;
  person: Buffer;
  render: Buffer;
}

/** What the fake answers. `status` other than 200 sends an error with no body. */
export type FakeFaceAnswer =
  | {
      status?: 200;
      personFace?: boolean;
      renderFace?: boolean;
      probability?: number;
    }
  | { status: number }
  | { hang: true };

export interface FakeFaceServer {
  url: string;
  requests: FakeFaceRequest[];
  /** Decides every answer. Receives the request and a 1-based count of calls so far. */
  answer: (
    fn: (
      req: FakeFaceRequest,
      n: number,
    ) => FakeFaceAnswer | Promise<FakeFaceAnswer>,
  ) => void;
  close(): Promise<void>;
}

async function body(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  return Buffer.concat(chunks);
}

export async function startFakeFaceServer(): Promise<FakeFaceServer> {
  const requests: FakeFaceRequest[] = [];
  let decide: Parameters<FakeFaceServer["answer"]>[0] = () => ({
    probability: 0.9,
  });
  const sockets = new Set<import("node:net").Socket>();
  const server: Server = createServer(async (req, res) => {
    if (req.url !== "/match" || req.method !== "POST") {
      res.writeHead(404).end();
      return;
    }
    const raw = await body(req);
    const form = await new Response(new Uint8Array(raw), {
      headers: { "content-type": String(req.headers["content-type"]) },
    }).formData();
    const bytes = async (k: string) =>
      Buffer.from(await (form.get(k) as Blob).arrayBuffer());
    const r: FakeFaceRequest = {
      authorization: req.headers.authorization,
      person: await bytes("person"),
      render: await bytes("render"),
    };
    requests.push(r);
    const a = await decide(r, requests.length);
    if ("hang" in a) return; // never answers: the client's timeout ends it
    if (a.status !== undefined && a.status !== 200) {
      res.writeHead(a.status).end();
      return;
    }
    const ok = a as Exclude<
      FakeFaceAnswer,
      { status: number } | { hang: true }
    >;
    const personFace = ok.personFace ?? true;
    const renderFace = ok.renderFace ?? true;
    const both = personFace && renderFace;
    const probability = both ? (ok.probability ?? 0.9) : null;
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({
        person_face_found: personFace,
        render_face_found: renderFace,
        distance: both ? 0.6 : null,
        probability,
      }),
    );
  });
  server.on("connection", (s) => {
    sockets.add(s);
    s.on("close", () => sockets.delete(s));
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    requests,
    answer: (fn) => {
      decide = fn;
    },
    close: () =>
      new Promise<void>((r) => {
        for (const s of sockets) s.destroy();
        server.close(() => r());
      }),
  };
}

/**
 * Which pose the render provider's fake image is for: its block starts 90 px further right for
 * each pose, so the first column that differs from the background colour says which.
 */
export async function poseOfFakeRender(render: Buffer): Promise<string> {
  const { data, info } = await sharp(render)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const row = 500;
  const red = (x: number) => data[(row * info.width + x) * 3]!;
  const bg = red(0);
  let x = 0;
  while (x < info.width && red(x) === bg) x++;
  const idx = Math.round((x - 120) / 90);
  return ["front", "three-quarter", "walking", "seated"][idx] ?? "unknown";
}
