// Only allow a known local destination after a completed login bridge.
// External "next" URLs would make the login page an open redirect.
const ALLOWED_NEXT_PATHS = new Set(["/go/ais", "/ais", "/tronclass"]);

export function loginRequestOptions(search = "") {
  const params = new URLSearchParams(search);
  const nextParam = params.get("next");
  return {
    force: params.get("force") === "1",
    next: ALLOWED_NEXT_PATHS.has(nextParam) ? nextParam : "/",
  };
}
