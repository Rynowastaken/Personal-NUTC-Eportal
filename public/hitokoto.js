// Optional Hitokoto welcome quotes. No ePortal cookies or credentials are sent.
// Hitokoto v1 returns original-language quotes and DOES NOT expose a language
// filter. The same-origin API converts Simplified Chinese to Taiwan
// Traditional via OpenCC. English/Japanese translation remains best-effort
// using the browser's local Translator API.
export const HITOKOTO_LANGUAGES = Object.freeze(["original", "en", "ja"]);
export const DEFAULT_HITOKOTO_SETTINGS = Object.freeze({
  enabled: false,
  language: "original",
  showSpeaker: true,
  showSource: true,
});

export function normalizeHitokotoSettings(input) {
  return {
    enabled: input?.enabled === true,
    language: HITOKOTO_LANGUAGES.includes(input?.language)
      ? input.language
      : DEFAULT_HITOKOTO_SETTINGS.language,
    // Missing values in older preference files preserve the existing behavior.
    showSpeaker: input?.showSpeaker !== false,
    showSource: input?.showSource !== false,
  };
}

function stringField(value, limit) {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

export function parseHitokoto(data) {
  // Accept both the provider's raw fields and the sanitized same-origin
  // proxy response. Never trust arbitrary URLs supplied by a quote response.
  const text = stringField(data?.hitokoto ?? data?.text, 280);
  if (!text) throw new Error("Hitokoto response did not include a quote.");
  const suppliedUrl = typeof data?.url === "string" ? data.url : "";
  const suffix = suppliedUrl.startsWith("https://hitokoto.cn?uuid=")
    ? suppliedUrl.slice("https://hitokoto.cn?uuid=".length)
    : "";
  const uuid = stringField(data?.uuid ?? suffix, 36);
  return {
    text,
    speaker: stringField(data?.from_who ?? data?.speaker, 100),
    source: stringField(data?.from ?? data?.source, 100),
    url: /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(uuid)
      ? "https://hitokoto.cn?uuid=" + uuid
      : "https://hitokoto.cn/",
  };
}

export async function requestHitokoto({ fetchImpl = fetch, signal } = {}) {
  const response = await fetchImpl("/api/hitokoto", {
    method: "GET",
    cache: "no-store",
    signal,
    headers: { Accept: "application/json" },
    credentials: "same-origin",
  });
  if (!response.ok) throw new Error("Hitokoto is temporarily unavailable.");
  return parseHitokoto(await response.json());
}

// Translator is not available on all browsers, notably many mobile browsers.
// Never label unchanged text as a successful translation.
export async function translateHitokoto(text, language, {
  TranslatorImpl = globalThis.Translator,
} = {}) {
  if (language === "original") return { text, translated: false };
  if (!HITOKOTO_LANGUAGES.includes(language)) return { text, translated: false };
  if (!TranslatorImpl?.create) return { text, translated: false };

  try {
    if (TranslatorImpl.availability) {
      const availability = await TranslatorImpl.availability({
        sourceLanguage: "zh",
        targetLanguage: language,
      });
      // Never trigger an implicit language-model download from a subtitle.
      if (availability !== "available") return { text, translated: false };
    }
    const translator = await TranslatorImpl.create({
      sourceLanguage: "zh",
      targetLanguage: language,
    });
    try {
      const result = await translator.translate(text);
      if (typeof result !== "string" || !result.trim()) {
        return { text, translated: false };
      }
      return { text: result.trim(), translated: true };
    } finally {
      translator.destroy?.();
    }
  } catch {
    return { text, translated: false };
  }
}

export function createHitokotoWidget({
  subtitle,
  details,
  speaker,
  source,
  speakerRow = speaker?.parentElement,
  sourceRow = source?.parentElement,
  link,
  refresh,
  status,
  fetchQuote = requestHitokoto,
  translateQuote = translateHitokoto,
  delay = 5000,
}) {
  const fallback = subtitle.textContent;
  let current = DEFAULT_HITOKOTO_SETTINGS;
  let lastQuote = null;
  let requestId = 0;
  let controller = null;
  let lastFetchAt = 0;

  function renderAttribution() {
    const showSpeaker = current.enabled && current.showSpeaker;
    const showSource = current.enabled && current.showSource;
    if (speakerRow) speakerRow.hidden = !showSpeaker;
    if (sourceRow) sourceRow.hidden = !showSource;
    link.hidden = !(showSpeaker || showSource);
    details.hidden = !(showSpeaker || showSource);
  }

  function restoreDefault() {
    refresh.hidden = !current.enabled;
    subtitle.textContent = fallback;
    subtitle.lang = "zh-Hant";
    details.hidden = true;
    if (speakerRow) speakerRow.hidden = true;
    if (sourceRow) sourceRow.hidden = true;
    link.hidden = true;
    status.textContent = "";
  }
  async function renderQuote(id) {
    if (!lastQuote || id !== requestId || !current.enabled) return;
    // Display the original and its credits immediately, even if translation
    // is slow, unsupported, or fails. Never block attribution on an AI model.
    subtitle.textContent = "「" + lastQuote.text + "」";
    subtitle.lang = "zh-Hant-TW";
    speaker.textContent = lastQuote.speaker || "未提供";
    source.textContent = lastQuote.source || "未提供";
    link.href = lastQuote.url;
    renderAttribution();
    status.textContent = current.language === "original"
      ? ""
      : "正在檢查此瀏覽器的翻譯功能…";

    if (current.language === "original") return;
    const language = current.language;
    const localized = await Promise.race([
      translateQuote(lastQuote.text, language),
      new Promise((resolve) => setTimeout(() => resolve({
        text: lastQuote.text, translated: false,
      }), 4000)),
    ]).catch(() => ({ text: lastQuote.text, translated: false }));
    if (id !== requestId || !current.enabled) return;
    if (localized.translated) {
      subtitle.textContent = "「" + localized.text + "」";
      subtitle.lang = language;
      status.textContent = "";
    } else {
      status.textContent = "此瀏覽器無法翻譯為所選語言，現顯示繁體中文。";
    }
  }

  async function refreshQuote({ force = false } = {}) {
    if (!current.enabled) return;
    const now = Date.now();
    // Hitokoto is a community project; do not hammer its public endpoint.
    if (!force && now - lastFetchAt < 5500) return;
    if (refresh.disabled) return;
    lastFetchAt = now;
    controller?.abort();
    controller = new AbortController();
    const id = ++requestId;
    refresh.disabled = true;
    status.textContent = "正在取得一言…";
    const timeout = setTimeout(() => controller.abort(), delay);
    try {
      lastQuote = await fetchQuote({ signal: controller.signal });
      await renderQuote(id);
    } catch {
      if (id === requestId && current.enabled) {
        if (lastQuote) await renderQuote(id);
        else {
          restoreDefault();
          status.textContent = "暫時無法取得一言，保留原本的歡迎文字。";
        }
      }
    } finally {
      clearTimeout(timeout);
      if (id === requestId) refresh.disabled = false;
    }
  }

  async function applySettings(input) {
    const next = normalizeHitokotoSettings(input);
    const wasEnabled = current.enabled;
    const previousLanguage = current.language;
    const attributionChanged = current.showSpeaker !== next.showSpeaker ||
      current.showSource !== next.showSource;
    current = next;
    refresh.hidden = !current.enabled;
    if (!current.enabled) {
      ++requestId;
      controller?.abort();
      refresh.disabled = false;
      restoreDefault();
      return;
    }
    if (!wasEnabled || !lastQuote) {
      if (refresh.disabled) {
        controller?.abort();
        refresh.disabled = false;
      }
      void refreshQuote({ force: true });
    } else if (current.language !== previousLanguage) {
      controller?.abort();
      refresh.disabled = false;
      const id = ++requestId;
      status.textContent = "正在處理語言…";
      await renderQuote(id);
    } else if (attributionChanged) {
      renderAttribution();
    }
  }

  refresh.addEventListener("click", () => void refreshQuote());
  restoreDefault();
  return { applySettings, refreshQuote };
}
