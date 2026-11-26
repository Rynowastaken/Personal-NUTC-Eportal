import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(ROOT, "data");
const META_FILE = path.join(DATA_DIR, "dashboard-preferences.json");
const AVATAR_FILE = path.join(DATA_DIR, "dashboard-avatar.bin");
const BACKGROUND_FILE = path.join(DATA_DIR, "dashboard-background.bin");

const IMAGE_LIMITS = {
  avatar: 2 * 1024 * 1024,
  background: 6 * 1024 * 1024,
};

const AI_PROVIDERS = ["opencode-go", "openai"];
const AI_DEFAULT_PROVIDER = "opencode-go";
const AI_DEFAULT_BASE_URL = "https://opencode.ai/inference/go/openai/v1";
const AI_DEFAULT_MODEL = "deepseek-v4.1-flash";

function aiError(message) {
  return Object.assign(new Error(message), { statusCode: 400 });
}

function defaultAiSettings() {
  return {
    enabled: false,
    provider: AI_DEFAULT_PROVIDER,
    baseUrl: AI_DEFAULT_BASE_URL,
    model: AI_DEFAULT_MODEL,
    apiKey: "",
    session: "",
  };
}

function normalizeAiBaseUrl(value, enabled) {
  if (typeof value !== "string") {
    throw aiError("AI base URL must be a string.");
  }
  const baseUrl = value.trim();
  if (baseUrl.length > 500) {
    throw aiError("AI base URL must be 500 characters or fewer.");
  }
  if (!baseUrl) {
    if (enabled) {
      throw aiError("AI base URL is required when the AI assistant is enabled.");
    }
    return "";
  }

  let parsed;
  try {
    parsed = new URL(baseUrl);
  } catch {
    throw aiError("Enter a complete HTTP or HTTPS URL for the AI base URL.");
  }
  if (
    !["http:", "https:"].includes(parsed.protocol) ||
    !parsed.hostname ||
    parsed.username ||
    parsed.password
  ) {
    throw aiError(
      "AI base URL must be an HTTP or HTTPS URL without embedded credentials.",
    );
  }

  const localHost = ["localhost", "127.0.0.1"].includes(parsed.hostname);
  if (enabled && parsed.protocol !== "https:" && !localHost) {
    throw aiError("AI base URL must use HTTPS unless it points at localhost.");
  }
  return baseUrl;
}

// Pure validation of an AI settings payload. Returns the stored shape,
// including the API key; callers outside the server must use get() instead.
export function validateAiSettings(input, previous = defaultAiSettings()) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw aiError("AI settings must be an object.");
  }

  const base = { ...defaultAiSettings(), ...(previous || {}) };

  const enabled = Object.hasOwn(input, "enabled") ? input.enabled : base.enabled;
  if (typeof enabled !== "boolean") {
    throw aiError("AI enabled must be true or false.");
  }

  const provider = Object.hasOwn(input, "provider")
    ? input.provider
    : base.provider;
  if (!AI_PROVIDERS.includes(provider)) {
    throw aiError("AI provider must be opencode-go or openai.");
  }

  let baseUrl = Object.hasOwn(input, "baseUrl") ? input.baseUrl : base.baseUrl;
  if (typeof baseUrl !== "string") {
    throw aiError("AI base URL must be a string.");
  }
  if (provider === AI_DEFAULT_PROVIDER && !baseUrl.trim()) {
    baseUrl = AI_DEFAULT_BASE_URL;
  }
  baseUrl = normalizeAiBaseUrl(baseUrl, enabled);

  let model = Object.hasOwn(input, "model") ? input.model : base.model;
  if (typeof model !== "string") {
    throw aiError("AI model must be a string.");
  }
  model = model.trim();
  if (model.length > 120) {
    throw aiError("AI model must be 120 characters or fewer.");
  }
  if (provider === AI_DEFAULT_PROVIDER && !model) {
    model = AI_DEFAULT_MODEL;
  }
  if (enabled && !model) {
    throw aiError("AI model is required when the AI assistant is enabled.");
  }

  const hasApiKey = Object.hasOwn(input, "apiKey") && input.apiKey !== undefined;
  if (
    hasApiKey &&
    (typeof input.apiKey !== "string" || input.apiKey.length > 500)
  ) {
    throw aiError("AI API key must be a string of 500 characters or fewer.");
  }

  const clearKey = Object.hasOwn(input, "clearKey") ? input.clearKey : false;
  if (typeof clearKey !== "boolean") {
    throw aiError("clearKey must be true or false.");
  }

  let apiKey = typeof base.apiKey === "string" ? base.apiKey : "";
  if (hasApiKey && input.apiKey.trim()) apiKey = input.apiKey.trim();
  if (clearKey) apiKey = "";

  let session = Object.hasOwn(input, "session") ? input.session : base.session;
  if (typeof session !== "string" || session.length > 200) {
    throw aiError("AI session must be a string of 200 characters or fewer.");
  }
  session = session.trim();

  return { enabled, provider, baseUrl, model, apiKey, session };
}

