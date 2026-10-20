// Only allow a known local destination after a completed login bridge.
// External "next" URLs would make the login page an open redirect.
export function loginRequestOptions(search = "") {
  const params = new URLSearchParams(search);
  return {
    force: params.get("force") === "1",
    next: params.get("next") === "/go/ais" ? "/go/ais" : "/",
  };
}
