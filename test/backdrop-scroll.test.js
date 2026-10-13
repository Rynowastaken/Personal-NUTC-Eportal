import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const script = await readFile(
  new URL("../public/backdrop-scroll.js", import.meta.url),
  "utf8",
);

function createScrollPage({ pageHeight = 2000, viewportHeight = 800, reducedMotion = false } = {}) {
  const events = { window: new Map(), document: new Map(), media: new Map() };
  const frames = [];
  const backdrop = { style: {} };
  const preference = {
    matches: reducedMotion,
    addEventListener(name, callback) {
      events.media.set(name, callback);
    },
  };
  const window = {
    scrollY: 0,
    pageYOffset: 0,
    innerHeight: viewportHeight,
    matchMedia: () => preference,
    addEventListener(name, callback) {
      events.window.set(name, callback);
    },
    requestAnimationFrame(callback) {
      frames.push(callback);
    },
  };
  const document = {
    hidden: false,
    body: { scrollHeight: pageHeight },
    documentElement: { scrollHeight: pageHeight, clientHeight: viewportHeight },
    getElementById(id) {
      return id === "portalBackdrop" ? backdrop : null;
    },
    addEventListener(name, callback) {
      events.document.set(name, callback);
    },
  };
  vm.runInNewContext(script, { window, document }, { filename: "backdrop-scroll.js" });

  function flush() {
    const pending = frames.splice(0);
    pending.forEach((frame) => frame());
  }
  return {
    backdrop,
    document,
    window,
    preference,
    frames,
    flush,
    fireWindow: (name) => events.window.get(name)?.(),
    fireDocument: (name) => events.document.get(name)?.(),
    fireMotion: () => events.media.get("change")?.(),
  };
}

test("background follows downward scroll through the whole page and reverses on scroll up", () => {
  const page = createScrollPage();
  assert.equal(page.backdrop.style.transform, "translate3d(0, 0.00px, 0)");
  page.window.scrollY = 600;
  page.fireWindow("scroll");
  page.flush();
  assert.equal(page.backdrop.style.transform, "translate3d(0, 72.00px, 0)");

  page.window.scrollY = 1200;
  page.fireWindow("scroll");
  page.flush();
  assert.equal(page.backdrop.style.transform, "translate3d(0, 144.00px, 0)");

  page.window.scrollY = 200;
  page.fireWindow("scroll");
  page.flush();
  assert.equal(page.backdrop.style.transform, "translate3d(0, 24.00px, 0)");
});

test("scroll updates are frame-throttled and clamped at overscroll limits", () => {
  const page = createScrollPage();
  page.window.scrollY = 5000;
  page.fireWindow("scroll");
  page.fireWindow("scroll");
  page.fireWindow("scroll");
  assert.equal(page.frames.length, 1);
  page.flush();
  assert.equal(page.backdrop.style.transform, "translate3d(0, 144.00px, 0)");

  page.window.scrollY = -100;
  page.fireWindow("scroll");
  page.flush();
  assert.equal(page.backdrop.style.transform, "translate3d(0, 0.00px, 0)");
});

test("reduced-motion preference disables parallax and can be switched live", () => {
  const page = createScrollPage({ reducedMotion: true });
  page.window.scrollY = 1000;
  page.fireWindow("scroll");
  page.flush();
  assert.equal(page.backdrop.style.transform, "translate3d(0, 0, 0)");

  page.preference.matches = false;
  page.fireMotion();
  page.flush();
  assert.equal(page.backdrop.style.transform, "translate3d(0, 120.00px, 0)");

  page.preference.matches = true;
  page.fireMotion();
  page.flush();
  assert.equal(page.backdrop.style.transform, "translate3d(0, 0, 0)");
});

test("resize and restored navigation update progress, and non-scroll pages remain still", () => {
  const page = createScrollPage({ pageHeight: 800, viewportHeight: 800 });
  page.window.scrollY = 200;
  page.fireWindow("scroll");
  page.flush();
  assert.equal(page.backdrop.style.transform, "translate3d(0, 0.00px, 0)");

  page.document.body.scrollHeight = 1600;
  page.document.documentElement.scrollHeight = 1600;
  page.fireWindow("resize");
  page.flush();
  assert.equal(page.backdrop.style.transform, "translate3d(0, 36.00px, 0)");

  page.window.scrollY = 400;
  page.fireWindow("pageshow");
  page.flush();
  assert.equal(page.backdrop.style.transform, "translate3d(0, 72.00px, 0)");
});

test("background layer has enough overscan and no fixed background attachment", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  assert.match(html, /id="portalBackdrop"[\s\S]*?style="inset: -72px 0; will-change: transform;"/);
  assert.doesNotMatch(html, /bg-center bg-fixed/);
  assert.match(html, /<script src="\/backdrop-scroll\.js\?v=1"><\/script>/);
});
