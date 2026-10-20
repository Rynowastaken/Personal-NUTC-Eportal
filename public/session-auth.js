// A busy browser profile or a temporary network error is not proof of logout.
// Only confirmed server status should automatically open Login Bridge.
export function needsInteractiveLogin(status) {
  return status?.status === "needs-login" ||
    status?.status === "not-configured" ||
    (status?.needsLogin === true &&
      status?.status !== "busy" && status?.status !== "error");
}

export function isSessionExpiredError(error) {
  return error?.code === "EPORTAL_LOGIN_REQUIRED" ||
    error?.code === "AIS_SESSION_EXPIRED";
}

export function shouldAutoOpenLogin(status, lastRedirectAt, now = Date.now()) {
  if (!needsInteractiveLogin(status)) return false;
  const previous = Number(lastRedirectAt);
  // Avoid redirect loops when the university is temporarily slow or the
  // user returns from Login Bridge before the server session is usable.
  return !Number.isFinite(previous) || now < previous ||
    now - previous >= 2 * 60_000;
}
