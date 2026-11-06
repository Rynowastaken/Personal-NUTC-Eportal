const motion = window.NutcMotion;
const launchTitle = document.querySelector("#launchTitle");
const launchDescription = document.querySelector("#launchDescription");
const launchElapsed = document.querySelector("#launchElapsed");
const launchStage = document.querySelector("#launchStage");
const launchDetail = document.querySelector("#launchDetail");
const launchLog = document.querySelector("#launchLog");
const launchTarget = document.querySelector("#launchTarget");
const launchSpinner = document.querySelector("#launchSpinner");
const launchError = document.querySelector("#launchError");
const launchErrorTitle = document.querySelector("#launchErrorTitle");
const launchErrorMessage = document.querySelector("#launchErrorMessage");
const launchErrorRaw = document.querySelector("#launchErrorRaw");
const launchErrorRawText = document.querySelector("#launchErrorRawText");
const launchRetry = document.querySelector("#launchRetry");
const launchLogin = document.querySelector("#launchLogin");
const launchBack = document.querySelector("#launchBack");

const moduleId =
  location.pathname.match(/^\/go\/([a-z0-9-]+)$/)?.[1] || "";

// A launch opened by the rebuilt TronClass pages for a specific page (taking
// an exam, submitting homework) carries &to=<page>; the page that opened this
// tab keeps its handle and needs to know when the handoff starts.
const handoffTarget =
  new URLSearchParams(location.search).get("to") || "";

let startedAt = performance.now();
let elapsedTimer = null;
let lastStageKey = "";
let activeJobId = "";
let stopped = false;

const stageLabels = {
  queued: "request accepted",
  "profile-check": "profile check",
  "profile-lock": "profile lock",
  "browser-launch": "Chromium launch",
  "browser-ready": "browser ready",
  "dashboard-load": "ePortal dashboard",
  "session-valid": "session verified",
  "handoff-probe": "HTTP SSO probe",
  "handoff-browser": "browser discovery",
  "module-request": "module request",
  "handoff-captured": "handoff captured",
  "activity-relay": "Activity relay",
  ready: "ready",
  error: "error",
};

// Same named failures and recovery copy as the server login page; the raw
// Playwright text is kept for the collapsed technical detail only.
function describeLaunchError(message, code) {
  if (/Executable doesn't exist|playwright install|browser executable[^\n]*not found/i.test(message)) {
    return {
      code: "EPORTAL_BROWSER_NOT_INSTALLED",
      title: "伺服器缺少 Chromium",
      message: "登入服務缺少 Playwright Chromium。請在伺服器的專案目錄執行 npx playwright install chromium，再按「重試」。",
    };
  }
  if (/Host system is missing dependencies|error while loading shared libraries/i.test(message)) {
    return {
      code: "EPORTAL_BROWSER_DEPENDENCIES_MISSING",
      title: "伺服器缺少 Chromium 函式庫",
      message: "登入服務缺少 Chromium 系統函式庫。請由伺服器管理員安裝 Playwright 的系統依賴（npx playwright install-deps chromium）。",
    };
  }
  if (code === "EPORTAL_LOGIN_REQUIRED") {
    return { code, title: "需要登入 Server ePortal", message };
  }
  return { code, title: "無法開啟", message };
}

function isRawError(message) {
  return message.length > 160 || /\n|╔|Executable doesn't exist|at .+:\d+:\d+/.test(message);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
    ...options,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(
      data.error || `Request failed (${response.status})`,
    );
    error.code = data.code || "";
    throw error;
  }

  return data;
}

function startElapsedClock() {
  startedAt = performance.now();
  clearInterval(elapsedTimer);

  const update = () => {
    launchElapsed.textContent =
      ((performance.now() - startedAt) / 1000).toFixed(1) + "s";
  };

  update();
  elapsedTimer = window.setInterval(update, 100);
}

function stopElapsedClock() {
  clearInterval(elapsedTimer);
  elapsedTimer = null;
}

function appendLog(stage, detail, elapsedMs = null) {
  const key = stage + "\n" + detail;
  if (key === lastStageKey) return;
  lastStageKey = key;

  const item = document.createElement("li");
  item.className =
    "grid grid-cols-[auto_1fr] gap-3 rounded-[5px] border border-white/[.08] bg-white/[.035] px-3 py-2.5";

  const time = document.createElement("span");
  time.className =
    "pt-0.5 text-[10px] font-semibold tabular-nums text-[var(--faint)]";
  const seconds =
    elapsedMs == null
      ? (performance.now() - startedAt) / 1000
      : elapsedMs / 1000;
  time.textContent = seconds.toFixed(1) + "s";

  const body = document.createElement("span");
  body.className = "min-w-0";

  const name = document.createElement("strong");
  name.className =
    "block text-xs font-semibold text-[var(--foreground)]";
  name.textContent = stageLabels[stage] || stage;

  const copy = document.createElement("span");
  copy.className =
    "mt-0.5 block text-[11px] font-medium leading-5 text-[var(--muted)] [overflow-wrap:anywhere]";
  copy.textContent = detail;

  body.append(name, copy);
  item.append(time, body);
  launchLog.append(item);
  item.scrollIntoView({ block: "nearest" });

  void motion?.enter?.(item, {
    duration: 220,
    y: 5,
    scale: 0.995,
  });
}

