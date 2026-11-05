// Cloudflare Workers entry. /mcp is the connector; / is a plain hint page.
import { handleMcp } from "./handler.js";

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/mcp") return handleMcp(request);
    if (url.pathname === "/") {
      return new Response("Chef World connector. Connect it from Chef World: sign in, click 'Connect Claude', and paste that link into claude.ai.\n", {
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }
    return new Response("Not found", { status: 404 });
  },
};
