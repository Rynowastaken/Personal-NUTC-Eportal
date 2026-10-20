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
