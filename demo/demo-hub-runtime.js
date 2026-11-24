// Static GitHub Pages runtime for demo hubs: injects theme defaults synced with
// Dashboard settings, renders the top hub switcher ribbon, intercepts external links,
// and routes every hub API request strictly to an in-browser fixture handler.

const DEFAULT_TOKENS = {
  "--foreground": "#f7f1f6",
  "--muted": "rgba(247,241,246,.56)",
  "--faint": "rgba(247,241,246,.38)",
  "--primary": "#f0a8c8",
  "--accent": "#e8b86d",
  "--secondary": "#51314a",
  "--danger": "#f07178",
  "--primary-soft": "rgba(240,168,200,.14)",
  "--primary-ring": "rgba(240,168,200,.42)",
  "--control-bg": "#f0a8c8",
  "--control-border": "rgba(240,168,200,.72)",
  "--control-text": "#17121b",
  "--control-hover-bg": "#e8b86d",
  "--control-hover-border": "rgba(232,184,109,.78)",
  "--control-hover-text": "#17121b",
};

const SCHEMES = {
  tonalSpot: 343,
  vibrant: 338,
  expressive: 274,
  fidelity: 345,
  content: 326,
  monochrome: 0,
  neutral: 320,
  rainbow: 200,
  fruitSalad: 42,
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function applyDemoTheme() {
  const root = document.documentElement;
  for (const [name, value] of Object.entries(DEFAULT_TOKENS)) {
    root.style.setProperty(name, value);
  }
  try {
    const saved = JSON.parse(localStorage.getItem("nutc-portal-demo-features-v1") || "null");
    if (!saved || typeof saved !== "object") return;
    const hue = Object.prototype.hasOwnProperty.call(SCHEMES, saved.scheme)
      ? SCHEMES[saved.scheme]
      : SCHEMES.tonalSpot;
    const colorfulness = Number.isFinite(saved.colorfulness) ? clamp(saved.colorfulness, 0.5, 1.5) : 1;
    const brightness = Number.isFinite(saved.themeBrightness) ? clamp(saved.themeBrightness, 0.5, 1.5) : 1;
    const sat = saved.scheme === "monochrome" ? 0 : colorfulness * (saved.scheme === "neutral" ? 22 : 57);
    const light = clamp(Math.round(74 * brightness), 35, 92);
    const primary = `hsl(${hue} ${sat}% ${light}%)`;
    const soft = `hsl(${hue} ${sat}% ${light}% / 0.14)`;
    const ring = `hsl(${hue} ${sat}% ${light}% / 0.42)`;
    const secondarySat = saved.scheme === "monochrome" ? 0 : Math.min(36, Math.round(sat * 0.42));
    const secondary = `hsl(${hue} ${secondarySat}% ${clamp(Math.round(25 * brightness), 16, 36)}%)`;
    const accentHue = (hue + 48) % 360;
    const accent = `hsl(${accentHue} ${saved.scheme === "monochrome" ? 0 : Math.min(68, Math.round(sat * 1.05))}% ${clamp(Math.round(72 * brightness), 45, 86)}%)`;

    root.style.setProperty("--primary", primary);
    root.style.setProperty("--primary-soft", soft);
    root.style.setProperty("--primary-ring", ring);
    root.style.setProperty("--secondary", secondary);
    root.style.setProperty("--accent", accent);
    root.style.setProperty("--control-bg", primary);
    root.style.setProperty("--control-border", `hsl(${hue} ${sat}% ${light}% / 0.72)`);
    root.style.setProperty("--control-hover-bg", accent);
    root.style.setProperty("--control-hover-border", `hsl(${accentHue} ${saved.scheme === "monochrome" ? 0 : 65}% 68% / 0.78)`);
  } catch {
    // Ignore storage read failures in private contexts.
  }
}

function mountDemoRibbon(currentHub) {
  const ribbon = document.createElement("div");
  ribbon.className = "demo-hub-ribbon";
  ribbon.setAttribute("role", "region");
  ribbon.setAttribute("aria-label", "示範導覽列");

  const inner = document.createElement("div");
  inner.className = "demo-hub-ribbon-in";

  const badge = document.createElement("span");
  badge.className = "demo-hub-badge";
  const dot = document.createElement("span");
  dot.className = "demo-hub-dot";
  const wide = document.createElement("span");
  wide.className = "demo-hub-badge-wide";
  wide.textContent = " MODE";
  badge.append(dot, document.createTextNode("DEMO"), wide);

  const nav = document.createElement("nav");
  nav.className = "demo-hub-links";
  nav.setAttribute("aria-label", "切換示範模組");

  const items = [
    ["home", "← Dashboard", "./index.html"],
    ["ais", "學生管理", "./ais.html"],
    ["tronclass", "TronClass", "./tronclass.html"],
    ["library", "圖書館", "./library.html"],
  ];

  for (const [key, label, href] of items) {
    const link = document.createElement("a");
    link.href = href;
    link.textContent = label;
    if (key === currentHub) link.setAttribute("aria-current", "page");
    nav.append(link);
  }

  inner.append(badge, nav);
  ribbon.append(inner);
  document.body.prepend(ribbon);
}

function createToast() {
  const node = document.createElement("div");
  node.className = "demo-hub-toast";
  node.setAttribute("role", "status");
  node.setAttribute("aria-live", "polite");
  document.body.append(node);

  let timer = null;
  return (message) => {
    node.textContent = message;
    node.classList.add("visible");
    clearTimeout(timer);
    timer = setTimeout(() => node.classList.remove("visible"), 2800);
  };
}

async function readRequestBody(input, init) {
  if (init?.body != null) {
    if (typeof init.body === "string") {
      try {
        return JSON.parse(init.body);
      } catch {
        return null;
      }
    }
    return init.body;
  }
  if (typeof Request !== "undefined" && input instanceof Request) {
    try {
      const text = await input.clone().text();
      return text ? JSON.parse(text) : null;
    } catch {
      return null;
    }
  }
  return null;
}

export function initDemoHub({ hub, fontUrl, apiHandler }) {
  applyDemoTheme();
  mountDemoRibbon(hub);
  const showToast = createToast();

  globalThis.NutcTheme = {
    init() {
      return Promise.resolve();
    },
  };

  globalThis.__NUTC_DEMO__ = {
    enabled: true,
    hub,
    homeHref: "./index.html",
    fontUrl,
    onExternalLink(label) {
      showToast(`示範模式：不開啟真實「${label || "外部校務"}」連線。`);
    },
  };

  // Capture clicks on classic/external/SSO/mock-download anchors before hub listeners run.
  document.addEventListener(
    "click",
    (event) => {
      const link = event.target.closest("a[href]");
      if (!link) return;
      const rawHref = link.getAttribute("href") || "";
      if (rawHref.startsWith("blob:")) return;

      if (rawHref === "#demo-download" || rawHref.includes("/uploads/reference/")) {
        event.preventDefault();
        event.stopImmediatePropagation();
        showToast("示範模式：已模擬下載檔案（未連線校方伺服器）。");
        return;
      }

      const isBlockedPath =
        link.hasAttribute("data-classic") ||
        rawHref.startsWith("#demo-external") ||
        /^\/(go|library\/open)\//.test(rawHref) ||
        rawHref.includes("nutc.edu.tw") ||
        rawHref.includes("sirsidynix.net") ||
        rawHref.startsWith("https://example.edu.tw");

      if (isBlockedPath) {
        event.preventDefault();
        event.stopImmediatePropagation();
        const label = link.textContent?.trim() || "校方系統";
        showToast(`示範模式：${label} 為公開展示，不連線真實校務系統。`);
      }
    },
    true,
  );

  // Offline-only fetch shim; never issues real network requests from demo hubs.
  globalThis.fetch = async (input, init = {}) => {
    const rawUrl = typeof input === "string" ? input : input?.url || "";
    const url = new URL(rawUrl, location.href);
    const method = String(init?.method || (typeof Request !== "undefined" && input instanceof Request ? input.method : "GET")).toUpperCase();
    const body = await readRequestBody(input, init);
    const delayMs = url.pathname.includes("/ai/ask") ? 260 : 28;

    await new Promise((resolve, reject) => {
      const signal = init?.signal;
      if (signal?.aborted) {
        reject(new DOMException("Aborted", "AbortError"));
        return;
      }
      const timer = setTimeout(() => {
        signal?.removeEventListener("abort", onAbort);
        resolve();
      }, delayMs);
      const onAbort = () => {
        clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      };
      signal?.addEventListener("abort", onAbort, { once: true });
    });

    const result = await apiHandler(method, url, body);
    const status = result?.status ?? 200;
    const payload = result && Object.prototype.hasOwnProperty.call(result, "body")
      ? result.body
      : result;

    if (payload == null) {
      return new Response("", { status, headers: { "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify(payload), {
      status,
      headers: { "Content-Type": "application/json; charset=utf-8" },
    });
  };
}
