import { parseHitokoto } from "../public/hitokoto.js";

// Fixed upstream: no user-provided host, headers, credentials, or redirects.
// Coalesce concurrent viewers and cache results to respect the community API.
export function createHitokotoService({ fetchImpl = fetch, now = Date.now } = {}) {
  let cached = null;
  let expires = 0;
  let inflight = null;

  async function getQuote() {
    if (cached && now() < expires) return cached;
    if (inflight) return inflight;

    inflight = (async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5500);
      timeout.unref?.();
      try {
        const response = await fetchImpl(
          "https://v1.hitokoto.cn/?encode=json&max_length=100",
          {
            signal: controller.signal,
            redirect: "error",
            headers: { Accept: "application/json" },
          },
        );
        if (!response.ok) throw new Error("Quote service unavailable.");
        const length = Number(response.headers?.get?.("content-length"));
        if (Number.isFinite(length) && length > 16_384) {
          throw new Error("Quote response is too large.");
        }
        const quote = parseHitokoto(await response.json());
        cached = quote;
        expires = now() + 5_000;
        return quote;
      } catch {
        // A known quote is preferable to losing the greeting during an outage.
        if (cached) return cached;
        throw Object.assign(new Error("暫時無法取得一言。"), { statusCode: 503 });
      } finally {
        clearTimeout(timeout);
        inflight = null;
      }
    })();

    return inflight;
  }

  return { getQuote };
}
