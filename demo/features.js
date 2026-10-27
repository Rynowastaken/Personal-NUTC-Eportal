import OpenCC from "opencc-js";

(() => {
  "use strict";
  // Static GitHub Pages preview; only Hitokoto public API is contacted.
  const $ = id => document.getElementById(id);
  const KEY = "nutc-portal-demo-features-v1";
  const toTraditional = OpenCC.Converter({ from: "cn", to: "twp" });
  const schemes = [
    ["tonalSpot","Tonal Spot",343], ["vibrant","Vibrant",338],
    ["expressive","Expressive",274], ["fidelity","Fidelity",345],
    ["content","Content",326], ["monochrome","Monochrome",0],
    ["neutral","Neutral",320], ["rainbow","Rainbow",200], ["fruitSalad","Fruit Salad",42],
  ];
  const defaults = () => ({
    username:"Demo User", avatar:"", background:"", scheme:"tonalSpot",
    colorfulness:1, themeBrightness:1, program:"day",
    hitokotoEnabled:false, hitokotoLanguage:"original",
    hitokotoSpeaker:true, hitokotoSource:true,
  });
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  function load() {
    const state = defaults();
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || "null");
      if (!saved || typeof saved !== "object") return state;
      if (typeof saved.username === "string" && saved.username.trim()) state.username = saved.username.trim().slice(0, 40);
      if (typeof saved.avatar === "string" && /^data:image\/(png|jpeg|webp);base64,/i.test(saved.avatar)) state.avatar = saved.avatar.slice(0, 3000000);
      if (typeof saved.background === "string" && /^data:image\/(png|jpeg|webp|gif);base64,/i.test(saved.background)) state.background = saved.background.slice(0, 4500000);
      if (schemes.some(item => item[0] === saved.scheme)) state.scheme = saved.scheme;
      if (Number.isFinite(saved.colorfulness)) state.colorfulness = clamp(saved.colorfulness, .5, 1.5);
      if (Number.isFinite(saved.themeBrightness)) state.themeBrightness = clamp(saved.themeBrightness, .5, 1.5);
      if (["day","evening","weekend"].includes(saved.program)) state.program = saved.program;
      state.hitokotoEnabled = saved.hitokotoEnabled === true;
      if (["original","en","ja"].includes(saved.hitokotoLanguage)) state.hitokotoLanguage = saved.hitokotoLanguage;
      state.hitokotoSpeaker = saved.hitokotoSpeaker !== false;
      state.hitokotoSource = saved.hitokotoSource !== false;
    } catch { /* Browser-local storage may be unavailable. */ }
    return state;
  }
  const state = load();
  function notify(text) { $("demoFeatureStatus").textContent = text; }
  function persist() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch { notify("瀏覽器儲存空間不足：設定僅能暫時預覽。"); }
  }
  const sampleQuote = {
    text:"每一個不曾起舞的日子，都是對生命的辜負。",
    speaker:"尼采（展示資料）", source:"範例語錄",
    url:"https://hitokoto.cn/", sample:true,
  };
  let quote = null, quoteRequest = 0, lastFetchAt = 0;

  function renderProfile() {
    $("demoUsername").textContent = state.username;
    $("demoAvatarInitial").textContent = state.username.slice(0,1).toUpperCase();
    $("demoAvatarImage").hidden = !state.avatar;
    if (state.avatar) $("demoAvatarImage").src = state.avatar;
    else $("demoAvatarImage").removeAttribute("src");
  }
  function renderAppearance() {
    const scheme = schemes.find(item => item[0] === state.scheme) || schemes[0];
    const sat = scheme[0] === "monochrome" ? 0 : state.colorfulness * (scheme[0] === "neutral" ? 22 : 57);
    const light = clamp(Math.round(74 * state.themeBrightness), 35, 92);
    const cssColor = "hsl(" + scheme[2] + " " + sat + "% " + light + "%)";
    document.documentElement.style.setProperty("--demo-primary", cssColor);
    $("demoColorfulness").value = String(state.colorfulness);
    $("demoColorfulnessValue").textContent = state.colorfulness.toFixed(2);
    $("demoThemeBrightness").value = String(state.themeBrightness);
    $("demoThemeBrightnessValue").textContent = state.themeBrightness.toFixed(2);
    for (const item of $("demoColorSchemeOptions").children) {
      item.setAttribute("aria-checked", String(item.dataset.scheme === state.scheme));
    }
    const preview = $("demoColorPreview");
    preview.replaceChildren();
    for (let n=0; n<5; n++) {
      const swatch = document.createElement("span");
      swatch.style.backgroundColor = "hsl(" + ((scheme[2]+n*15)%360) + " " + sat + "% " + clamp(light+10-n*11,9,95) + "%)";
      preview.append(swatch);
    }
    if (state.background) {
      document.body.style.setProperty("--demo-background-image", 'url("' + state.background + '")');
      document.body.dataset.customBackground = "true";
    } else {
      document.body.style.removeProperty("--demo-background-image");
      delete document.body.dataset.customBackground;
    }
    $("demoRemoveBackground").disabled = !state.background;
  }
  function renderProgram() {
    $("demoAcademicProgram").value = state.program;
    $("demoProgramLabel").textContent = {
      day:"日間部", evening:"進修部夜間班", weekend:"進修部假日班",
    }[state.program];
    window.NutcDemo?.setAcademicProgram(state.program);
  }
  function credits() {
    const visible = state.hitokotoEnabled && Boolean(quote);
    const speaker = visible && state.hitokotoSpeaker, source = visible && state.hitokotoSource;
    $("demoQuoteSpeakerRow").hidden = !speaker;
    $("demoQuoteSourceRow").hidden = !source;
    $("demoQuoteCredits").hidden = !(speaker || source);
    $("demoQuoteLink").hidden = !(speaker || source);
    if (!visible) return;
    $("demoQuoteSpeaker").textContent = quote.speaker || "未提供";
    $("demoQuoteSource").textContent = quote.source || "未提供";
    $("demoQuoteLink").href = quote.url;
  }
  function quoteControls() {
    $("demoHitokotoEnabled").checked = state.hitokotoEnabled;
    $("demoHitokotoLanguage").value = state.hitokotoLanguage;
    $("demoHitokotoSpeaker").checked = state.hitokotoSpeaker;
    $("demoHitokotoSource").checked = state.hitokotoSource;
    for (const id of ["demoHitokotoLanguage","demoHitokotoSpeaker","demoHitokotoSource"]) $(id).disabled = !state.hitokotoEnabled;
    $("demoQuoteRefresh").hidden = !state.hitokotoEnabled;
  }
  async function translate(text, language) {
    const localTranslator = window.Translator;
    if (!localTranslator?.create || !localTranslator.availability) return null;
    try {
      if (await localTranslator.availability({sourceLanguage:"zh", targetLanguage:language}) !== "available") return null;
      const translator = await localTranslator.create({sourceLanguage:"zh", targetLanguage:language});
      try {
        const result = await Promise.race([
          translator.translate(text),
          new Promise((_, reject) => setTimeout(() => reject(new Error("Translation timeout")), 3500)),
        ]);
        return typeof result === "string" && result.trim() ? result.trim() : null;
      } finally { translator.destroy?.(); }
    } catch { return null; }
  }
  async function renderQuote() {
    const version = ++quoteRequest;
    if (!state.hitokotoEnabled || !quote) {
      $("demoWelcomeSubtitle").textContent = "你的校園日常，一眼掌握。";
      $("demoWelcomeSubtitle").lang = "zh-Hant";
      $("demoQuoteStatus").textContent = "";
      credits(); return;
    }
    $("demoWelcomeSubtitle").textContent = "「" + quote.text + "」";
    $("demoWelcomeSubtitle").lang = "zh-Hant";
    $("demoQuoteStatus").textContent = quote.sample ? "離線展示語錄（非即時來源）" : "";
    credits();
    if (state.hitokotoLanguage === "original") return;
    const translated = await translate(quote.text, state.hitokotoLanguage);
    if (version !== quoteRequest || !state.hitokotoEnabled) return;
    if (translated) {
      $("demoWelcomeSubtitle").textContent = "「" + translated + "」";
      $("demoWelcomeSubtitle").lang = state.hitokotoLanguage;
      $("demoQuoteStatus").textContent = quote.sample ? "示範語錄 · 本機翻譯" : "";
    } else {
      $("demoQuoteStatus").textContent = "本機翻譯不支援此語言，顯示繁體中文" +
        (quote.sample ? "（離線範例）" : "") + "。";
    }
  }
  async function refreshQuote() {
    if (!state.hitokotoEnabled || $("demoQuoteRefresh").disabled) return;
    if (Date.now() - lastFetchAt < 5000) return;
    lastFetchAt = Date.now();
    $("demoQuoteRefresh").disabled = true;
    $("demoQuoteStatus").textContent = "正在取得一言…";
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5500);
    try {
      // The only external API. Never sends user cookies or university data.
      const response = await fetch("https://v1.hitokoto.cn/?encode=json&max_length=100", {
        method:"GET", mode:"cors", credentials:"omit", cache:"no-store", signal:controller.signal,
      });
      if (!response.ok) throw new Error("Hitokoto unavailable");
      const data = await response.json();
      if (typeof data.hitokoto !== "string" || !data.hitokoto.trim()) throw new Error("Invalid response");
      const uuid = typeof data.uuid === "string" && /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(data.uuid) ? data.uuid : null;
      quote = {
        text:toTraditional(data.hitokoto.trim().slice(0,280)),
        speaker:toTraditional(typeof data.from_who === "string" ? data.from_who.slice(0,100) : ""),
        source:toTraditional(typeof data.from === "string" ? data.from.slice(0,100) : ""),
        url:uuid ? "https://hitokoto.cn?uuid=" + uuid : "https://hitokoto.cn/",
        sample:false,
      };
    } catch { quote = quote || sampleQuote; }
    finally { clearTimeout(timeout); $("demoQuoteRefresh").disabled = false; }
    void renderQuote();
  }

  const readImage = file => new Promise((resolve,reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  async function addImage(file, background) {
    const limit = background ? 3000000 : 2000000;
    const allowed = background ? /^image\/(png|jpeg|webp|gif)$/ : /^image\/(png|jpeg|webp)$/;
    if (!file || !allowed.test(file.type) || file.size > limit) {
      notify("請選擇有效圖片：背景上限 3 MB、頭像上限 2 MB。"); return;
    }
    try {
      state[background ? "background" : "avatar"] = await readImage(file);
      persist();
      if (background) renderAppearance(); else renderProfile();
      notify("圖片已保存在此瀏覽器。");
    } catch { notify("無法讀取圖片。"); }
  }
  $("demoAccountButton").addEventListener("click", () => {
    $("demoUsernameInput").value = state.username;
    $("demoAccountDialog").showModal();
  });
  $("demoAccountForm").addEventListener("submit", event => {
    event.preventDefault();
    const name = $("demoUsernameInput").value.trim().slice(0,40);
    if (!name) return;
    state.username = name; persist(); renderProfile(); $("demoAccountDialog").close();
  });
  $("demoAvatarFile").addEventListener("change", event => {
    void addImage(event.target.files?.[0], false); event.target.value = "";
  });
  $("demoRemoveAvatar").addEventListener("click", () => {
    state.avatar = ""; persist(); renderProfile(); $("demoAvatarFile").value = "";
  });
  for (const [id,name] of schemes) {
    const button = document.createElement("button");
    button.type = "button"; button.className = "scheme-chip";
    button.textContent = name; button.dataset.scheme = id;
    button.setAttribute("role","radio");
    button.addEventListener("click", () => { state.scheme = id; renderAppearance(); persist(); });
    $("demoColorSchemeOptions").append(button);
  }
  $("demoColorfulness").addEventListener("input", event => {
    state.colorfulness = Number(event.target.value); renderAppearance(); persist();
  });
  $("demoThemeBrightness").addEventListener("input", event => {
    state.themeBrightness = Number(event.target.value); renderAppearance(); persist();
  });
  $("demoBackgroundFile").addEventListener("change", event => {
    void addImage(event.target.files?.[0], true); event.target.value = "";
  });
  $("demoRemoveBackground").addEventListener("click", () => {
    state.background = ""; renderAppearance(); persist(); notify("背景圖片已清除。");
  });
  const drop = $("demoBackgroundDropzone");
  ["dragover","dragenter"].forEach(type => drop.addEventListener(type, event => {
    event.preventDefault(); drop.classList.add("drag-over");
  }));
  ["drop","dragleave"].forEach(type => drop.addEventListener(type, event => {
    event.preventDefault(); drop.classList.remove("drag-over");
  }));
  drop.addEventListener("drop", event => void addImage(event.dataTransfer?.files?.[0], true));
  drop.addEventListener("paste", event => {
    const image = [...(event.clipboardData?.files || [])].find(file => file.type.startsWith("image/"));
    if (image) { event.preventDefault(); void addImage(image, true); }
  });
  $("resetAppearance").addEventListener("click", () => {
    Object.assign(state, {scheme:"tonalSpot",colorfulness:1,themeBrightness:1,background:""});
    $("brightness").value = "100";
    $("brightness").dispatchEvent(new Event("input", {bubbles:true}));
    renderAppearance(); persist();
  });
  $("demoAcademicProgram").addEventListener("change", event => {
    if (!["day","evening","weekend"].includes(event.target.value)) return;
    state.program = event.target.value; persist(); renderProgram();
  });
  $("demoHitokotoEnabled").addEventListener("change", event => {
    state.hitokotoEnabled = event.target.checked; persist(); quoteControls();
    if (state.hitokotoEnabled && !quote) void refreshQuote();
    else void renderQuote();
  });
  $("demoHitokotoLanguage").addEventListener("change", event => {
    state.hitokotoLanguage = event.target.value; persist(); void renderQuote();
  });
  $("demoHitokotoSpeaker").addEventListener("change", event => {
    state.hitokotoSpeaker = event.target.checked; persist(); credits();
  });
  $("demoHitokotoSource").addEventListener("change", event => {
    state.hitokotoSource = event.target.checked; persist(); credits();
  });
  $("demoQuoteRefresh").addEventListener("click", () => void refreshQuote());

  // Attendance category filters operate exclusively on invented fixture data.
  const absences = [{kind:"leave",title:"已核准請假",detail:"10/15 · 事假 · 1 節（範例）"}];
  function renderAbsences(kind) {
    const container = $("demoAbsenceEvents"); container.replaceChildren();
    const subset = absences.filter(entry => kind === "all" || entry.kind === kind);
    for (const item of subset) {
      const card = document.createElement("div"), dot = document.createElement("span");
      card.className = "attendance-event"; dot.className = "event-dot";
      const content = document.createElement("div");
      const title = document.createElement("strong"); title.textContent = item.title;
      const sub = document.createElement("small"); sub.textContent = item.detail;
      content.append(title,sub); card.append(dot,content); container.append(card);
    }
    if (!subset.length) {
      const empty = document.createElement("p");
      empty.className = "absence-empty"; empty.textContent = "這個分類目前沒有示範紀錄。";
      container.append(empty);
    }
    document.querySelectorAll("[data-demo-absence]").forEach(button => {
      button.setAttribute("aria-pressed",String(button.dataset.demoAbsence === kind));
    });
  }
  document.querySelectorAll("[data-demo-absence]").forEach(button => {
    button.addEventListener("click", () => renderAbsences(button.dataset.demoAbsence));
  });

  // Status/update/restart use timer-driven fake progress; no privileged routes.
  $("demoServerButton").addEventListener("click", () => $("demoServerDialog").showModal());
  function simulate(steps) {
    const update = $("demoUpdateServer"), restart = $("demoRestartServer");
    if (update.disabled || restart.disabled) return;
    update.disabled = restart.disabled = true;
    let step=0;
    const next = () => {
      $("demoServerProgress").textContent = steps[step++];
      if (step < steps.length) setTimeout(next, 500);
      else {
        update.disabled = restart.disabled = false;
        $("demoServerProgress").textContent += "（純展示，沒有修改伺服器）";
      }
    };
    next();
  }
  $("demoUpdateServer").addEventListener("click", () => simulate([
    "模擬檢查版本…","模擬安裝依賴…","模擬重新編譯…","模擬驗證資源…","模擬更新完成",
  ]));
  $("demoRestartServer").addEventListener("click", () => simulate([
    "模擬停止服務…","模擬重新啟動…","模擬已連線",
  ]));

  renderProfile(); renderAppearance(); renderProgram();
  quoteControls(); renderAbsences("all");
  if (state.hitokotoEnabled) void refreshQuote();
  else void renderQuote();
})();