// Load persisted settings without ever throwing on malformed data.
function loadAiSettings(ai) {
  const saved = ai && typeof ai === "object" && !Array.isArray(ai) ? ai : {};
  const provider = AI_PROVIDERS.includes(saved.provider)
    ? saved.provider
    : AI_DEFAULT_PROVIDER;
  const enabled = saved.enabled === true;

  let baseUrl =
    typeof saved.baseUrl === "string" ? saved.baseUrl.trim() : "";
  if (provider === AI_DEFAULT_PROVIDER && !baseUrl) {
    baseUrl = AI_DEFAULT_BASE_URL;
  }
  if (baseUrl) {
    try {
      baseUrl = normalizeAiBaseUrl(baseUrl, false);
    } catch {
      // A broken saved URL must not silently fall back to another provider's
      // host, which would send this provider's key there.
      baseUrl = provider === AI_DEFAULT_PROVIDER ? AI_DEFAULT_BASE_URL : "";
    }
  }

  let model = typeof saved.model === "string" ? saved.model.trim() : "";
  if (model.length > 120) model = "";
  if (provider === AI_DEFAULT_PROVIDER && !model) {
    model = AI_DEFAULT_MODEL;
  }

  const apiKey =
    typeof saved.apiKey === "string" && saved.apiKey.length <= 500
      ? saved.apiKey
      : "";
  const session =
    typeof saved.session === "string" && saved.session.length <= 200
      ? saved.session.trim()
      : "";

  return { enabled, provider, baseUrl, model, apiKey, session };
}

export function validateAcademicProgram(value) {
  if (typeof value !== "string" || !["day", "evening", "weekend"].includes(value)) {
    throw Object.assign(
      new Error("Academic program must be day, evening, or weekend."),
      { statusCode: 400 },
    );
  }
  return value;
}

function cleanUsername(value) {
  const username = typeof value === "string" ? value.trim() : "";
  if (!username || username.length > 40) {
    throw Object.assign(
      new Error("Username must contain 1 to 40 characters."),
      { statusCode: 400 },
    );
  }
  return username;
}

const MAX_CUSTOM_LINKS = 30;
const CUSTOM_LINK_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_PINNED_MODULES = 32;
const MODULE_ID_PATTERN = /^[a-z0-9-]+$/;
const MAX_LIBRARY_FAVORITES = 200;
const LIBRARY_FAVORITE_ID = /^[a-z0-9._:-]{1,64}$/i;

function cleanFavoriteField(val, maxLen = 200) {
  return typeof val === "string" ? val.trim().slice(0, maxLen) : "";
}

