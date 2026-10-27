// Map only known server-side login failures to safe, actionable client messages.
// Never echo raw Playwright errors: they can include local paths or browser data.
export function describeLoginBridgeError(error) {
  const message = String(error?.message || "");
  if (error?.code === "EPORTAL_LOGIN_BRIDGE_START_FAILED") {
    if (/Executable doesn't exist|please run[^\n]*playwright install|browser executable[^\n]*not found/i.test(message)) {
      return {
        status: 503,
        code: "EPORTAL_BROWSER_NOT_INSTALLED",
        message: "登入服務缺少 Playwright Chromium。請在伺服器的專案目錄執行 npx playwright install chromium，再按「重試登入」。",
      };
    }
    if (/Host system is missing dependencies|error while loading shared libraries|libnss3\.so|libatk-[\w.-]+\.so|libX11\.so/i.test(message)) {
      return {
        status: 503,
        code: "EPORTAL_BROWSER_DEPENDENCIES_MISSING",
        message: "登入服務缺少 Chromium 系統函式庫。請由伺服器管理員檢查並安裝 Playwright 的系統依賴（npx playwright install-deps chromium）。",
      };
    }
    if (/net::ERR_|Navigation timeout|page\.goto: Timeout|Timeout \d+ms exceeded/i.test(message)) {
      return {
        status: 503,
        code: "EPORTAL_LOGIN_BRIDGE_START_FAILED",
        message: "登入服務無法連線至校方 ePortal，或載入登入頁時逾時。請稍後重試並檢查伺服器網路連線。",
      };
    }
    return {
      status: 503,
      code: "EPORTAL_LOGIN_BRIDGE_START_FAILED",
      message: "伺服器無法啟動 ePortal 登入瀏覽器。請檢查伺服器日誌中的 [login-bridge] startup failed 記錄及 Playwright/Chromium 安裝狀態。",
    };
  }

  return {
    status: 500,
    code: "EPORTAL_LOGIN_BRIDGE_FAILED",
    message: "登入操作發生伺服器端錯誤。請重試；如持續失敗，請管理員檢查伺服器日誌中的登入錯誤。",
  };
}
