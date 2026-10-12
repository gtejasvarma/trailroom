// The Google-signed ID token the app presents to the private face-match service on Cloud Run
// (the service is deployed with --no-allow-unauthenticated, so Cloud Run IAM checks the token's
// audience, which must be the service's URL, and that the caller holds roles/run.invoker). The
// pipeline package takes this as an injected function, so it needs no auth library of its own.
// A local URL (the service run in Docker, or a test's fake server) gets no token.
import { GoogleAuth } from "google-auth-library";

interface IdTokenSource {
  getIdTokenClient(audience: string): Promise<{
    idTokenProvider: { fetchIdToken(audience: string): Promise<string> };
  }>;
}

export const isLocalUrl = (url: string): boolean => {
  try {
    const h = new URL(url).hostname;
    return (
      h === "localhost" || h === "127.0.0.1" || h === "[::1]" || h === "::1"
    );
  } catch {
    return false;
  }
};

let shared: IdTokenSource | undefined;

export function faceMatchTokenProvider(
  auth?: IdTokenSource,
): (audience: string) => Promise<string | undefined> {
  return async (audience) => {
    if (isLocalUrl(audience)) return undefined;
    const source =
      auth ?? (shared ??= new GoogleAuth() as unknown as IdTokenSource);
    const client = await source.getIdTokenClient(audience);
    return client.idTokenProvider.fetchIdToken(audience);
  };
}