export function validateLibraryFavorite(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw linkError("Book favorite payload must be an object.");
  }
  const id = cleanFavoriteField(payload.id, 64);
  if (!LIBRARY_FAVORITE_ID.test(id)) {
    throw linkError("Valid catalog book ID is required.");
  }
  const title = cleanFavoriteField(payload.title, 300);
  if (!title) {
    throw linkError("Book title is required.");
  }

  let detailPath = cleanFavoriteField(payload.detailPath, 320);
  if (detailPath && !detailPath.startsWith("/")) {
    detailPath = "";
  }

  let officialUrl = cleanFavoriteField(payload.officialUrl, 500);
  if (officialUrl) {
    try {
      const parsed = new URL(officialUrl);
      if (!["https:", "http:"].includes(parsed.protocol)) officialUrl = "";
      else officialUrl = parsed.toString();
    } catch {
      officialUrl = "";
    }
  }

  let coverProxyUrl = cleanFavoriteField(payload.coverProxyUrl, 800);
  if (
    coverProxyUrl &&
    !coverProxyUrl.startsWith("/api/library/cover?") &&
    !coverProxyUrl.startsWith("data:image/svg+xml")
  ) {
    coverProxyUrl = "";
  }

  const rawSavedAt = cleanFavoriteField(payload.savedAt, 40);
  const savedAt =
    rawSavedAt && !Number.isNaN(Date.parse(rawSavedAt))
      ? new Date(rawSavedAt).toISOString()
      : new Date().toISOString();

  return {
    id,
    title,
    author: cleanFavoriteField(payload.author, 200),
    publisherYear: cleanFavoriteField(payload.publisherYear, 200),
    isbn: cleanFavoriteField(payload.isbn, 40),
    callNumber: cleanFavoriteField(payload.callNumber, 80),
    campus: cleanFavoriteField(payload.campus, 120),
    detailPath,
    officialUrl,
    coverProxyUrl,
    savedAt,
  };
}

function loadLibraryFavorites(items) {
  if (!Array.isArray(items)) return [];
  const seen = new Set();
  const validated = [];
  for (const item of items) {
    if (validated.length >= MAX_LIBRARY_FAVORITES) break;
    try {
      const clean = validateLibraryFavorite(item);
      if (seen.has(clean.id)) continue;
      seen.add(clean.id);
      validated.push(clean);
    } catch {
      // Ignore malformed records without discarding the other preferences.
    }
  }
  return validated;
}

export function validatePinnedModules(input, allowedIds = null) {
  if (input === null) return null;
  if (!Array.isArray(input)) {
    throw linkError("Pinned systems must be an array or null.");
  }

  const allowed = allowedIds ? new Set(allowedIds) : null;
  const seen = new Set();
  const validated = [];

  for (const rawId of input) {
    if (typeof rawId !== "string") {
      throw linkError("Each pinned system ID must be a string.");
    }
    const id = rawId.trim();
    if (!MODULE_ID_PATTERN.test(id)) {
      throw linkError("Invalid system ID in pinned systems.");
    }
    if (allowed && !allowed.has(id)) {
      throw linkError(`Unknown system ID: ${id}`);
    }
    if (seen.has(id)) continue;
    seen.add(id);
    validated.push(id);
  }

  if (validated.length < 1) {
    throw linkError("Select at least one system to pin.");
  }
  if (validated.length > MAX_PINNED_MODULES) {
    throw linkError(`You can pin up to ${MAX_PINNED_MODULES} systems.`);
  }

  return validated;
}

function loadPinnedModules(raw) {
  if (!Array.isArray(raw)) return null;
  const seen = new Set();
  const loaded = [];
  for (const entry of raw) {
    if (loaded.length >= MAX_PINNED_MODULES) break;
    if (typeof entry !== "string") continue;
    const id = entry.trim();
    if (!MODULE_ID_PATTERN.test(id) || seen.has(id)) continue;
    seen.add(id);
    loaded.push(id);
  }
  return loaded.length ? loaded : null;
}

function linkError(message, statusCode = 400) {
  return Object.assign(new Error(message), { statusCode });
}

