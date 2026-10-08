import { NextResponse, type NextRequest } from "next/server";
import {
  GATE_COOKIE,
  GATE_MAX_AGE_SECONDS,
  constantTimeEqual,
  readGateConfig,
  signGateCookie,
} from "@/lib/gate";
import { clientKey, createAttemptLimiter } from "@/lib/gate-limit";
import { copy } from "@/lib/copy";

// Per instance only (see gate-limit.ts): Cloud Armor is the real rate limit.
const limiter = createAttemptLimiter();

// A relative Location, resolved by the browser against the page it posted from. Behind App
// Hosting's proxy a route handler's own URL is the container's (https://0.0.0.0:8080), so an
// absolute redirect built from it sends the browser nowhere. 303 turns the POST into a GET.
function back(path: string, search = "") {
  return new NextResponse(null, {
    status: 303,
    headers: { Location: path + search },
  });
}

export async function POST(request: NextRequest) {
  const key = clientKey(request.headers);
  if (limiter.blocked(key)) {
    return new Response(copy.gate.tooMany, {
      status: 429,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Retry-After": "600",
      },
    });
  }
  const config = readGateConfig(process.env);
  const form = await request.formData().catch(() => null);
  const attempt = form?.get("password");

  if (
    !config ||
    typeof attempt !== "string" ||
    !(await constantTimeEqual(attempt, config.password))
  ) {
    limiter.recordFailure(key);
    return back("/gate", "?error=1");
  }

  // Always lands on "/" so there is no redirect target for an attacker to control.
  const res = back("/");
  res.cookies.set(
    GATE_COOKIE,
    await signGateCookie(config.secret, config.password),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: GATE_MAX_AGE_SECONDS,
    },
  );
  return res;
}
