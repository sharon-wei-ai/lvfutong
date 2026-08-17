import { buildFeed } from "./crawl.js";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/refresh") {
      if (request.method !== "POST" && request.method !== "GET") {
        return new Response("method not allowed", { status: 405 });
      }
      try {
        const feed = await buildFeed();
        return new Response(JSON.stringify(feed), {
          headers: {
            "content-type": "application/json; charset=utf-8",
            "cache-control": "no-store",
          },
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: String(err.message || err) }), {
          status: 500,
          headers: { "content-type": "application/json; charset=utf-8" },
        });
      }
    }
    return env.ASSETS.fetch(request);
  },
};
