// /landed and everything under it is Landed, forwarded (src/lib/landed-proxy.ts).
import { proxyToLanded } from "@/lib/landed-proxy";

// Some of Landed's calls take a while (reading a deck, scoring an answer): allow two minutes.
export const maxDuration = 120;

export function GET(request: Request): Promise<Response> {
  return proxyToLanded(request);
}
export function HEAD(request: Request): Promise<Response> {
  return proxyToLanded(request);
}
export function POST(request: Request): Promise<Response> {
  return proxyToLanded(request);
}
export function PUT(request: Request): Promise<Response> {
  return proxyToLanded(request);
}
export function PATCH(request: Request): Promise<Response> {
  return proxyToLanded(request);
}
export function DELETE(request: Request): Promise<Response> {
  return proxyToLanded(request);
}
export function OPTIONS(request: Request): Promise<Response> {
  return proxyToLanded(request);
}
