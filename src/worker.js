/** Cloudflare Worker entry that serves the Vite `dist` assets. */
export default {
  async fetch(request, env) {
    return env.ASSETS.fetch(request);
  },
};
