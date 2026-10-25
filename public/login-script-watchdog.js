(() => {
  "use strict";

  // Show a useful error when the login controller never runs (missing asset,
  // failed module dependency, syntax error, or stale partial deployment).
  // Other third-party failures, including Cloudflare analytics, are unrelated.
  const CONTROLLER_TIMEOUT_MS = 10_000;
  const relevantScript = /\/(?:server-login|login-route)\.js(?:\?|$)/;

  function showStartupFailure() {
    if (window.__nutcLoginBridgeBooted) return;

    const statusTitle = document.getElementById("statusTitle");
    const statusDot = document.getElementById("statusDot");
    const pageCard = document.getElementById("pageCard");
    const errorCard = document.getElementById("errorCard");
    const errorMessage = document.getElementById("errorMessage");
    const retryButton = document.getElementById("retryButton");
    if (!statusTitle || !errorCard || !errorMessage) return;

    statusTitle.textContent = "登入介面無法啟動";
    if (statusDot) statusDot.style.backgroundColor = "#f07178";
    pageCard?.classList.add("hidden");
    errorCard.classList.remove("hidden");
    errorMessage.textContent =
      "登入腳本未成功載入。請先按「重試登入」。若持續發生，請在伺服器更新程式並重新啟動服務，確認 /server-login.js 可以正常載入。";

    // The main script normally registers its own retry listener, but cannot do
    // so when it failed to load. Provide one independent of that controller.
    if (retryButton && !retryButton.dataset.fallbackRetry) {
      retryButton.dataset.fallbackRetry = "1";
      retryButton.addEventListener("click", () => {
        if (!window.__nutcLoginBridgeBooted) window.location.reload();
      });
    }
  }

  window.addEventListener("error", (event) => {
    const filename = event.filename || event.target?.src || "";
    if (relevantScript.test(filename)) showStartupFailure();
  }, true);

  window.setTimeout(showStartupFailure, CONTROLLER_TIMEOUT_MS);
})();