export function validateCustomLink(payload, previous = null) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw linkError("Custom link details must be an object.");
  }

  const titleValue = Object.hasOwn(payload, "title") ? payload.title : previous?.title;
  if (typeof titleValue !== "string" || !titleValue.trim() ||
      titleValue.trim().length > 60 || /[\u0000-\u001f\u007f]/.test(titleValue)) {
    throw linkError("Link name must contain 1 to 60 characters.");
  }

  const raw = Object.hasOwn(payload, "url") ? payload.url : previous?.url;
  if (typeof raw !== "string" || !raw.trim() || raw.length > 2048 ||
      /[\u0000-\u0020\u007f]/.test(raw)) {
    throw linkError("Enter a valid HTTP or HTTPS link (up to 2048 characters).");
  }

  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw linkError("Enter a complete HTTP or HTTPS URL.");
  }
  if (!["https:", "http:"].includes(parsed.protocol) ||
      !parsed.hostname || parsed.username || parsed.password) {
    throw linkError("Only HTTP and HTTPS links without embedded credentials are supported.");
  }

  const pinned = Object.hasOwn(payload, "pinned")
    ? payload.pinned
    : previous?.pinned ?? true;
  if (typeof pinned !== "boolean") {
    throw linkError("Pinned must be true or false.");
  }

  return { title: titleValue.trim(), url: parsed.href, pinned };
}

function loadCustomLinks(links) {
  if (!Array.isArray(links)) return [];
  const seen = new Set();
  const validated = [];
  for (const item of links) {
    if (validated.length >= MAX_CUSTOM_LINKS) break;
    if (!CUSTOM_LINK_ID.test(item?.id || "") || seen.has(item.id)) continue;
    try {
      const values = validateCustomLink(item);
      validated.push({ id: item.id, ...values });
      seen.add(item.id);
    } catch {
      // Ignore malformed records without discarding the other preferences.
    }
  }
  return validated;
}

function decodeImageDataUrl(value, kind) {
  if (value === "") return null;
  if (typeof value !== "string") {
    throw Object.assign(new Error("Image data must be a data URL."), {
      statusCode: 400,
    });
  }

  const match = value.match(
    /^data:(image\/(?:jpeg|jpg|png|webp|gif));base64,([A-Za-z0-9+/=\s]+)$/i,
  );
  if (!match) {
    throw Object.assign(
      new Error("Only JPEG, PNG, WEBP, or GIF image data URLs are accepted."),
      { statusCode: 400 },
    );
  }

  const contentType =
    match[1].toLowerCase() === "image/jpg"
      ? "image/jpeg"
      : match[1].toLowerCase();
  const buffer = Buffer.from(match[2].replace(/\s+/g, ""), "base64");
  const limit = IMAGE_LIMITS[kind];

  if (!buffer.length || buffer.length > limit) {
    throw Object.assign(
      new Error(
        `${kind === "avatar" ? "Account picture" : "Background"} must be smaller than ${Math.round(limit / 1024 / 1024)} MB after processing.`,
      ),
      { statusCode: 413 },
    );
  }

  return { buffer, contentType };
}

async function fileExists(file) {
  try {
    const stat = await fs.stat(file);
    return stat.isFile();
  } catch {
    return false;
  }
}

export class DashboardPreferenceStore {
  constructor() {
    this.value = {
      version: 1,
      academicProgram: "day",
      hitokoto: {
        enabled: false, language: "original",
        showSpeaker: true, showSource: true,
      },
      account: {
        initialized: false,
        username: "User",
        avatar: null,
      },
      appearance: {
        initialized: false,
        background: null,
      },
      customLinks: [],
      pinnedModules: null,
      libraryFavorites: [],
      ai: defaultAiSettings(),
      updatedAt: null,
    };
    this.writeQueue = Promise.resolve();
    this.imageCache = {
      avatar: null,
      background: null,
    };
  }

