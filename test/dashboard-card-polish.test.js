import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");

function loadModuleCardRenderer(source) {
  const begin = source.indexOf("function createDashboardModuleCard(");
  const end = source.indexOf("\nfunction renderModules(", begin);
  assert.ok(begin >= 0 && end > begin, "shared card renderer must exist");
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
  return new Function("document",
    source.slice(begin, end) + "\nreturn createDashboardModuleCard;",
  )(document);
}

test("built-in modules and pinned links share smooth card rendering", async () => {
  const source = await read("public/app.js");
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
  assert.doesNotMatch(source.slice(
    source.indexOf("function createDashboardModuleCard("),
    source.indexOf("\nfunction renderModules(")
  ), /mouseenter|mouseleave|card\.style\.background\s*=/);
});

test("cards use softened gradient borders instead of hard inline color borders", async () => {
  const css = await read("frontend/src/styles.css");
  assert.match(css, /\.dashboard-module-card\s*\{[\s\S]*?border: 1px solid transparent;/);
  assert.match(css, /\.dashboard-module-card\s*\{[\s\S]*?padding-box,[\s\S]*?border-box;/);
  assert.match(css, /\.dashboard-module-card::before\s*\{[\s\S]*?opacity: 0;[\s\S]*?transition: opacity/);
  assert.match(css, /\.dashboard-module-card:hover::before,[\s\S]*?opacity: 1;/);
  assert.match(css, /\.dashboard-module-icon,[\s\S]*?\.dashboard-module-action\s*\{[\s\S]*?border: 1px solid transparent;/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.dashboard-module-card/);
});

test("glass action buttons match shadcn version and preserve existing dimensions", async () => {
  const css = await read("frontend/src/styles.css");
  const html = await read("public/index.html");
  assert.match(css, /\.shadcn-dashboard-glass\s*\{[\s\S]*?border: 1px solid transparent;/);
  assert.match(css, /\.shadcn-dashboard-glass::before[\s\S]*?transition: opacity/);
  assert.match(html, /\.dashboard-tinted-glass\s*\{[\s\S]*?border: 1px solid transparent;/);
  assert.match(html, /\.dashboard-tinted-glass::before[\s\S]*?transition: opacity/);
  assert.match(html, /id="scheduleRefreshButton"[\s\S]*?min-h-\[36px\]/);
  assert.match(html, /id="absenceRefreshButton"[\s\S]*?min-h-\[36px\]/);
  assert.match(html, /id="manageCustomLinks"[\s\S]*?min-h-\[42px\]/);
  assert.match(html, /\/generated\/site\.css\?v=3/);
  assert.match(html, /\/app\.js\?v=62/);
});
