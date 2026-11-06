// Interstitial for pages that open on TronClass itself (exam taking with its
// anti-cheat, homework submission). The tab running the ePortal SSO still
// holds a handle on the portal tab; drop it before TronClass's page loads so
// nothing on that side can navigate the authenticated portal, then replace
// this page with the requested address.
(() => {
  "use strict";

  try {
    window.opener = null;
  } catch {
    // Already detached; nothing to drop.
  }

  const target = new URLSearchParams(location.search).get("to") || "";
  let url = null;
  try {
    url = new URL(target);
  } catch {
    url = null;
  }

  if (!url || url.protocol !== "https:" || url.origin !== "https://tc.nutc.edu.tw") {
    document.title = "無法開啟 TronClass";
    document.querySelector("p").textContent = "這個頁面不是有效的 TronClass 網址。";
    return;
  }

  location.replace(url.href);
})();