function renderJob(job) {
  if (job.module) {
    launchTitle.textContent = `開啟 ${job.module.shortName}`;
    launchDescription.textContent =
      job.module.description ||
      "Creating a secure server-side ePortal handoff for this browser.";
    document.title = `開啟 ${job.module.shortName} · NUTC Portal`;
  }

  launchStage.textContent = stageLabels[job.stage] || job.stage;
  if (job.state === "error") {
    showError(
      job.error?.message || job.detail || "Module launch failed.",
      job.error?.code || "",
    );
    return;
  }
  launchDetail.textContent =
    job.detail || "Server-side launch work is in progress.";

  if (job.target) {
    launchTarget.textContent = `目標：${job.target}`;
  }

  appendLog(job.stage, job.detail || "", job.elapsedMs);
}

function showError(rawMessage, rawCode = "") {
  if (stopped) return;
  stopped = true;
  const raw = String(rawMessage || "");
  const { code, title, message } = describeLaunchError(raw, rawCode);
  const showRaw = message === raw ? isRawError(raw) : true;
  stopElapsedClock();
  launchSpinner.querySelector("svg")?.classList.remove("animate-spin");
  launchSpinner.querySelector("svg:not(.launch-failed-icon)")?.classList.add("hidden");
  launchSpinner.querySelector(".launch-failed-icon")?.classList.remove("hidden");
  launchSpinner.classList.add("border-[#f07178]/30", "bg-[#f07178]/[.10]", "text-[#f4a0a5]");
  launchStage.textContent = "錯誤";
  launchStage.classList.remove("text-[var(--accent)]");
  launchStage.classList.add("text-[#f4a0a5]");
  launchErrorTitle.textContent = title;
  launchErrorMessage.textContent = message === raw && showRaw
    ? "伺服器回傳了未預期的錯誤。請展開下方的技術細節，或檢查伺服器日誌。"
    : message;
  launchErrorRawText.textContent = showRaw ? raw : "";
  launchErrorRaw.classList.toggle("hidden", !showRaw);
  launchErrorRaw.open = false;
  launchDetail.textContent = title + "。";
  launchError.classList.remove("hidden");
  launchLogin.classList.toggle(
    "hidden",
    code !== "EPORTAL_LOGIN_REQUIRED",
  );
  void motion?.enter?.(launchError, {
    duration: 240,
    y: 8,
    scale: 0.985,
  });
}

function continueReadyJob(jobId) {
  stopElapsedClock();
  launchSpinner.querySelector("svg")?.classList.remove("animate-spin");
  launchStage.textContent = "transferring";
  launchDetail.textContent =
    "The one-time SSO handoff is ready. Navigating this browser through the protected continuation route.";
  appendLog(
    "ready",
    "Handoff ready; transferring control without exposing SSO material in the loading UI.",
  );

  if (handoffTarget) {
    try {
      // This tab is about to enter the school's SSO and then TronClass itself;
      // it has no reason to keep a handle on the authenticated portal.
      window.opener = null;
    } catch {
      // Already detached; nothing to drop.
    }
  }

  location.replace(
    `/launch-job/${encodeURIComponent(jobId)}/continue`,
  );
}

async function pollJob(jobId) {
  while (!stopped) {
    const data = await request(
      `/api/launch-job/${encodeURIComponent(jobId)}`,
    );
    const job = data.job;
    renderJob(job);

    if (job.state === "ready") {
      continueReadyJob(jobId);
      return;
    }

    if (job.state === "error") return;
    await sleep(250);
  }
}

async function startLaunch() {
  stopped = false;
  activeJobId = "";
  lastStageKey = "";
  launchLog.replaceChildren();
  launchError.classList.add("hidden");
  launchErrorRaw.classList.add("hidden");
  launchLogin.classList.add("hidden");
  launchStage.classList.remove("text-[#f4a0a5]");
  launchStage.classList.add("text-[var(--accent)]");
  launchSpinner.querySelector(".launch-failed-icon")?.classList.add("hidden");
  launchSpinner.querySelector("svg:not(.launch-failed-icon)")?.classList.remove("hidden");
  launchSpinner.classList.remove("border-[#f07178]/30", "bg-[#f07178]/[.10]", "text-[#f4a0a5]");
  launchSpinner.querySelector("svg")?.classList.add("animate-spin");
  launchTarget.textContent = "";
  startElapsedClock();

  appendLog(
    "queued",
    `POST /api/launch/${moduleId || "unknown"} — requesting a progress-tracked launch job.`,
    0,
  );

  try {
    if (!moduleId) {
      throw new Error("The module ID is missing from this launch URL.");
    }

    const data = await request(
      `/api/launch/${encodeURIComponent(moduleId)}`,
      {
        method: "POST",
        ...(handoffTarget
          ? { body: JSON.stringify({ to: handoffTarget }) }
          : {}),
      },
    );

    activeJobId = data.job.id;
    renderJob(data.job);
    await pollJob(activeJobId);
  } catch (error) {
    showError(error?.message || String(error), error?.code || "");
  }
}

launchRetry.addEventListener("click", () => {
  void startLaunch();
});

launchLogin.addEventListener("click", () => {
  location.assign("/server-login/");
});

launchBack.addEventListener("click", () => {
  location.assign("/");
});

(async () => {
  await window.NutcTheme.init();
  window.lucide?.createIcons?.();
  void motion?.enter?.(document.querySelector("main > section"), {
    duration: 300,
    y: 10,
    scale: 0.985,
  });
  await startLaunch();
})();
