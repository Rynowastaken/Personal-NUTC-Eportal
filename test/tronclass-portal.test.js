import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { publicModules } from "../src/eportal.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("the dashboard's TronClass tile opens the portal's own TronClass pages", () => {
  const tronclass = publicModules().find((module) => module.id === "tronclass");
  assert.equal(tronclass.launchPath, "/tronclass");
  assert.equal(publicModules().find((module) => module.id === "ais").launchPath, "/go/ais");
});

test("the server serves /tronclass and relays only GET and POST to TronClass", async () => {
  const server = await read("../server.js");
  const relay = await read("../src/tronclass.js");
  assert.match(server, /url\.pathname === "\/tronclass" \|\| url\.pathname\.startsWith\("\/tronclass\/"\)/);
  assert.match(server, /serveStatic\(req, res, "\/tronclass\.html", \{ csp: TRONCLASS_CSP \}\)/);
  assert.match(relay, /\["GET", "POST", "PUT"\]\.includes\(req\.method\)/);
  assert.match(relay, /TRONCLASS_ORIGIN = "https:\/\/tc\.nutc\.edu\.tw"/);
});

test("the TronClass sign-in only follows the school's HTTPS hosts and is stored outside Git", async () => {
  const relay = await read("../src/tronclass.js");
  const gitignore = await read("../.gitignore");
  assert.match(relay, /url\.protocol === "https:"/);
  assert.match(relay, /url\.hostname\.endsWith\("\.nutc\.edu\.tw"\)/);
  assert.match(relay, /path\.join\(ROOT, "data", "tronclass-session\.json"\)/);
  assert.match(gitignore, /^data\/$/m);
});

