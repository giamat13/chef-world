import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createServer } from "./server.js";
import { withKey } from "./lib/session.js";

const CORS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, DELETE, OPTIONS",
  "access-control-allow-headers": "content-type, accept, mcp-protocol-version, mcp-session-id, last-event-id",
  "access-control-expose-headers": "mcp-session-id",
};
const MAX_BODY = 512 * 1024; // abuse protection; import_recipes can carry up to 100 recipes

function withCors(res: Response): Response {
  const h = new Headers(res.headers);
  for (const [k, v] of Object.entries(CORS)) h.set(k, v);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h });
}

/**
 * Stateless Streamable HTTP: a fresh server + transport per request, no sessions.
 * The personal link (?key=...) is held only in memory for this request (AsyncLocalStorage) and never logged.
 */
export function handleMcp(request: Request): Promise<Response> {
  const key = new URL(request.url).searchParams.get("key") ?? "";
  return withKey(key, () => serve(request));
}

async function serve(request: Request): Promise<Response> {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (request.method !== "POST") {
    return withCors(
      new Response(JSON.stringify({ jsonrpc: "2.0", error: { code: -32000, message: "Method not allowed. Use POST (stateless server)." }, id: null }), {
        status: 405,
        headers: { "content-type": "application/json", allow: "POST, OPTIONS" },
      }),
    );
  }
  const len = Number(request.headers.get("content-length") ?? 0);
  if (len > MAX_BODY) return withCors(new Response("Payload too large", { status: 413 }));

  const server = createServer();
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  try {
    return withCors(await transport.handleRequest(request));
  } finally {
    // Close after the response has been produced; nothing is kept between requests.
    queueMicrotask(() => void server.close().catch(() => {}));
  }
}
