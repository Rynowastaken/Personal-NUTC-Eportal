import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL("../" + path, import.meta.url), "utf8");

async function createDropdown() {
  const source = await read("public/app.js");
  const start = source.indexOf("function setAcademicProgramMenuOpen(");
  const end = source.indexOf("\nfunction moveAcademicProgramFocus(", start);
  assert.ok(start !== -1 && end > start, "Academic dropdown handler exists");

  const options = {
    dataset: { state: "closed" },
    inert: true,
    attributes: { "aria-hidden": "true" },
    setAttribute(name, value) { this.attributes[name] = value; },
  };
  const chevronClasses = new Set();
  const trigger = {
    disabled: false,
    attributes: { "aria-expanded": "false" },
    setAttribute(name, value) { this.attributes[name] = value; },
    focus(options) { this.lastFocusOptions = options; },
  };
  const selected = {
    dataset: { academicProgram: "day" },
    focus(options) { this.lastFocusOptions = options; },
  };
  const chevron = { classList: { toggle(name, enabled) {
    if (enabled) chevronClasses.add(name);
    else chevronClasses.delete(name);
  } } };
  const dialog = { open: true };
  const fn = new Function(
    "academicProgramSelect", "academicProgramOptions", "academicProgramChevron",
    "themeDialog", "academicProgramChoices", "stagedAcademicProgram",
    source.slice(start, end) + "\nreturn setAcademicProgramMenuOpen;",
  );
  return {
    options, trigger, selected, chevronClasses, dialog,
    update: fn(trigger, options, chevron, dialog, [selected], "day"),
  };
}

test("opening animates via data-state, exposes options and focuses selection", async () => {
  const dropdown = await createDropdown();
  dropdown.update(true, { focusSelected: true });

  assert.equal(dropdown.options.dataset.state, "open");
  assert.equal(dropdown.options.inert, false);
  assert.equal(dropdown.options.attributes["aria-hidden"], "false");
  assert.equal(dropdown.trigger.attributes["aria-expanded"], "true");
  assert.equal(dropdown.chevronClasses.has("rotate-180"), true);
  assert.deepEqual(dropdown.selected.lastFocusOptions, { preventScroll: true });
});

test("closing keeps menu mounted for fade-out but excludes it from tab order", async () => {
  const dropdown = await createDropdown();
  dropdown.update(true);
  dropdown.update(false, { returnFocus: true });

  assert.equal(dropdown.options.dataset.state, "closed");
  assert.equal(dropdown.options.inert, true);
  assert.equal(dropdown.options.attributes["aria-hidden"], "true");
  assert.equal(dropdown.trigger.attributes["aria-expanded"], "false");
  assert.equal(dropdown.chevronClasses.has("rotate-180"), false);
  assert.deepEqual(dropdown.trigger.lastFocusOptions, { preventScroll: true });
});

test("cannot open while settings are closed or select is disabled", async () => {
  const dropdown = await createDropdown();
  dropdown.dialog.open = false;
  dropdown.update(true);
  assert.equal(dropdown.options.dataset.state, "closed");

  dropdown.dialog.open = true;
  dropdown.trigger.disabled = true;
  dropdown.update(true);
  assert.equal(dropdown.options.dataset.state, "closed");
});

test("styles animate both directions and respect reduced-motion preferences", async () => {
  const css = await read("frontend/src/styles.css");
  const html = await read("public/index.html");
  assert.match(css, /\.academic-program-dropdown-menu\s*\{[\s\S]*?opacity: 0;[\s\S]*?visibility: hidden;[\s\S]*?transform:/);
  assert.match(css, /\.academic-program-dropdown-menu\[data-state="open"\]\s*\{[\s\S]*?opacity: 1;[\s\S]*?visibility: visible;/);
  assert.match(css, /visibility 0s linear 220ms/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(html, /id="academicProgramOptions"[\s\S]*?aria-hidden="true"[\s\S]*?data-state="closed"[\s\S]*?inert/);
  assert.match(html, /app\.js\?v=\d+/);
  assert.match(html, /site\.css\?v=\d+/);
});
