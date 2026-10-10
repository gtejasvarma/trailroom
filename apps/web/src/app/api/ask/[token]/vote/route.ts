import {
  PUBLIC_ASK_HEADERS,
  voteOnAsk,
} from "../../../../../server/ask-public";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { result, setCookie } = await voteOnAsk(
    (await params).token,
    request,
    process.env.NODE_ENV === "production",
  );
  const headers = new Headers(PUBLIC_ASK_HEADERS);
  if (setCookie) headers.append("Set-Cookie", setCookie);
  return Response.json(result.body, { status: result.status, headers });
}