  async init() {
    await fs.mkdir(DATA_DIR, { recursive: true, mode: 0o700 });

    try {
      const parsed = JSON.parse(await fs.readFile(META_FILE, "utf8"));
      this.value = {
        version: 1,
        academicProgram: ["day", "evening", "weekend"].includes(parsed?.academicProgram)
          ? parsed.academicProgram
          : "day",
        hitokoto: {
          enabled: parsed?.hitokoto?.enabled === true,
          language: ["original", "en", "ja"].includes(parsed?.hitokoto?.language)
            ? parsed.hitokoto.language : "original",
          showSpeaker: parsed?.hitokoto?.showSpeaker !== false,
          showSource: parsed?.hitokoto?.showSource !== false,
        },
        account: {
          initialized: Boolean(parsed?.account?.initialized),
          username:
            typeof parsed?.account?.username === "string" &&
            parsed.account.username.trim()
              ? parsed.account.username.trim().slice(0, 40)
              : "User",
          avatar:
            parsed?.account?.avatar &&
            typeof parsed.account.avatar.contentType === "string" &&
            typeof parsed.account.avatar.updatedAt === "string"
              ? {
                  contentType: parsed.account.avatar.contentType,
                  updatedAt: parsed.account.avatar.updatedAt,
                }
              : null,
        },
        appearance: {
          initialized: Boolean(parsed?.appearance?.initialized),
          background:
            parsed?.appearance?.background &&
            typeof parsed.appearance.background.contentType === "string" &&
            typeof parsed.appearance.background.updatedAt === "string"
              ? {
                  contentType: parsed.appearance.background.contentType,
                  updatedAt: parsed.appearance.background.updatedAt,
                }
              : null,
        },
        customLinks: loadCustomLinks(parsed?.customLinks),
        pinnedModules: loadPinnedModules(parsed?.pinnedModules),
        libraryFavorites: loadLibraryFavorites(parsed?.libraryFavorites),
        ai: loadAiSettings(parsed?.ai),
        updatedAt:
          typeof parsed?.updatedAt === "string" ? parsed.updatedAt : null,
      };
    } catch (error) {
      if (error?.code !== "ENOENT") {
        console.warn(
          "Dashboard preference store could not be loaded:",
          error.message,
        );
      }
    }

    if (this.value.account.avatar && !(await fileExists(AVATAR_FILE))) {
      this.value.account.avatar = null;
    }

    if (
      this.value.appearance.background &&
      !(await fileExists(BACKGROUND_FILE))
    ) {
      this.value.appearance.background = null;
    }
  }

  get() {
    const accountAvatar = this.value.account.avatar;
    const background = this.value.appearance.background;

    return {
      academicProgram: this.value.academicProgram,
      hitokoto: { ...this.value.hitokoto },
      account: {
        initialized: this.value.account.initialized,
        username: this.value.account.username,
        avatarUrl: accountAvatar
          ? `/api/preferences/avatar?v=${encodeURIComponent(accountAvatar.updatedAt)}`
          : "",
      },
      appearance: {
        initialized: this.value.appearance.initialized,
        backgroundUrl: background
          ? `/api/preferences/background?v=${encodeURIComponent(background.updatedAt)}`
          : "",
      },
      customLinks: this.value.customLinks.map((link) => ({ ...link })),
      pinnedModules: Array.isArray(this.value.pinnedModules)
        ? [...this.value.pinnedModules]
        : null,
      ai: {
        enabled: this.value.ai.enabled,
        provider: this.value.ai.provider,
        baseUrl: this.value.ai.baseUrl,
        model: this.value.ai.model,
        hasKey: Boolean(this.value.ai.apiKey),
        session: this.value.ai.session,
      },
      updatedAt: this.value.updatedAt,
    };
  }

  // Server-only accessor: includes the API key. Never send this to a client.
  aiConfig() {
    return { ...this.value.ai };
  }

