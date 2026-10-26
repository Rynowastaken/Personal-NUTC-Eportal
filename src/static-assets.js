// Cache policy for content-addressed vendor files versus replaceable portal UI.
// CSS and JS filenames can remain identical across deployments.
export function staticCacheControl(relative, extension) {
  if (!relative.startsWith("vendor/") &&
      [".html", ".js", ".css"].includes(extension)) {
    return "no-store";
  }
  if (!relative.startsWith("vendor/")) return "no-cache";
  return "public, max-age=31536000, immutable";
}

// Every server restart receives a fresh asset revision. Stamp local scripts and
// styles so a stale mobile browser can't mix versions from different deploys.
// Escape revision values and avoid modifying external URLs or other attributes.
export function stampHtmlAssetRevision(html, revision) {
  const suffix = encodeURIComponent(String(revision));
  return String(html).replace(
    /\b(src|href)="(\/[^"]+\.(?:css|js))(\?[^"]*)?"/g,
    (_match, attribute, uri, query = "") => {
      const join = query ? "&" : "?";
      return attribute + '="' + uri + query + join + "build=" + suffix + '"';
    },
  );
}
