import { defineConfig } from "vite";
import { refreshFeed } from "./scripts/refresh.mjs";

export default defineConfig({
  build: {
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    host: true,
  },
  preview: {
    port: 4173,
    host: true,
  },
  plugins: [
    {
      name: "daily-feed",
      configureServer(server) {
        server.middlewares.use("/api/refresh", async (req, res) => {
          if (req.method !== "POST" && req.method !== "GET") {
            res.statusCode = 405;
            res.end("method not allowed");
            return;
          }
          try {
            const feed = await refreshFeed();
            res.setHeader("Content-Type", "application/json; charset=utf-8");
            res.end(JSON.stringify(feed));
          } catch (err) {
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json; charset=utf-8");
            res.end(JSON.stringify({ error: String(err.message || err) }));
          }
        });
      },
    },
  ],
});