  async persist() {
    const temp = `${META_FILE}.tmp`;
    await fs.writeFile(
      temp,
      JSON.stringify(this.value, null, 2) + "\n",
      { mode: 0o600 },
    );
    await fs.rename(temp, META_FILE);
    await fs.chmod(META_FILE, 0o600).catch(() => {});
  }

  enqueue(task) {
    const pending = this.writeQueue.then(task, task);
    this.writeQueue = pending.catch(() => {});
    return pending;
  }

  async setHitokotoSettings(input) {
    if (!input || typeof input !== "object" ||
        typeof input.enabled !== "boolean" ||
        !["original", "en", "ja"].includes(input.language) ||
        (input.showSpeaker !== undefined && typeof input.showSpeaker !== "boolean") ||
        (input.showSource !== undefined && typeof input.showSource !== "boolean")) {
      throw Object.assign(new Error("Invalid Hitokoto settings."), { statusCode: 400 });
    }
    return this.enqueue(async () => {
      this.value.hitokoto = {
        enabled: input.enabled,
        language: input.language,
        showSpeaker: input.showSpeaker !== false,
        showSource: input.showSource !== false,
      };
      this.value.updatedAt = new Date().toISOString();
      await this.persist();
      return this.get();
    });
  }

  async setAiSettings(input) {
    return this.enqueue(async () => {
      const ai = validateAiSettings(input, this.value.ai);
      if (ai.provider === "opencode-go" && !ai.session) {
        ai.session = `portal-${randomUUID()}`;
      }
      this.value.ai = ai;
      this.value.updatedAt = new Date().toISOString();
      await this.persist();
      return this.get();
    });
  }

  async setAcademicProgram(program) {
    const validated = validateAcademicProgram(program);
    return this.enqueue(async () => {
      if (this.value.academicProgram === validated) return this.get();
      this.value.academicProgram = validated;
      this.value.updatedAt = new Date().toISOString();
      await this.persist();
      return this.get();
    });
  }

  async setPinnedModules(pinnedModules, allowedIds = null) {
    const validated = validatePinnedModules(pinnedModules, allowedIds);
    return this.enqueue(async () => {
      this.value.pinnedModules = validated;
      this.value.updatedAt = new Date().toISOString();
      await this.persist();
      return this.get();
    });
  }

  async addCustomLink(payload) {
    return this.enqueue(async () => {
      const values = validateCustomLink(payload);
      if (this.value.customLinks.length >= MAX_CUSTOM_LINKS) {
        throw linkError("You can save up to 30 custom links.");
      }
      this.value.customLinks.push({ id: randomUUID(), ...values });
      this.value.updatedAt = new Date().toISOString();
      await this.persist();
      return this.get();
    });
  }

  async updateCustomLink(id, payload) {
    return this.enqueue(async () => {
      const index = this.value.customLinks.findIndex((link) => link.id === id);
      if (index < 0) throw linkError("Custom link not found.", 404);
      const previous = this.value.customLinks[index];
      const values = validateCustomLink(payload, previous);
      this.value.customLinks[index] = { id, ...values };
      this.value.updatedAt = new Date().toISOString();
      await this.persist();
      return this.get();
    });
  }

  async removeCustomLink(id) {
    return this.enqueue(async () => {
      const index = this.value.customLinks.findIndex((link) => link.id === id);
      if (index < 0) throw linkError("Custom link not found.", 404);
      this.value.customLinks.splice(index, 1);
      this.value.updatedAt = new Date().toISOString();
      await this.persist();
      return this.get();
    });
  }

  getLibraryFavorites() {
    return this.value.libraryFavorites.map((item) => ({ ...item }));
  }

  async addLibraryFavorite(payload) {
    return this.enqueue(async () => {
      const nextItem = validateLibraryFavorite(payload);
      const filtered = this.value.libraryFavorites.filter(
        (existing) => existing.id !== nextItem.id,
      );
      if (filtered.length >= MAX_LIBRARY_FAVORITES) {
        throw linkError(
          `You can favorite up to ${MAX_LIBRARY_FAVORITES} books.`,
        );
      }
      this.value.libraryFavorites = [nextItem, ...filtered];
      this.value.updatedAt = new Date().toISOString();
      await this.persist();
      return { item: { ...nextItem }, items: this.getLibraryFavorites() };
    });
  }

