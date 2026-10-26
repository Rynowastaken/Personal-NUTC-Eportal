// Classify unexpected upstream pages without ever logging or copying
// credentials, cookies, tokens, or a full university HTML response.
export function classifyEportalLoginFailure({ status = 0, text = "" } = {}) {
  const body = String(text || "").slice(0, 2000);
  const statusCode = Number(status);

  if (/checkLicense\s*\(\s*["']?OAKlouds["']?\s*\)\s*is\s*failed/i.test(body) ||
      (/checkLicense/i.test(body) && /failed/i.test(body))) {
    return {
      code: "EPORTAL_UPSTREAM_UNAVAILABLE",
      message: "校方 ePortal 目前回傳系統授權驗證失敗（OAKlouds），未提供正常登入表單。請待校方恢復服務後再試，無須變更帳號或密碼。",
    };
  }

  if ([500, 502, 503, 504, 521, 522, 523, 524].includes(statusCode)) {
    return {
      code: "EPORTAL_UPSTREAM_UNAVAILABLE",
      message: `校方 ePortal 伺服器目前回應 HTTP ${statusCode}，登入服務可能暫時無法使用。請稍後重試。`,
    };
  }

  if (/service\s+(?:temporarily\s+)?unavailable|bad gateway|gateway\s+time-?out|under maintenance|系統維護中|暫停服務|服務暫停|系統授權驗證失敗/i.test(body)) {
    return {
      code: "EPORTAL_UPSTREAM_UNAVAILABLE",
      message: "校方 ePortal 目前顯示服務異常或維護訊息，無法提供正常登入表單。請稍後重試。",
    };
  }

  // An unknown page is not necessarily an outage; the university could
  // have redesigned login fields. Let the caller keep its unsupported-page
  // diagnosis rather than incorrectly claiming the service is down.
  return null;
}
