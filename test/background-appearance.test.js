import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const themeSource = await readFile(
  new URL("../public/theme.js", import.meta.url),
  "utf8",
);

function createThemeRuntime(storage = new Map()) {
  const backdrop = { style: {} };
  const root = { style: { setProperty() {} } };
  const window = { dispatchEvent() {} };

  class MockImage {
    set src(_value) {
      queueMicrotask(() => this.onerror?.());
    }
  }

  const context = {
    window,
    document: {
      getElementById: (id) => id === "portalBackdrop" ? backdrop : null,
      documentElement: root,
    },
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, String(value)),
      removeItem: (key) => storage.delete(key),
    },
    fetch: async () => ({
      ok: true,
      json: async () => ({
        appearance: {
          initialized: true,
          backgroundUrl: "https://example.com/background.jpg",
        },
      }),
    }),
    Image: MockImage,
    CustomEvent: class {
      constructor(type, options) {
        this.type = type;
        this.detail = options.detail;
      }
    },
    queueMicrotask,
  };

  vm.runInNewContext(themeSource, context, { filename: "theme.js" });
  return { theme: window.NutcTheme, backdrop, storage };
}

function overlayOpacities(backgroundImage) {
  const match = backgroundImage.match(
    /^linear-gradient\(180deg, rgba\(12,10,14,([\d.]+)\), rgba\(12,10,14,([\d.]+)\)\)/,
  );
  assert.ok(match, "A background image has its own darkening overlay");
  return [Number(match[1]), Number(match[2])];
}

test("the background defaults to the original overlay with no blur", async () => {
  const { theme, backdrop } = createThemeRuntime();
  await theme.init();
  assert.equal(theme.settings().backgroundBrightness, 100);
  assert.equal(theme.settings().backgroundBlur, 0);
  assert.deepEqual(overlayOpacities(backdrop.style.backgroundImage), [0.68, 0.88]);
  assert.equal(backdrop.style.filter, "");
  assert.equal(backdrop.style.margin, "");
  assert.ok(backdrop.style.backgroundImage.includes("https://example.com/background.jpg"));
});

test("a brightness saved before blur existed still applies", async () => {
  const storage = new Map([["nutc-portal-background-brightness-v1", "140"]]);
  const { theme, backdrop } = createThemeRuntime(storage);
  await theme.init();
  assert.equal(theme.settings().backgroundBrightness, 140);
  assert.deepEqual(overlayOpacities(backdrop.style.backgroundImage), [0.448, 0.608]);
  assert.equal(backdrop.style.filter, "");
});

test("live preview shows brightness and blur together without saving", async () => {
  const { theme, backdrop, storage } = createThemeRuntime();
  await theme.init();
  theme.previewBackground({ backgroundBrightness: 0, backgroundBlur: 50 });
  assert.deepEqual(overlayOpacities(backdrop.style.backgroundImage), [0.98, 0.99]);
  assert.equal(backdrop.style.filter, "blur(12px)");
  assert.equal(backdrop.style.margin, "-24px");
  // The page's own overflow (72px for the dashboard's scroll effect) is
  // never replaced.
  assert.equal(backdrop.style.inset, undefined);
  theme.previewBackground({ backgroundBrightness: 200, backgroundBlur: 100 });
  assert.deepEqual(overlayOpacities(backdrop.style.backgroundImage), [0.1, 0.2]);
  assert.equal(backdrop.style.filter, "blur(24px)");
  assert.equal(theme.settings().backgroundBrightness, 100);
  assert.equal(theme.settings().backgroundBlur, 0);
  assert.equal(storage.has("nutc-portal-background-brightness-v1"), false);
  assert.equal(storage.has("nutc-portal-background-blur-v1"), false);

  // Cancel should restore the saved appearance.
  theme.previewBackground(theme.settings());
  assert.deepEqual(overlayOpacities(backdrop.style.backgroundImage), [0.68, 0.88]);
  assert.equal(backdrop.style.filter, "");
  assert.equal(backdrop.style.margin, "");
});

test("Apply saves brightness and blur without changing theme palette brightness", async () => {
  const storage = new Map();
  const original = createThemeRuntime(storage);
  await original.theme.init();
  original.theme.applySettings({
    ...original.theme.settings(),
    backgroundBrightness: 150,
    backgroundBlur: 25,
  });
  assert.equal(original.theme.settings().brightness, 1);
  assert.equal(storage.get("nutc-portal-background-brightness-v1"), "150");
  assert.equal(storage.get("nutc-portal-background-blur-v1"), "25");
  assert.deepEqual(overlayOpacities(original.backdrop.style.backgroundImage), [0.39, 0.54]);
  assert.equal(original.backdrop.style.filter, "blur(6px)");

  const reloaded = createThemeRuntime(storage);
  await reloaded.theme.init();
  assert.equal(reloaded.theme.settings().backgroundBrightness, 150);
  assert.equal(reloaded.theme.settings().backgroundBlur, 25);
  assert.deepEqual(overlayOpacities(reloaded.backdrop.style.backgroundImage), [0.39, 0.54]);
  assert.equal(reloaded.backdrop.style.filter, "blur(6px)");
});

test("brightness is clamped to 0-200% and blur to 0-100%", async () => {
  const { theme, backdrop } = createThemeRuntime();
  await theme.init();
  theme.applySettings({ ...theme.settings(), backgroundBrightness: -100, backgroundBlur: -100 });
  assert.equal(theme.settings().backgroundBrightness, 0);
  assert.equal(theme.settings().backgroundBlur, 0);
  assert.deepEqual(overlayOpacities(backdrop.style.backgroundImage), [0.98, 0.99]);
  assert.equal(backdrop.style.filter, "");
  theme.applySettings({ ...theme.settings(), backgroundBrightness: 500, backgroundBlur: 500 });
  assert.equal(theme.settings().backgroundBrightness, 200);
  assert.equal(theme.settings().backgroundBlur, 100);
  assert.equal(backdrop.style.filter, "blur(24px)");
});