  async removeLibraryFavorite(id) {
    const cleanId = cleanFavoriteField(id, 64);
    if (!LIBRARY_FAVORITE_ID.test(cleanId)) {
      throw linkError("Valid catalog book ID is required.");
    }
    return this.enqueue(async () => {
      const prevLen = this.value.libraryFavorites.length;
      this.value.libraryFavorites = this.value.libraryFavorites.filter(
        (item) => item.id !== cleanId,
      );
      const removed = this.value.libraryFavorites.length !== prevLen;
      if (removed) {
        this.value.updatedAt = new Date().toISOString();
        await this.persist();
      }
      return { removed, items: this.getLibraryFavorites() };
    });
  }

  async setAccount(payload = {}) {
    return this.enqueue(async () => {
      const username = cleanUsername(payload.username);
      const hasAvatar = Object.hasOwn(payload, "avatarDataUrl");
      const decoded = hasAvatar
        ? decodeImageDataUrl(payload.avatarDataUrl, "avatar")
        : undefined;

      if (hasAvatar) {
        if (decoded) {
          const temp = `${AVATAR_FILE}.tmp`;
          await fs.writeFile(temp, decoded.buffer, { mode: 0o600 });
          await fs.rename(temp, AVATAR_FILE);
          await fs.chmod(AVATAR_FILE, 0o600).catch(() => {});
          this.imageCache.avatar = decoded.buffer;
          this.value.account.avatar = {
            contentType: decoded.contentType,
            updatedAt: new Date().toISOString(),
          };
        } else {
          await fs.rm(AVATAR_FILE, { force: true }).catch(() => {});
          this.imageCache.avatar = null;
          this.value.account.avatar = null;
        }
      }

      this.value.account.username = username;
      this.value.account.initialized = true;
      this.value.updatedAt = new Date().toISOString();
      await this.persist();
      return this.get();
    });
  }

  async setBackground(payload = {}) {
    return this.enqueue(async () => {
      if (!Object.hasOwn(payload, "backgroundDataUrl")) {
        throw Object.assign(
          new Error("backgroundDataUrl is required."),
          { statusCode: 400 },
        );
      }

      const decoded = decodeImageDataUrl(
        payload.backgroundDataUrl,
        "background",
      );

      if (decoded) {
        const temp = `${BACKGROUND_FILE}.tmp`;
        await fs.writeFile(temp, decoded.buffer, { mode: 0o600 });
        await fs.rename(temp, BACKGROUND_FILE);
        await fs.chmod(BACKGROUND_FILE, 0o600).catch(() => {});
        this.imageCache.background = decoded.buffer;
        this.value.appearance.background = {
          contentType: decoded.contentType,
          updatedAt: new Date().toISOString(),
        };
      } else {
        await fs.rm(BACKGROUND_FILE, { force: true }).catch(() => {});
        this.imageCache.background = null;
        this.value.appearance.background = null;
      }

      this.value.appearance.initialized = true;
      this.value.updatedAt = new Date().toISOString();
      await this.persist();
      return this.get();
    });
  }

  async readAvatar() {
    if (!this.value.account.avatar) return null;

    try {
      this.imageCache.avatar ??= await fs.readFile(AVATAR_FILE);
      return {
        body: this.imageCache.avatar,
        contentType: this.value.account.avatar.contentType,
      };
    } catch {
      return null;
    }
  }

  async readBackground() {
    if (!this.value.appearance.background) return null;

    try {
      this.imageCache.background ??= await fs.readFile(BACKGROUND_FILE);
      return {
        body: this.imageCache.background,
        contentType: this.value.appearance.background.contentType,
      };
    } catch {
      return null;
    }
  }
}
