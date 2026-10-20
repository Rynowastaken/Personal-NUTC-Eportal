const EXPIRED_MESSAGE =
  /(?:驗證失敗|驗証失敗|連線可能逾期|連線.*(?:逾期|過期)|session\s*(?:expired|timed?\s*out)|re-?login|重新登入)/i;

export function isAisLoginExpiredMessage(value) {
  const message = String(value || "").replace(/\s+/g, " ").trim();
  return EXPIRED_MESSAGE.test(message) &&
    /(?:驗證失敗|驗証失敗|逾期|過期|expired|timed?\s*out|重新登入|re-?login)/i.test(message);
}

export function createAisLoginError() {
  const error = new Error(
    "AIS or ePortal session expired. Reconnect through ePortal to continue.",
  );
  error.code = "EPORTAL_LOGIN_REQUIRED";
  error.statusCode = 401;
  return error;
}

// AIS displays a JavaScript alert on expiry without necessarily redirecting
// away from ais.nutc.edu.tw. A dialog left open blocks Playwright navigation.
// Listen *before* visiting AIS and turn the alert into an actionable failure.
export function watchAisLoginExpiry(page) {
  let expired = false;
  const onDialog = async (dialog) => {
    if (isAisLoginExpiredMessage(dialog.message())) expired = true;
    // Equivalent to Playwright's default handling, but avoids a blocked page.
    await dialog.dismiss().catch(() => {});
  };
  page.on("dialog", onDialog);

  return {
    expired: () => expired,
    assertValid() {
      if (expired) throw createAisLoginError();
    },
  };
}
