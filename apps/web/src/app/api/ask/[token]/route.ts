import {
  PUBLIC_ASK_HEADERS,
  getPublicAsk,
} from "../../../../server/ask-public";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const r = await getPublicAsk((await params).token, request);
  return Response.json(r.body, {
    status: r.status,
    headers: PUBLIC_ASK_HEADERS,
  });
}
