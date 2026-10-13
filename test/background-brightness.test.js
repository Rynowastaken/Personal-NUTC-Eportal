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

test("background brightness defaults to the original image darkness", async () => {
  const { theme, backdrop } = createThemeRuntime();
  await theme.init();
  assert.equal(theme.settings().backgroundBrightness, 100);
  assert.deepEqual(overlayOpacities(backdrop.style.backgroundImage), [0.68, 0.88]);
  assert.ok(backdrop.style.backgroundImage.includes("https://example.com/background.jpg"));
});

test("live preview changes only the image overlay, not saved settings", async () => {
  const { theme, backdrop, storage } = createThemeRuntime();
  await theme.init();
  theme.previewBackgroundBrightness(0);
  assert.deepEqual(overlayOpacities(backdrop.style.backgroundImage), [0.98, 0.99]);
  theme.previewBackgroundBrightness(200);
  assert.deepEqual(overlayOpacities(backdrop.style.backgroundImage), [0.1, 0.2]);
  assert.equal(theme.settings().backgroundBrightness, 100);
  assert.equal(storage.has("nutc-portal-background-brightness-v1"), false);

  // Cancel should restore the saved appearance.
  theme.previewBackgroundBrightness(theme.settings().backgroundBrightness);
  assert.deepEqual(overlayOpacities(backdrop.style.backgroundImage), [0.68, 0.88]);
});

test("Apply saves image brightness without changing theme palette brightness", async () => {
  const storage = new Map();
  const original = createThemeRuntime(storage);
  await original.theme.init();
  original.theme.applySettings({
    ...original.theme.settings(),
    backgroundBrightness: 150,
  });
  assert.equal(original.theme.settings().brightness, 1);
  assert.equal(original.theme.settings().backgroundBrightness, 150);
  assert.equal(storage.get("nutc-portal-background-brightness-v1"), "150");
  assert.deepEqual(overlayOpacities(original.backdrop.style.backgroundImage), [0.39, 0.54]);

  const reloaded = createThemeRuntime(storage);
  await reloaded.theme.init();
  assert.equal(reloaded.theme.settings().backgroundBrightness, 150);
  assert.deepEqual(overlayOpacities(reloaded.backdrop.style.backgroundImage), [0.39, 0.54]);
});

test("image brightness is clamped and 0% remains a valid saved value", async () => {
  const { theme, backdrop } = createThemeRuntime();
  await theme.init();
  theme.applySettings({ ...theme.settings(), backgroundBrightness: -100 });
  assert.equal(theme.settings().backgroundBrightness, 0);
  assert.deepEqual(overlayOpacities(backdrop.style.backgroundImage), [0.98, 0.99]);
  theme.applySettings({ ...theme.settings(), backgroundBrightness: 500 });
  assert.equal(theme.settings().backgroundBrightness, 200);
});
