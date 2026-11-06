// The ePortal handoff ends on TronClass's ticket login, whose redirect sends
// every browser to TronClass's own home page. When the student asked for a
// specific page (an exam, a homework), point that redirect at the page
// instead, so the browser lands there directly and never shows the home page
// first.

export const TRONCLASS_ORIGIN = "https://tc.nutc.edu.tw";

export function applyTronclassLanding(handoff, rawTarget) {
  if (!handoff || handoff.type !== "get" || typeof handoff.url !== "string") {
    return handoff;
  }
  if (typeof rawTarget !== "string" || !rawTarget) return handoff;

  let url;
  let target;

  try {
    url = new URL(handoff.url);
    target = new URL(rawTarget);
  } catch {
    return handoff;
  }

  if (url.origin !== TRONCLASS_ORIGIN || !/^\/login(?:\/|$)/.test(url.pathname)) {
    return handoff;
  }
  if (target.origin !== TRONCLASS_ORIGIN) return handoff;

  url.searchParams.set("next", target.pathname + target.search);
  // The fragment never reaches a server but the browser carries it across the
  // school's redirects, so the single-page app opens the exact tab.
  url.hash = target.hash;

  return { ...handoff, url: url.toString() };
}
