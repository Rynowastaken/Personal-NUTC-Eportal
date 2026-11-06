import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const theme = () => readFile(new URL("../public/userscript/tronclass-theme.user.js", import.meta.url), "utf8");

test("exam radios and button labels are centred by the theme", async () => {
  const css = await theme();
  assert.match(css, /\.exam-paper \.subject-options > li\.option input\[type\] \{ display: block;/);
  assert.match(css, /\.button, \.ivu-btn, button\.button \{[^}]*align-items: center;[^}]*padding-top: 0 !important;/);
  // display is not forced, so TronClass's own hiding (.ng-hide) still wins.
  assert.doesNotMatch(css, /display: inline-flex !important;\s*align-items: center;\s*justify-content: center;\s*min-height: 32px/);
});

test("dark teacher text is lightened but student answers are never touched", async () => {
  const script = await theme();
  assert.match(script, /\.tcx-rich-ink \{ color: var\(--tcx-ink, var\(--tcx-text\)\) !important; \}/);
  assert.match(script, /const EDITOR = "\[contenteditable\], \.simditor";/);
  assert.match(script, /element\.closest\(EDITOR\)/);
});
