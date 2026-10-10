import {
  PUBLIC_ASK_HEADERS,
  getPublicAskImage,
} from "../../../../../../server/ask-public";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string; itemId: string }> },
) {
  const { token, itemId } = await params;
  const r = await getPublicAskImage(token, itemId);
  if (!r.ok)
    return Response.json(r.body, {
      status: r.status,
      headers: PUBLIC_ASK_HEADERS,
    });
  return new Response(new Uint8Array(r.body.bytes), {
    status: 200,
    headers: { ...PUBLIC_ASK_HEADERS, "Content-Type": r.body.contentType },
  });
}
