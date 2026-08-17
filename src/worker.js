/** Cloudflare Worker entry so `wrangler deploy` can publish the Vite `dist` assets. */
export default {
  async fetch(request, env) {
    return env.ASSETS.fetch(request);
  },
};
