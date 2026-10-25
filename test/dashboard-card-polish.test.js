import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");

function loadModuleCardRenderer(source) {
  assert.match(source, /export function createDashboardModuleCard\(/);
  const document = {
    createElement(tag) {
      return {
        tag,
        style: {
          properties: {},
          setProperty(name, value) { this.properties[name] = value; },
        },
        attributes: {},
        children: [],
        append(...nodes) { this.children.push(...nodes); },
        setAttribute(name, value) { this.attributes[name] = value; },
      };
    },
  };
  const window = {
    NutcTheme: {
      rgba: (_hex, alpha) => "rgba(219,147,158," + alpha + ")",
    },
  };
  return new Function("document", "window",
    source.replace(/^export /gm, "") + "\nreturn createDashboardModuleCard;",
  )(document, window);
}

test("built-in modules and pinned links share smooth card rendering", async () => {
  const source = await read("public/dashboard-cards.js");
  const makeCard = loadModuleCardRenderer(source);
  const opts = {
    accent: "#db939e",
    iconName: "graduation-cap",
    titleText: "學生管理",
    descriptionText: "課表、學籍與學生資訊",
  };
  const native = makeCard(opts);
  const custom = makeCard({
    ...opts, tag: "a", iconName: "link-2", trailingIcon: "external-link",
  });

  assert.equal(native.tag, "button");
  assert.equal(native.type, "button");
  assert.equal(custom.tag, "a");
  assert.equal(native.className, custom.className);
  assert.match(native.className, /dashboard-module-card/);
  assert.match(native.children[0].className, /dashboard-module-icon/);
  assert.match(native.children[2].className, /dashboard-module-action/);
  assert.equal(native.style.properties["--module-accent"], opts.accent);
  assert.equal(custom.style.properties["--module-accent"], opts.accent);
  assert.equal(custom.children[2].children[0].attributes["data-lucide"], "external-link");
  assert.equal(custom.children[1].children[0].textContent, opts.titleText);
  // The browser may still have yesterday's generated CSS after a dashboard
  // git update. These surfaces must be visible from JS alone on mobile.
  assert.match(native.style.background, /^linear-gradient\(/);
  assert.match(native.style.border, /^1px solid rgba\(/);
  assert.match(native.children[0].style.background, /^rgba\(/);
  assert.match(native.children[0].style.border, /^1px solid rgba\(/);
  assert.match(native.children[2].style.background, /^rgba\(/);
  assert.match(native.children[2].style.border, /^1px solid rgba\(/);
  assert.equal(custom.style.background, native.style.background);
  for (const card of [native, custom]) {
    // Simulate a mobile device with an older Tailwind stylesheet. Even with
    // missing arbitrary rounded-* utilities, the renderer rounds each surface.
    assert.equal(card.style.borderRadius, "20px");
    assert.equal(card.style.overflow, "hidden");
    assert.equal(card.style.backgroundClip, "padding-box");
    assert.equal(card.style.border, "1px solid rgba(255,255,255,.13)");
    assert.equal(card.children[0].style.borderRadius, "12px");
    assert.equal(card.children[2].style.borderRadius, "10px");
    assert.equal(card.children[0].style.backgroundClip, "padding-box");
    assert.equal(card.children[2].style.backgroundClip, "padding-box");
  }
  // Assigning background resets background-clip back to border-box in CSS.
  // Applying clip last prevents tinted fills from bleeding into card edges.
  for (const name of ["card", "icon", "arrow"]) {
    const background = source.indexOf(name + ".style.background =");
    const clip = source.indexOf(name + '.style.backgroundClip = "padding-box";');
    assert.ok(background >= 0 && clip > background,
      name + " must apply backgroundClip after the background shorthand");
  }
  assert.doesNotMatch(source, /mouseenter|mouseleave/);
});

test("single rounded border and clean surfaces come from dashboard CSS", async () => {
  const css = await read("public/dashboard.css");
  const generated = await read("frontend/src/styles.css");
  const html = await read("public/index.html");
  const start = css.indexOf(".dashboard-module-card {");
  const componentCSS = css.slice(start);
  assert.ok(start >= 0, "dashboard stylesheet must own the card chrome");
  assert.doesNotMatch(generated, /\.dashboard-module-card\s*\{/);
  assert.match(componentCSS, /border-radius: 20px;/);
  assert.match(componentCSS, /overflow: hidden;/);
  assert.match(componentCSS, /background-clip: padding-box;/);
  const cardRule = componentCSS.slice(0, componentCSS.indexOf("}"));
  assert.ok(cardRule.indexOf("background-clip: padding-box;") >
    cardRule.indexOf("background: linear-gradient("),
    "background-clip must follow the shorthand, even without JS");
  assert.match(componentCSS, /border: 1px solid rgba\(255,255,255,\.13\);/);
  assert.match(componentCSS, /\.dashboard-module-card::before\s*\{[\s\S]*?content: none;/);
  assert.match(componentCSS, /\.dashboard-module-icon\s*\{\s*border-radius: 12px;/);
  assert.match(componentCSS, /\.dashboard-module-action\s*\{\s*border-radius: 10px;/);
  assert.match(componentCSS, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(html, /\/dashboard\.css\?v=2/);
  assert.match(html, /\/app\.js\?v=64/);
  assert.match(html, /\/generated\/site\.css\?v=5/);
});

test("glass action buttons match shadcn version and preserve existing dimensions", async () => {
  const css = await read("frontend/src/styles.css");
  const html = await read("public/index.html");
  const dashboardCss = await read("public/dashboard.css");
  assert.match(css, /\.shadcn-dashboard-glass\s*\{[\s\S]*?border: 1px solid transparent;/);
  assert.match(css, /\.shadcn-dashboard-glass::before[\s\S]*?transition: opacity/);
  assert.match(dashboardCss, /\.dashboard-tinted-glass\s*\{[\s\S]*?border: 1px solid transparent;/);
  assert.match(dashboardCss, /\.dashboard-tinted-glass::before[\s\S]*?transition: opacity/);
  assert.match(html, /id="scheduleRefreshButton"[\s\S]*?min-h-\[36px\]/);
  assert.match(html, /id="absenceRefreshButton"[\s\S]*?min-h-\[36px\]/);
  assert.match(html, /id="manageCustomLinks"[\s\S]*?min-h-\[42px\]/);
  assert.match(html, /\/generated\/site\.css\?v=5/);
  assert.match(html, /\/app\.js\?v=64/);
});
