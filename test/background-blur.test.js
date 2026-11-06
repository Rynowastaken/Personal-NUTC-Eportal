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

test("background blur defaults to a sharp image with the original overlay", async () => {
  const { theme, backdrop } = createThemeRuntime();
  await theme.init();
  assert.equal(theme.settings().backgroundBlur, 0);
  assert.equal(backdrop.style.filter, "");
  assert.equal(backdrop.style.inset, "");
  assert.deepEqual(overlayOpacities(backdrop.style.backgroundImage), [0.68, 0.88]);
  assert.ok(backdrop.style.backgroundImage.includes("https://example.com/background.jpg"));
});

test("live preview blurs only the image layer, not saved settings", async () => {
  const { theme, backdrop, storage } = createThemeRuntime();
  await theme.init();
  theme.previewBackgroundBlur(50);
  assert.equal(backdrop.style.filter, "blur(12px)");
  assert.equal(backdrop.style.inset, "-24px");
  theme.previewBackgroundBlur(100);
  assert.equal(backdrop.style.filter, "blur(24px)");
  assert.deepEqual(overlayOpacities(backdrop.style.backgroundImage), [0.68, 0.88]);
  assert.equal(theme.settings().backgroundBlur, 0);
  assert.equal(storage.has("nutc-portal-background-blur-v1"), false);

  // Cancel should restore the saved appearance.
  theme.previewBackgroundBlur(theme.settings().backgroundBlur);
  assert.equal(backdrop.style.filter, "");
  assert.equal(backdrop.style.inset, "");
});

test("Apply saves the blur without changing theme palette brightness", async () => {
  const storage = new Map();
  const original = createThemeRuntime(storage);
  await original.theme.init();
  original.theme.applySettings({
    ...original.theme.settings(),
    backgroundBlur: 25,
  });
  assert.equal(original.theme.settings().brightness, 1);
  assert.equal(original.theme.settings().backgroundBlur, 25);
  assert.equal(storage.get("nutc-portal-background-blur-v1"), "25");
  assert.equal(original.backdrop.style.filter, "blur(6px)");

  const reloaded = createThemeRuntime(storage);
  await reloaded.theme.init();
  assert.equal(reloaded.theme.settings().backgroundBlur, 25);
  assert.equal(reloaded.backdrop.style.filter, "blur(6px)");
});

test("background blur is clamped to 0-100%", async () => {
  const { theme, backdrop } = createThemeRuntime();
  await theme.init();
  theme.applySettings({ ...theme.settings(), backgroundBlur: -100 });
  assert.equal(theme.settings().backgroundBlur, 0);
  assert.equal(backdrop.style.filter, "");
  theme.applySettings({ ...theme.settings(), backgroundBlur: 500 });
  assert.equal(theme.settings().backgroundBlur, 100);
  assert.equal(backdrop.style.filter, "blur(24px)");
});
