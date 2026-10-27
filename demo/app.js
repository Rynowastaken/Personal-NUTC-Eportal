(() => {
  "use strict";

  // Public demo: no API calls, university cookies, credentials or real student
  // information. Only local browser settings/links can be persisted.
  const STORAGE = "nutc-portal-demo-v1";
  const DEFAULT_SHORTCUTS = [{ name: "示範捷徑", url: "https://example.com" }];
  const SERVICES = Object.freeze({
    student: { name: "學生管理", description: "展示校園課表、學籍及個人資訊的入口設計。正式網站會連往學校服務；這裡只提供示範畫面。" },
    mail: { name: "WebMail", description: "校務信箱通知入口的示範。公開 Demo 不會開啟或讀取真實信件。" },
    events: { name: "活動報名", description: "校園活動與投票入口的示範。此處不會送出任何實際報名。" },
    learning: { name: "學習歷程", description: "展示 EP 學習歷程與成果查詢的入口樣式。所有內容均為樣本。" },
    tron: { name: "TronClass", description: "課程、教材、作業和測驗入口的示範，不會登入 TronClass。" },
  });
  const COURSES = Object.freeze({
    "0-3": ["學涯規劃", "7605 · 範例課程"],
    "0-5": ["民法", "3701 · 示範教師"],
    "1-0": ["體育", "0000 · 示範教師"],
    "1-5": ["程式設計與應用", "3806 · 範例教室"],
    "2-0": ["大學之道", "3309 · 示範教師"],
    "2-4": ["經濟學", "3701 · 範例教室"],
    "2-7": ["週會 / 班會", "3701 · 示範教室"],
    "3-5": ["會計學", "3702 · 範例教室"],
    "4-2": ["服務與學習", "3701 · 範例課程"],
    "4-5": ["國文", "3802 · 示範教師"],
  });
  const PERIODS = [
    ["08:10", "09:00"], ["09:10", "10:00"], ["10:10", "11:00"],
    ["11:10", "12:00"], ["13:25", "14:15"], ["14:20", "15:10"],
    ["15:20", "16:10"], ["16:15", "17:05"],
  ];
  const WEEKDAY = ["一", "二", "三", "四", "五"];
  const $ = (id) => document.getElementById(id);
  const defaultState = () => ({
    brightness: 75,
    motion: true,
    shortcuts: DEFAULT_SHORTCUTS.map(item => ({ ...item })),
  });

  function validExternalUrl(value) {
    try {
      const parsed = new URL(String(value).trim());
      if (!["https:", "http:"].includes(parsed.protocol) || !parsed.hostname) return null;
      return parsed.href;
    } catch { return null; }
  }
  function loadState() {
    const fallback = defaultState();
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE) || "null");
      if (!stored || typeof stored !== "object") return fallback;
      const shortcuts = Array.isArray(stored.shortcuts)
        ? stored.shortcuts.slice(0, 30).flatMap((entry) => {
            const url = validExternalUrl(entry?.url);
            const name = typeof entry?.name === "string" ? entry.name.trim().slice(0, 48) : "";
            return url && name ? [{ name, url }] : [];
          })
        : fallback.shortcuts;
      return {
        brightness: Number.isFinite(stored.brightness)
          ? Math.min(140, Math.max(20, stored.brightness))
          : fallback.brightness,
        motion: typeof stored.motion === "boolean" ? stored.motion : fallback.motion,
        shortcuts,
      };
    } catch { return fallback; }
  }
  const state = loadState();
  function persist() {
    try { localStorage.setItem(STORAGE, JSON.stringify(state)); }
    catch { /* Private browsing may disable storage; session still works. */ }
  }

  const svg = (name) => {
    const namespace = "http://www.w3.org/2000/svg";
    const element = document.createElementNS(namespace, "svg");
    element.classList.add("icon");
    element.setAttribute("aria-hidden", "true");
    const use = document.createElementNS(namespace, "use");
    use.setAttribute("href", "#i-" + name);
    element.append(use);
    return element;
  };

  let toastTimer;
  function toast(text) {
    const node = $("toast");
    node.textContent = text;
    node.classList.add("visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => node.classList.remove("visible"), 2600);
  }
  function openDialog(id) {
    const dialog = $(id);
    if (!dialog.open) dialog.showModal();
  }

  document.addEventListener("click", (event) => {
    const close = event.target.closest("[data-close]");
    if (close) $(close.dataset.close)?.close();
    const service = event.target.closest("[data-service]");
    if (service) {
      const item = SERVICES[service.dataset.service];
      if (!item) return;
      $("serviceDialogTitle").textContent = item.name;
      $("serviceDialogDescription").textContent = item.description;
      openDialog("serviceDialog");
    }
  });

  for (const dialog of document.querySelectorAll("dialog")) {
    dialog.addEventListener("click", (event) => {
      // Native backdrop click closes the dialog; clicks inside do not.
      if (event.target === dialog) dialog.close();
    });
  }

  function renderShortcuts() {
    const grid = $("shortcutGrid");
    grid.replaceChildren();
    if (state.shortcuts.length === 0) {
      const empty = document.createElement("p");
      empty.className = "shortcut-empty";
      empty.append(svg("link"), document.createTextNode("尚未釘選捷徑。按「新增 / 管理捷徑」試試看。"));
      grid.append(empty);
      return;
    }
    for (const item of state.shortcuts) {
      const card = document.createElement("a");
      card.className = "module-card";
      card.style.setProperty("--accent", "218 184 125");
      card.href = item.url;
      card.target = "_blank";
      card.rel = "noopener noreferrer";
      card.title = "在新分頁開啟：" + item.url;

      const icon = document.createElement("span");
      icon.className = "module-icon";
      icon.append(svg("link"));
      const copy = document.createElement("span");
      copy.className = "module-copy";
      const title = document.createElement("strong");
      title.textContent = item.name;
      const description = document.createElement("small");
      try { description.textContent = new URL(item.url).hostname; }
      catch { description.textContent = "外部連結"; }
      copy.append(title, description);
      const arrow = document.createElement("span");
      arrow.className = "module-arrow";
      arrow.append(svg("external"));
      card.append(icon, copy, arrow);
      grid.append(card);
    }
  }
  function renderShortcutManager() {
    const grid = $("shortcutManagerList");
    grid.replaceChildren();
    if (!state.shortcuts.length) {
      const empty = document.createElement("p");
      empty.className = "section-subtitle";
      empty.textContent = "還沒有捷徑。";
      grid.append(empty);
      return;
    }
    state.shortcuts.forEach((item, index) => {
      const row = document.createElement("div");
      row.className = "manager-item";
      const info = document.createElement("div");
      const name = document.createElement("strong");
      name.textContent = item.name;
      const url = document.createElement("small");
      url.textContent = item.url;
      info.append(name, url);
      const remove = document.createElement("button");
      remove.type = "button";
      remove.setAttribute("aria-label", "移除 " + item.name);
      remove.title = "移除捷徑";
      remove.append(svg("trash"));
      remove.addEventListener("click", () => {
        state.shortcuts.splice(index, 1);
        persist();
        renderShortcuts();
        renderShortcutManager();
        toast("已移除捷徑");
      });
      row.append(info, remove);
      grid.append(row);
    });
  }

  $("manageShortcuts").addEventListener("click", () => {
    renderShortcutManager();
    $("shortcutError").textContent = "";
    openDialog("shortcutDialog");
  });
  $("shortcutForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const name = $("shortcutName").value.trim();
    const url = validExternalUrl($("shortcutUrl").value);
    if (!name || !url) {
      $("shortcutError").textContent = "請輸入名稱與有效的 http / https 網址。";
      return;
    }
    if (state.shortcuts.length >= 30) {
      $("shortcutError").textContent = "最多可以釘選 30 個捷徑。";
      return;
    }
    state.shortcuts.push({ name: name.slice(0, 48), url });
    persist();
    renderShortcuts();
    renderShortcutManager();
    $("shortcutForm").reset();
    $("shortcutError").textContent = "";
    toast("已新增捷徑");
  });

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Taipei",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
    hourCycle: "h23",
  });
  function localParts(date = new Date()) {
    const parts = formatter.formatToParts(date);
    return Object.fromEntries(parts.filter(part => part.type !== "literal").map(part => [part.type, Number(part.value)]));
  }
  function taipeiClock() {
    const now = localParts();
    return String(now.hour).padStart(2, "0") + ":" + String(now.minute).padStart(2, "0");
  }
  function buildSchedule() {
    const parts = localParts();
    const today = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
    const dayIndex = (today.getUTCDay() + 6) % 7;
    const monday = new Date(today.valueOf() - dayIndex * 86_400_000);
    const table = $("scheduleTable");
    table.replaceChildren();
    const thead = document.createElement("thead");
    const headRow = document.createElement("tr");
    const first = document.createElement("th");
    first.scope = "col";
    first.textContent = "節";
    headRow.append(first);
    for (let day = 0; day < 5; day++) {
      const date = new Date(monday.valueOf() + day * 86_400_000);
      const th = document.createElement("th");
      th.scope = "col";
      th.textContent = WEEKDAY[day];
      if (day === dayIndex) th.classList.add("today");
      const small = document.createElement("small");
      small.textContent = String(date.getUTCMonth() + 1).padStart(2, "0") + "/" +
        String(date.getUTCDate()).padStart(2, "0");
      th.append(small);
      headRow.append(th);
    }
    thead.append(headRow);
    const tbody = document.createElement("tbody");
    PERIODS.forEach(([start, end], period) => {
      const tr = document.createElement("tr");
      const th = document.createElement("th");
      th.scope = "row";
      th.textContent = String(period + 1);
      const time = document.createElement("small");
      time.textContent = start + "–" + end;
      th.append(time);
      tr.append(th);
      for (let day = 0; day < 5; day++) {
        const td = document.createElement("td");
        const course = COURSES[day + "-" + period];
        if (course) {
          const block = document.createElement("div");
          block.className = "course";
          const title = document.createElement("strong");
          title.textContent = course[0];
          const detail = document.createElement("small");
          detail.textContent = course[1];
          block.append(title, detail);
          td.append(block);
        }
        tr.append(td);
      }
      tbody.append(tr);
    });
    table.append(thead, tbody);
    $("scheduleMeta").textContent = "示範課表 · 更新 " + taipeiClock() + "（台灣時間）";
  }

  function refreshButton(button, callback) {
    if (button.disabled) return;
    button.disabled = true;
    button.classList.add("is-loading");
    setTimeout(() => {
      callback();
      button.disabled = false;
      button.classList.remove("is-loading");
      toast("示範資料已重新整理");
    }, 650);
  }
  $("refreshSchedule").addEventListener("click", (event) => refreshButton(event.currentTarget, buildSchedule));
  $("refreshAbsence").addEventListener("click", (event) => refreshButton(event.currentTarget, () => {
    $("absenceMeta").textContent = "模擬統計 · 更新 " + taipeiClock() + "（台灣時間）";
  }));

  function applyAppearance() {
    document.documentElement.style.setProperty("--brightness", String(state.brightness / 100));
    $("brightness").value = String(state.brightness);
    $("brightnessValue").textContent = state.brightness + "%";
    $("motionToggle").checked = state.motion;
  }
  $("settingsButton").addEventListener("click", () => {
    applyAppearance();
    openDialog("settingsDialog");
  });
  $("brightness").addEventListener("input", (event) => {
    state.brightness = Number(event.target.value);
    applyAppearance();
    persist();
  });
  $("motionToggle").addEventListener("change", (event) => {
    state.motion = event.target.checked;
    persist();
    updateParallax();
  });
  $("resetAppearance").addEventListener("click", () => {
    state.brightness = 75;
    state.motion = true;
    applyAppearance();
    persist();
    updateParallax();
    toast("已恢復預設外觀");
  });

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let scheduled = false;
  function updateParallax() {
    if (!state.motion || reducedMotion.matches) {
      document.documentElement.style.setProperty("--scroll-shift", "0px");
      return;
    }
    const available = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    const progress = available > 0 ? Math.min(1, Math.max(0, window.scrollY / available)) : 0.5;
    document.documentElement.style.setProperty("--scroll-shift", ((progress - .5) * 120).toFixed(1) + "px");
  }
  window.addEventListener("scroll", () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      updateParallax();
    });
  }, { passive: true });
  window.addEventListener("resize", updateParallax);
  if (reducedMotion.addEventListener) reducedMotion.addEventListener("change", updateParallax);

  renderShortcuts();
  buildSchedule();
  applyAppearance();
  updateParallax();
})();