// Optional Hitokoto welcome quotes. No ePortal cookies or credentials are sent.
// Hitokoto v1 returns original-language quotes and DOES NOT expose a language
// filter. Translation is best-effort using the browser's local Translator API.
export const HITOKOTO_LANGUAGES = Object.freeze(["original", "en", "ja"]);
export const DEFAULT_HITOKOTO_SETTINGS = Object.freeze({
  enabled: false,
  language: "original",
});

export function normalizeHitokotoSettings(input) {
  return {
    enabled: input?.enabled === true,
    language: HITOKOTO_LANGUAGES.includes(input?.language)
      ? input.language
      : DEFAULT_HITOKOTO_SETTINGS.language,
  };
}

function stringField(value, limit) {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

export function parseHitokoto(data) {
  const text = stringField(data?.hitokoto, 280);
  if (!text) throw new Error("Hitokoto response did not include a quote.");
  const uuid = stringField(data?.uuid, 36);
  return {
    text,
    speaker: stringField(data?.from_who, 100),
    source: stringField(data?.from, 100),
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
      if (availability === "unavailable") return { text, translated: false };
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

  function restoreDefault() {
    subtitle.textContent = fallback;
    subtitle.lang = "zh-Hant";
    details.hidden = true;
    status.textContent = "";
  }
  async function renderQuote(id) {
    if (!lastQuote || id !== requestId || !current.enabled) return;
    const localized = await translateQuote(lastQuote.text, current.language);
    if (id !== requestId || !current.enabled) return;
    subtitle.textContent = "「" + localized.text + "」";
    subtitle.lang = localized.translated
      ? current.language
      : "zh";
    speaker.textContent = lastQuote.speaker || "未提供";
    source.textContent = lastQuote.source || "未提供";
    link.href = lastQuote.url;
    details.hidden = false;
    status.textContent = current.language !== "original" && !localized.translated
      ? "此瀏覽器無法翻譯為所選語言，現顯示原文。"
      : "";
  }

  async function refreshQuote({ force = false } = {}) {
    if (!current.enabled) return;
    const now = Date.now();
    // Hitokoto is a community project; do not hammer its public endpoint.
    if (!force && now - lastFetchAt < 3500) return;
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
      const id = ++requestId;
      status.textContent = "正在處理語言…";
      await renderQuote(id);
    }
  }

  refresh.addEventListener("click", () => void refreshQuote());
  restoreDefault();
  return { applySettings, refreshQuote };
}