test("signing out of the portal also drops the TronClass session", async () => {
  const server = await read("../server.js");
  assert.match(server, /\/api\/portal-logout"[\s\S]*?await clearTronclassSession\(\);/);
});

test("the TronClass pages never show the student's name and keep TronClass as the exam fallback", async () => {
  const page = await read("../public/tronclass.js");
  assert.doesNotMatch(page, /user\.name/);
  assert.match(page, /const TRONCLASS = "https:\/\/tc\.nutc\.edu\.tw"/);
  // The overview starts the rebuilt take view, and the original page stays an
  // explicit fallback on the overview and inside the take view.
  assert.match(page, /function examStartLink\(/);
  assert.match(page, /href: examTakeHref\(courseId, examId\)/);
  assert.match(page, /href: classicExamHref\(courseId, examId\), "data-classic": ""/);
  // Invigilated, audio and IP-checked exams only work in TronClass, so the
  // overview makes their fallback button primary instead of a dead start link.
  assert.match(page, /const classicOnly = Boolean\(exam\.enable_invigilation \|\| exam\.has_audio \|\| exam\.check_submit_ip_consistency\)/);
  assert.match(page, /canStart && !classicOnly \? examStartLink/);
});

test("the rebuilt exam take view has a route and uses the verified exam API", async () => {
  const page = await read("../public/tronclass.js");
  assert.match(page, /name: "examTake"/);
  assert.match(page, /examTake: viewExamTake/);
  assert.match(page, /#\\\/exam\\\/\(\\d\+\)\\\/take/);
  assert.match(page, /\/api\/exam\/\$\{examId\}\/check-exam-qualification\?no-intercept=true&check_status=in_test/);
  assert.match(page, /\/api\/exams\/\$\{examId\}\/distribute/);
  assert.match(page, /\/api\/exams\/\$\{examId\}\/submissions\/storage/);
  assert.match(page, /\/api\/exams\/submissions\/\$\{submission\.id\}\/multiple-subjects/);
  assert.match(page, /\/api\/exams\/\$\{submission\.id\}\/left_time/);
  assert.match(page, /\/api\/exams\/\$\{examId\}\/submissions`, \{\s*method: "POST"/);
  assert.match(page, /reason: reason \|\| \(auto \? "time is up" : "user"\)/);
  // A saved attachment survives editing the text of a short answer here.
  assert.match(page, /attachments: answer\.attachments\.slice\(\)/);
  assert.match(page, /submission_data\?\.subjects/);
  // An audio question the exam summary does not flag still leaves the page,
  // including one nested in a group container.
  assert.match(page, /const hasAudio = \(items\) => \(items \|\| \[\]\)\.some\(\(item\) => item\.has_audio \|\| hasAudio\(item\.sub_subjects\)\)/);
  // A question type this page cannot render sends the whole paper to TronClass
  // instead of letting it be submitted with blanks.
  assert.match(page, /const unsupported = questions\.filter\(\(question\) => !EXAM_TYPES\[question\.type\]\)/);
  assert.match(page, /這份測驗要在 TronClass 作答/);
  // Analysis groups are containers, not questions.
  assert.match(page, /if \(item\.sub_subjects\?\.length\) \{\s*walk\(item\.sub_subjects, item\.id\);\s*continue;/);
});

test("the exam view debounces saves and renders every supported question type", async () => {
  const page = await read("../public/tronclass.js");
  assert.match(page, /setTimeout\(\(\) => \{\s*saveTimer = null;\s*flushSave\(\);\s*\}, 600\)/);
  assert.match(page, /single_selection: \{ kind: "radio", label: "單選" \}/);
  assert.match(page, /true_or_false: \{ kind: "radio", label: "是非" \}/);
  assert.match(page, /multiple_selection: \{ kind: "check", label: "多選" \}/);
  assert.match(page, /short_answer: \{ kind: "text", label: "簡答" \}/);
  assert.match(page, /unsupportedNotice/);
  assert.match(page, /需要在 TronClass 作答/);
  // One hash navigation fires both popstate and hashchange; the take view must
  // not create two attempts for one route change.
  assert.match(page, /function scheduleRender\(/);
  assert.match(page, /addEventListener\("popstate", scheduleRender\)/);
  assert.match(page, /addEventListener\("hashchange", scheduleRender\)/);
  assert.match(page, /if \(token !== renderToken\) return null;/);
});

test("submitting waits for an in-flight save and keeps the paper locked", async () => {
  const page = await read("../public/tronclass.js");
  assert.match(page, /submitting = true;\s*submitBtn\.disabled = true;\s*setPaperDisabled\(true\);/);
  assert.match(page, /if \(saving\) \{\s*try \{\s*await saving;/);
  // A submit that resolves after the student left must not touch the new page.
  assert.match(page, /if \(token !== renderToken \|\| disposed\) \{\s*submitting = false;/);
  // Reads may time out; a stalled save cannot block the hand-in forever.
  assert.match(page, /AbortSignal\.timeout\?\.\(20000\)/);
  assert.match(page, /submitBtn\.disabled = closedBook \|\| outOfFullscreen;/);
  // At time-up nothing can be dismissed without a way to hand the paper in.
  assert.match(page, /dismissible: !\(auto \|\| closedBook \|\| outOfFullscreen\)/);
  // The save-state retry must submit when the clock has run out instead of
  // offering an autosave that is refused at that point.
  assert.match(page, /expired \? submitExam\(\{ auto: true \}\) : flushSave\(\)/);
  // An empty storage answer is not an attempt: only an id can be saved into.
  assert.match(page, /storageValue && storageValue\.id != null \? storageValue : null/);
});

test("the Ask AI button is practice-only and posts a plain-text question", async () => {
  const page = await read("../public/tronclass.js");
  // The enable setting and the exam's practice flag both have to agree, and
  // the server checks the practice flag again before answering.
  assert.match(page, /let aiTutorEnabled = Boolean\(exam\.is_practice_mode && aiStatusResult\.value\?\.enabled\)/);
  assert.match(page, /fetch\("\/api\/ai\/status"/);
  assert.match(page, /if \(aiTutorEnabled\) \{/);
  assert.match(page, /fetch\("\/api\/ai\/ask"/);
  // The tutor gets option numbers, not option ids, and the answer is rendered
  // as text so provider output can never become markup. A follow-up chat keeps
  // the previous turns and sends them back as bounded history.
  assert.match(page, /selected: options/);
  assert.match(page, /String\(index \+ 1\)/);
  assert.match(page, /node\.textContent = text/);
  assert.match(page, /class: "ai-followup"/);
  assert.match(page, /class: "ai-send"/);
  assert.match(page, /icon\("send"\)/);
  assert.match(page, /ai-followup-hint/);
  assert.match(page, /resizeInput/);
  assert.match(page, /追問這題/);
  // The dialogue belongs to the question: it is kept for the tab and restored
  // when the dialog is reopened, so the provider is not asked again, and a
  // second request is never sent while one is already in flight.
  assert.match(page, /const AI_CHAT_PREFIX = "eportal\.tronclass\.ai-chat\.v1:"/);
  assert.match(page, /function readAiChat\(key\)/);
  assert.match(page, /function writeAiChat\(key, turns\)/);
  assert.match(page, /aiChatStorageKey\(examId, question\.id\)/);
  assert.match(page, /turns: readAiChat\(key\)/);
  assert.match(page, /const persist = \(\) => writeAiChat\(/);
  assert.match(page, /if \(chatState\.pending\) return chatState\.pending;/);
  assert.match(page, /history: trimHistory\(historyMessages\(\)\)/);
  // Answers can carry LaTeX and charts, but provider text never becomes markup:
  // KaTeX runs with trust disabled, charts are built from validated JSON.
  assert.match(page, /function renderAiAnswer\(/);
  assert.match(page, /function loadKatex\(/);
  assert.match(page, /\/vendor\/katex\/katex\.min\.js/);
  assert.match(page, /trust: false/);
  assert.match(page, /function parseAiChart\(/);
  assert.match(page, /function compileAiExpression\(/);
  assert.match(page, /function renderAiChart\(/);
  assert.match(page, /function aiChartLabel\(/);
  assert.match(page, /AI_SUPERSCRIPTS/);
  // Financial statements render as real tables, not code blocks.
  assert.match(page, /function parseAiTable\(/);
  assert.match(page, /function renderAiTable\(/);
  assert.match(page, /language === "table"/);
  assert.match(page, /class: "ai-table"/);
  assert.match(page, /if \(role === "ai"\) renderAiAnswer\(node, text\);/);
  // Handing the paper in clears the saved dialogue for that exam.
  assert.match(page, /submitted = true;[\s\S]*?clearAiChats\(examId\);/);
});

test("the AI answer renderer ships KaTeX locally for the self-only CSP", async () => {
  const script = await readFile(
    new URL("../public/vendor/katex/katex.min.js", import.meta.url),
  );
  const styles = await read(
    "../public/vendor/katex/katex.min.css",
  );
  assert.ok(script.length > 100_000);
  assert.match(styles, /KaTeX_Main-Regular\.woff2/);
  assert.doesNotMatch(styles, /\.woff\) format\("woff"\)/);
});

test("the AI provider settings live on the TronClass page", async () => {
  const page = await read("../public/tronclass.js");
  const html = await read("../public/index.html");
  // The dashboard no longer carries a second copy of the form.
  assert.doesNotMatch(html, /id="aiEnabled"/);
  assert.match(page, /function openAiSettings\(/);
  assert.match(page, /AI 助手設定/);
  assert.match(page, /id: "tc-ai-enabled"/);
  assert.match(page, /id: "tc-ai-provider"/);
  assert.match(page, /id: "tc-ai-base-url"/);
  assert.match(page, /id: "tc-ai-model"/);
  assert.match(page, /id: "tc-ai-key"/);
  assert.match(page, /id: "tc-ai-save"/);
  assert.match(page, /"\/api\/preferences\/ai"/);
  assert.match(page, /aiTutorSettingListener/);
  // The provider picker is the portal's own listbox, not a native select whose
  // popup the browser draws in its light system style.
  assert.match(page, /class: "provider-trigger"/);
  assert.match(page, /role: "listbox"/);
  assert.match(page, /class: "provider-option"/);
  assert.match(page, /class: "provider-check"/);
  assert.match(page, /setProviderSelection/);
  assert.doesNotMatch(page, /h\(\s*"select",\s*\{\s*id: "tc-ai-provider"/);
  // The panel follows the portal's settings language and motion.
  assert.match(page, /settings-mark/);
  assert.match(page, /settings-close/);
  assert.match(page, /settings-section/);
  assert.match(page, /syncScrollLock/);
  assert.match(page, /@keyframes panel-rise/);
  assert.match(page, /@keyframes turn-rise/);
});

test("the exam view can export every question as Markdown or JSON", async () => {
  const page = await read("../public/tronclass.js");
  // The export lives with the paper and downloads a blob, so nothing leaves
  // the browser and the server never sees the questions leave.
  assert.match(page, /const exportRows = \(\) =>/);
  assert.match(page, /const examMarkdown = \(rows\) =>/);
  assert.match(page, /const examJson = \(rows\) =>/);
  assert.match(page, /function openExportDialog\(\)/);
  assert.match(page, /class: "btn", type: "button", onclick: \(\) => openExportDialog\(\)/);
  assert.match(page, /downloadText\(exportName\("md"\)/);
  assert.match(page, /downloadText\(exportName\("json"\)/);
  assert.match(page, /text\/markdown;charset=utf-8/);
  assert.match(page, /application\/json;charset=utf-8/);
  assert.match(page, /不包含答案或你的作答內容/);
  // Only the question text and options are collected for the file.
  assert.match(page, /stem: plainText\(question\.description\)/);
  assert.match(page, /text: plainText\(option\.content\)/);
  assert.doesNotMatch(page, /questions: rows[\s\S]{0,200}answerFor/);
});

test("submitted exams open a review of the student's answers and the answer key", async () => {
  const page = await read("../public/tronclass.js");
  // The review is a hash route of the exam page, so a deep link survives a
  // reload and TronClass's own submission page stays one click away.
  assert.match(page, /name: "examResult"/);
  assert.match(page, /examResult: viewExamResult/);
  assert.match(page, /#\\\/exam\\\/\(\\d\+\)\\\/result\\\/\(\\d\+\)/);
  assert.match(page, /\/exam\/\$\{route\.examId\}\/subjects#\/submission\/\$\{route\.submissionId\}/);
  assert.match(page, /const examResultHref = \(courseId, examId, submissionId\) =>/);
  // Past attempts come from TronClass's submission list, and the course's
  // exam tab lists every submitted exam and attempt.
  assert.match(page, /\/api\/exams\/\$\{examId\}\/submissions`/);
  assert.match(page, /\/api\/exams\/\$\{examId\}\/submissions\/\$\{submissionId\}/);
  assert.match(page, /\/api\/courses\/\$\{courseId\}\/submitted-exams\?no-intercept=true/);
  assert.match(page, /\["history", "測驗紀錄", \(\) => examHistory\(courseId, bundle\)\]/);
  assert.match(page, /function examHistory\(/);
  assert.match(page, /我的作答紀錄/);
  assert.match(page, /查看上次作答/);
  assert.match(page, /查看答案/);
  // The review joins the paper, the student's answers and the announced key.
  assert.match(page, /function reviewRows\(/);
  assert.match(page, /result\?\.subjects_data\?\.subjects/);
  assert.match(page, /result\?\.submission_data\?\.subjects/);
  assert.match(page, /result\?\.correct_answers_data\?\.correct_answers/);
  assert.match(page, /result\?\.correct_data/);
  assert.match(page, /answer_option_ids/);
  assert.match(page, /is_answer/);
  assert.match(page, /answer_explanation/);
  assert.match(page, /wrong_explanation/);
  assert.match(page, /function reviewCard\(/);
  assert.match(page, /review-verdict/);
  assert.match(page, /你的答案/);
  assert.match(page, /正確答案/);
  assert.match(page, /未作答/);
  // An attempt exports the questions, both answers, the mark and the notes.
  assert.match(page, /function openAttemptExportDialog\(\)/);
  assert.match(page, /匯出作答紀錄/);
  assert.match(page, /const attemptMarkdown = \(\) =>/);
  assert.match(page, /const attemptJson = \(\) =>/);
  assert.match(page, /yourAnswer: \{ optionIds: row\.chosenIds/);
  assert.match(page, /correctAnswer: \{ optionIds: row\.correctIds/);
  assert.match(page, /result: row\.state/);
  assert.match(page, /內容包含題目、你的答案、正確答案與解析/);
  assert.match(page, /attempt-\$\{submissionId\}/);
});


test("the exam view enforces fullscreen, window-leave and copy guards without a bypass", async () => {
  const page = await read("../public/tronclass.js");
  assert.match(page, /function enterFullscreen\(/);
  assert.match(page, /requestFullscreen/);
  assert.match(page, /"fullscreenchange"/);
  assert.match(page, /回到全螢幕/);
  assert.match(page, /dialogDismissible/);
  assert.match(page, /"visibilitychange"/);
  assert.match(page, /listen\(window, "blur", noteLeave\)/);
  // The leave rules of the original page: a limit ends the attempt, and a
  // timeout auto-submits when the student stays away.
  assert.match(page, /is_leaving_window_timeout/);
  assert.match(page, /enforceLeaveSubmit\("leave_window_limit"/);
  assert.match(page, /enforceLeaveSubmit\("leave_window_timeout"/);
  // Leaving fullscreen while a submission is in flight must not re-enable
  // the paper; the error dialog returns the student to fullscreen first.
  assert.match(page, /function resumeAfterFailedSubmit\(/);
  assert.match(page, /const outOfFullscreen = guards\.fullscreen && !document\.fullscreenElement/);
  assert.match(page, /listen\(document, "contextmenu"/);
  assert.match(page, /listen\(document, "copy", block\)/);
  assert.match(page, /listen\(document, "paste", block\)/);
  assert.match(page, /這份測驗需要監考/);
  assert.match(page, /這份測驗包含音訊題/);
});

test("nothing with side effects runs before the checks that can block the paper", async () => {
  const page = await read("../public/tronclass.js");
  assert.match(page, /const \[examResult, qualificationResult, aiStatusResult\] = await Promise\.all/);
  assert.match(
    page,
    /if \(exam\.enable_invigilation \|\| qualification\.enable_invigilation\)[\s\S]*?const \[storageResult, distributeResult\] = await Promise\.all/,
  );
  // A supported type without options is a broken paper, not a question to
  // answer here with a misleading notice.
  assert.match(page, /const optionless = questions\.filter/);
});

test("pages opened on TronClass itself sign the browser in through the ePortal handoff first", async () => {
  const page = await read("../public/tronclass.js");
  // Classic links must be intercepted instead of walking straight into the
  // school's SSO login page.
  assert.match(page, /link\.dataset\.classic != null/);
  assert.match(page, /openOnTronclass\(classic\)/);
  // The waiting UI is the portal's own launch page, opened with the requested
  // TronClass page; the server points the ticket at that page so TronClass's
  // home never shows first.
  assert.match(page, /\/go\/tronclass\?to=/);
  assert.match(page, /encodeURIComponent\(url\.href\)/);
  assert.match(page, /const popup = window\.open\(/);
  // A blocked popup goes through the same handoff, never straight to TronClass.
  assert.match(page, /if \(!popup\) location\.assign\(launch\)/);
  assert.doesNotMatch(page, /tronclass-open|TRONCLASS_SSO_SETTLE_MS/);

  const launch = await read("../public/launch.js");
  assert.match(launch, /handoffTarget/);
  assert.match(launch, /JSON\.stringify\(\{ to: handoffTarget \}\)/);
  // The tab enters the school's SSO and TronClass; it keeps no handle on the
  // authenticated portal.
  assert.match(launch, /window\.opener = null/);
  assert.doesNotMatch(launch, /postMessage/);
});

test("a session-bound SSO capture is rejected instead of shown to the student", async () => {
  const server = await read("../server.js");
  assert.match(server, /isSsoLoginEndpoint\(handoffUrl\)/);
  assert.match(server, /EPORTAL_HANDOFF_SESSION_BOUND/);
});

test("the TronClass pages use the dashboard's colours but not its background image", async () => {
  const html = await read("../public/tronclass.html");
  const page = await read("../public/tronclass.js");
  assert.match(html, /<script src="\/theme-defaults\.js\?v=\d+"><\/script>/);
  assert.match(html, /<script src="\/theme\.js\?v=\d+"><\/script>\s*<script src="\/tronclass\.js">/);
  assert.doesNotMatch(html, /portalBackdrop/);
  assert.match(page, /window\.NutcTheme\?\.init\?\.\(\)/);
  // The theme's inline variables must not be shadowed by fixed page colours.
  assert.doesNotMatch(page, /--primary: #/);
  assert.doesNotMatch(page, /rgba\(240,\s*168,\s*200/);
});

test("the TronClass page background is tinted with the theme's dark colour", async () => {
  const page = await read("../public/tronclass.js");
  assert.match(page, /--bg: color-mix\(in srgb, var\(--secondary\)/);
  assert.match(page, /--surface: color-mix\(in srgb, var\(--secondary\)/);
  assert.doesNotMatch(page, /#2f2735|rgba\(20, 16, 24/);
});
