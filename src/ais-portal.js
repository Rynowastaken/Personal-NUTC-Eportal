import { openAisWithServerSession } from "./portal-session.js";
import { AIS_SCHEDULE_URL, readSchedule } from "./class-schedule.js";
import { AIS_ABSENCE_URL, readAbsences } from "./absence-list.js";

const AIS_HOME_URL = "https://ais.nutc.edu.tw/student/home.aspx";
const AIS_PROFILE_URL = "https://ais.nutc.edu.tw/student/stu_info.aspx";
const AIS_GRADES_URL = "https://ais.nutc.edu.tw/student/grade/my_hist_grade.aspx";
const AIS_PROGRESS_URL = "https://ais.nutc.edu.tw/student/stu/progress_view.aspx";
const AIS_BULLETIN_URL = "https://ais.nutc.edu.tw/student/bulletin_view.aspx";
const AIS_COURSE_URL =
  "https://ais.nutc.edu.tw/student/courses/course_details.aspx";

const CACHE_TTL_MS = 5 * 60_000;

let cachedOverview = null;
let overviewInFlight = null;
const announcementCache = new Map();
const announcementInFlight = new Map();
const detailCache = new Map();
const detailInFlight = new Map();
const courseCache = new Map();
const courseInFlight = new Map();

function aisError(message, code, statusCode = 502) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

function authRequired(message) {
  return aisError(
    message || "Server ePortal session expired. Sign in again to load AIS.",
    "EPORTAL_LOGIN_REQUIRED",
    401,
  );
}

function assertAisPage(page, session) {
  const current = new URL(page.url());
  if (
    current.hostname !== "ais.nutc.edu.tw" ||
    /\/login\.aspx$/i.test(current.pathname)
  ) {
    throw authRequired("Server ePortal session expired. Sign in again to load AIS.");
  }
  session.aisAuth.assertValid();
}

async function gotoAis(page, session, url, { waitFor, settleMs = 250 } = {}) {
  await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: 20_000,
  });
  assertAisPage(page, session);

  if (waitFor) {
    await page
      .waitForFunction(waitFor, null, { timeout: 12_000 })
      .catch(() => {});
  }
  if (settleMs) await page.waitForTimeout?.(settleMs);
  assertAisPage(page, session);
}

function sectionMessage(error) {
  return error?.message || "AIS 資料暫時無法讀取。";
}

function maskNationalId(value) {
  const text = String(value || "").replace(/\s+/g, "").trim();
  if (!text) return "";
  if (text.length <= 3) return "*".repeat(text.length);
  return text.slice(0, 2) + "*".repeat(Math.max(3, text.length - 3)) + text.slice(-1);
}

// ---------------------------------------------------------------------------
// Parsers

export async function readAisAnnouncementList(page) {
  return page.evaluate(() => {
    const clean = (value) =>
      String(value ?? "")
        .replace(/\u00a0/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    const bodyText = clean(document.body?.innerText || "");
    const totalMatch = bodyText.match(/目前共有\s*(\d+)\s*筆資料/);
    const total = totalMatch ? Number(totalMatch[1]) : 0;

    const pageNumbers = [...document.querySelectorAll("a[href*='_p=']")]
      .map((link) => {
        try {
          return Number(new URL(link.href, location.href).searchParams.get("_p"));
        } catch {
          return 0;
        }
      })
      .filter((value) => Number.isInteger(value) && value > 0);
    const pages = pageNumbers.length ? Math.max(...pageNumbers) : 1;

    const table = [...document.querySelectorAll("table")].find((candidate) => {
      const text = clean(candidate.textContent);
      return /公告標題/.test(text) && /發布單位/.test(text);
    });

    const items = [];
    if (table) {
      for (const row of table.querySelectorAll("tr")) {
        const cells = [...row.querySelectorAll("td")];
        const link = row.querySelector("a[onclick*='view(']");
        const match = link?.getAttribute("onclick")?.match(/view\((\d+)\)/);
        if (!match || cells.length < 4) continue;

        const values = cells.map((cell) => clean(cell.textContent));
        items.push({
          id: Number(match[1]),
          unit: values[1] || "",
          type: values[2] || "",
          title: values[3] || "",
        });
      }
    }

    return {
      total,
      page: Number(new URL(location.href).searchParams.get("_p")) || 1,
      pages,
      items,
    };
  });
}

export async function readAisProfile(page) {
  return page.evaluate(() => {
    const clean = (value) =>
      String(value ?? "")
        .replace(/\u00a0/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    const fields = {};
    for (const row of document.querySelectorAll("table tr")) {
      const cells = [...row.querySelectorAll("th,td")];
      for (let index = 0; index + 1 < cells.length; index += 1) {
        if (cells[index].tagName !== "TH") continue;
        const label = clean(cells[index].textContent).replace(/[：:]$/, "");
        const value =
          cells[index + 1].querySelector?.("input")?.value ??
          clean(cells[index + 1].textContent);
        if (label) fields[label] = clean(value);
      }
    }

    const context = clean(document.querySelector(".alert-notice")?.textContent || "");
    const contextParts = context.split(/\s+/).filter(Boolean);
    const name = clean(document.querySelector("#name")?.textContent || fields["姓名"] || "");
    const gender = clean(
      document.querySelector("#name + .label, #name ~ .label")?.textContent || "",
    ).replace(name, "");

    return {
      studentId: fields["學號"] || "",
      name,
      gender,
      birthday: fields["生日"] || "",
      nationalId: fields["身分證號"] || "",
      phone: document.querySelector("input[name='tel']")?.value || fields["連絡電話"] || "",
      mobile: document.querySelector("input[name='phone']")?.value || fields["行動電話"] || "",
      englishName: document.querySelector("input[name='ename']")?.value || fields["英文姓名"] || "",
      registeredAddress: fields["戶籍地址"] || "",
      mailingAddress: fields["郵寄地址"] || "",
      division: contextParts[0] || "",
      className: contextParts.slice(1).join(" ") || "",
    };
  });
}

export async function readAisGrades(page) {
  return page.evaluate(() => {
    const clean = (value) =>
      String(value ?? "")
        .replace(/\u00a0/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    const tables = [...document.querySelectorAll("table")];
    const dataTable = tables.find((table) => {
      const text = clean(table.textContent);
      return /開課班級/.test(text) && /總成績/.test(text);
    });

    const headerCells = dataTable
      ? [...(dataTable.querySelector("tr")?.querySelectorAll("th,td") || [])].map((cell) =>
          clean(cell.textContent),
        )
      : [];
    const column = (pattern) =>
      headerCells.findIndex((header) => pattern.test(header));

    const classIndex = column(/開課班級/);
    const courseIndex = column(/課程/);
    const groupIndex = column(/分組/);
    const requiredIndex = column(/修別/);
    const creditIndex = column(/學分/);
    const gradeIndex = column(/總成績|成績/);

    const rows = [];
    for (const row of document.querySelectorAll("tr.tr_data")) {
      const cells = [...row.querySelectorAll("td")].map((cell) => clean(cell.textContent));
      if (!cells.length) continue;
      const read = (index) => (index >= 0 ? cells[index] || "" : "");
      rows.push({
        semester: row.getAttribute("data-yysem") || "",
        className: read(classIndex),
        course: read(courseIndex),
        group: read(groupIndex),
        required: read(requiredIndex),
        credits: read(creditIndex),
        grade: read(gradeIndex),
      });
    }

    const totalsTable = tables.find((table) => {
      const text = clean(table.textContent);
      return /總修習學分/.test(text) && /班級排名/.test(text);
    });
    const summary = {};
    if (totalsTable) {
      const totalRows = [...totalsTable.querySelectorAll("tr")].map((row) =>
        [...row.querySelectorAll("th,td")].map((cell) => clean(cell.textContent)),
      );
      const header = totalRows.find((cells) => cells.includes("總修習學分"));
      const values = totalRows.find(
        (cells) => cells.length >= 2 && cells.filter((cell) => /^-?\d+(\.\d+)?$/.test(cell)).length >= 2,
      );
      if (header && values) {
        const read = (label) => {
          const index = header.indexOf(label);
          return index >= 0 ? values[index] || "" : "";
        };
        summary.totalCredits = read("總修習學分");
        summary.failedCredits = read("不及格學分");
        summary.earnedCredits = read("實得學分");
        summary.average = read("學期平均");
        summary.conduct = read("操行");
        summary.rank = read("班級排名");
      }
    }

    const select = document.querySelector("#sem");
    const options = select
      ? [...select.options].map((option) => ({
          value: option.value,
          label: clean(option.textContent),
        }))
      : [];

    return { rows, summary, options };
  });
}

export async function readAisProgress(page) {
  return page.evaluate(() => {
    const clean = (value) =>
      String(value ?? "")
        .replace(/\u00a0/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    const tables = [...document.querySelectorAll("table")];
    const standardTable = tables.find((table) => {
      const text = clean(table.textContent);
      return /必修學分/.test(text) && /畢業條件/.test(text);
    });

    const requirements = {};
    const earned = {};
    const expected = {};

    if (standardTable) {
      const rows = [...standardTable.querySelectorAll("tr")].map((row) =>
        [...row.querySelectorAll("th,td")].map((cell) => clean(cell.textContent)),
      );
      const header = rows.find((cells) => cells.includes("必修學分"));
      if (header) {
        const read = (cells, label) => {
          let index = header.indexOf(label);
          if (index < 0) index = header.findIndex((value) => value.startsWith(label));
          return index >= 0 ? cells[index] || "" : "";
        };
        for (const cells of rows) {
          if (!cells.length) continue;
          const key = cells[0];
          const target =
            key === "畢業條件" ? requirements : key === "修業進度" ? earned : key === "預期進度" ? expected : null;
          if (!target) continue;
          target.requiredCredits = read(cells, "必修學分");
          target.electiveCredits = read(cells, "選修總學分");
          target.crossDepartmentCredits = read(cells, "跨系選修(上限)");
          target.generalEducation = read(cells, "博雅通識");
          target.languageThreshold = read(cells, "校定語言門檻");
          target.departmentThreshold = read(cells, "系定門檻");
          target.note = read(cells, "備註");
        }
      }
    }

    const checklistTable = tables.find((table) => {
      const text = clean(table.textContent);
      return /課程標準/.test(text) && /修習年級/.test(text) && /課程名稱/.test(text);
    });

    const courses = [];
    if (checklistTable) {
      for (const row of checklistTable.querySelectorAll("tr")) {
        const cells = [...row.querySelectorAll("td")];
        if (cells.length < 7) continue;
        const values = cells.map((cell) => clean(cell.textContent));
        if (!/^\d+$/.test(values[0])) continue;
        courses.push({
          number: Number(values[0]),
          year: values[1],
          name: values[2],
          required: values[3],
          credits: values[4],
          statusUp: values[5],
          statusDown: values[6],
          note: values[7] || "",
        });
      }
    }

    const program =
      clean(document.querySelector("select[name='ssid'] option:checked")?.textContent || "") ||
      clean(document.body?.innerText || "").match(/\[[^\]]+\]-[^\s]+/)?.[0] ||
      "";

    return { program, requirements, earned, expected, courses };
  });
}

function normalizeGrade(value) {
  const raw = String(value || "").trim();
  if (!raw) return { state: "none", label: "—", value: null };
  if (/免修/.test(raw)) return { state: "exempt", label: "免修", value: null };
  if (/抵免/.test(raw)) return { state: "exempt", label: "抵免", value: null };
  if (/扣考/.test(raw)) return { state: "absent", label: "扣考", value: null };
  if (/退選/.test(raw)) return { state: "withdrawn", label: "退選", value: null };
  if (/^P$/i.test(raw)) return { state: "pass", label: "P", value: null };
  if (/^F$/i.test(raw)) return { state: "fail", label: "F", value: null };
  if (/無成績/.test(raw)) return { state: "pending", label: "無成績", value: null };
  const match = raw.match(/-?\d+(?:\.\d+)?/);
  if (!match) return { state: "pending", label: raw, value: null };
  const number = Number(match[0]);
  return {
    state: number >= 60 ? "pass" : "fail",
    label: raw.replace(/\s*\(不及格\)\s*/, ""),
    value: number,
  };
}

function buildGrades(parsed) {
  const semesters = (parsed.options || []).map((option) => {
    const rows = (parsed.rows || [])
      .filter((row) => row.semester === option.value)
      .map((row) => ({ ...row, gradeInfo: normalizeGrade(row.grade) }));
    return {
      value: option.value,
      label: option.label,
      rows,
      summary: rows.length ? parsed.summary || {} : {},
    };
  });

  if (!semesters.length && parsed.rows?.length) {
    const values = [...new Set(parsed.rows.map((row) => row.semester).filter(Boolean))];
    for (const value of values) {
      const rows = parsed.rows
        .filter((row) => row.semester === value)
        .map((row) => ({ ...row, gradeInfo: normalizeGrade(row.grade) }));
      semesters.push({ value, label: value, rows, summary: parsed.summary || {} });
    }
  }

  const active =
    semesters.find((semester) => semester.rows.length) ||
    semesters[0] || { value: "", label: "", rows: [], summary: {} };

  return {
    semesters,
    activeSemester: active.value,
    summary: active.summary || {},
    totalCourses: active.rows.length,
  };
}

function buildOverview({ home, profile, grades, progress, schedule, absences, errors }) {
  const termLabel =
    schedule?.termLabel ||
    grades?.semesters?.find((semester) => semester.rows.length)?.label ||
    absences?.termLabel ||
    "";

  return {
    source: "NUTC AIS",
    sourceUrl: AIS_HOME_URL,
    timezone: "Asia/Taipei",
    fetchedAt: new Date().toISOString(),
    termLabel,
    profile: profile
      ? {
          ...profile,
          nationalId: undefined,
          nationalIdMasked: maskNationalId(profile.nationalId),
        }
      : null,
    announcements: home,
    grades: grades || { semesters: [], activeSemester: "", summary: {}, totalCourses: 0 },
    progress: progress || null,
    schedule: schedule || null,
    absences: absences || null,
    errors: errors || {},
  };
}

// ---------------------------------------------------------------------------
// One AIS session for the whole overview

async function fetchFreshOverview() {
  const session = await openAisWithServerSession({
    headless: true,
    timeoutMs: 10_000,
  });

  const errors = {};
  let home = null;
  let profile = null;
  let grades = null;
  let progress = null;
  let schedule = null;
  let absences = null;

  try {
    const { page } = session;

    try {
      await gotoAis(page, session, AIS_HOME_URL, {
        waitFor: `document.querySelector("table") || /目前共有/.test(document.body.innerText)`,
      });
      home = await readAisAnnouncementList(page);
    } catch (error) {
      if (error?.code === "EPORTAL_LOGIN_REQUIRED") throw error;
      errors.announcements = sectionMessage(error);
    }

    try {
      await gotoAis(page, session, AIS_PROFILE_URL, {
        waitFor: `document.querySelector("#name") || document.querySelector("table")`,
      });
      profile = await readAisProfile(page);
    } catch (error) {
      if (error?.code === "EPORTAL_LOGIN_REQUIRED") throw error;
      errors.profile = sectionMessage(error);
    }

    try {
      await gotoAis(page, session, AIS_GRADES_URL, {
        waitFor: `document.querySelector("tr.tr_data") || document.querySelector("#sem")`,
      });
      grades = buildGrades(await readAisGrades(page));
    } catch (error) {
      if (error?.code === "EPORTAL_LOGIN_REQUIRED") throw error;
      errors.grades = sectionMessage(error);
    }

    try {
      await gotoAis(page, session, AIS_PROGRESS_URL, {
        waitFor: `document.querySelector("table")`,
      });
      progress = await readAisProgress(page);
    } catch (error) {
      if (error?.code === "EPORTAL_LOGIN_REQUIRED") throw error;
      errors.progress = sectionMessage(error);
    }

    try {
      await gotoAis(page, session, AIS_SCHEDULE_URL, {
        waitFor: `typeof globalThis.g_ClsTime === "object" && globalThis.g_ClsTime !== null`,
      });
      schedule = await readSchedule(page);
      assertAisPage(page, session);
    } catch (error) {
      if (error?.code === "EPORTAL_LOGIN_REQUIRED") throw error;
      errors.schedule = sectionMessage(error);
    }

    try {
      await gotoAis(page, session, AIS_ABSENCE_URL, {
        waitFor: `document.querySelector("table")`,
      });
      absences = await readAbsences(page);
      assertAisPage(page, session);
    } catch (error) {
      if (error?.code === "EPORTAL_LOGIN_REQUIRED") throw error;
      errors.absences = sectionMessage(error);
    }

    return buildOverview({
      home,
      profile,
      grades,
      progress,
      schedule,
      absences,
      errors,
    });
  } catch (error) {
    session.aisAuth.assertValid();
    throw error;
  } finally {
    await session.context.close().catch(() => {});
  }
}

export function clearAisPortalCache() {
  cachedOverview = null;
  announcementCache.clear();
  detailCache.clear();
  courseCache.clear();
}

export async function getAisOverview({ force = false } = {}) {
  const now = Date.now();

  if (
    !force &&
    cachedOverview &&
    now - cachedOverview.cachedAtMs < CACHE_TTL_MS
  ) {
    return { ...cachedOverview.value, cached: true, stale: false };
  }

  if (overviewInFlight) return overviewInFlight;

  overviewInFlight = (async () => {
    try {
      const value = await fetchFreshOverview();
      cachedOverview = { cachedAtMs: Date.now(), value };
      return { ...value, cached: false, stale: false };
    } catch (error) {
      if (error?.code === "EPORTAL_LOGIN_REQUIRED") {
        cachedOverview = null;
        throw error;
      }
      if (cachedOverview) {
        return {
          ...cachedOverview.value,
          cached: true,
          stale: true,
          refreshError: error?.message || "Unable to refresh AIS.",
        };
      }
      throw error;
    } finally {
      overviewInFlight = null;
    }
  })();

  return overviewInFlight;
}

// ---------------------------------------------------------------------------
// Course details

export async function readAisCourseDetail(page) {
  await page
    .waitForFunction(
      () =>
        document.querySelector("textarea[name='outline']") ||
        document.querySelectorAll("table").length > 1,
      null,
      { timeout: 12_000 },
    )
    .catch(() => {});

  return page.evaluate(() => {
    const clean = (value) =>
      String(value ?? "")
        .replace(/\u00a0/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    const lines = String(document.body?.innerText || "")
      .split(/\r?\n/)
      .map(clean)
      .filter(Boolean);
    const firstLine = lines[0] || "";
    const teacherMatch = firstLine.match(/^(.*?)\s*\((.*)\)\s*$/);
    const titleMatch = clean(document.title).match(
      /^【(.+?)】\s*(.+?)\s*[－-]\s*課程內容/,
    );

    const tables = [...document.querySelectorAll("table")]
      .map((table) =>
        [...table.querySelectorAll("tr")]
          .map((row) =>
            [...row.querySelectorAll("th,td")].map((cell) =>
              clean(cell.innerText),
            ),
          )
          .filter((row) => row.length),
      )
      .filter((rows) => rows.length);

    const findTable = (headers) =>
      tables.find((rows) => {
        const head = rows[0] || [];
        return headers.every((label) =>
          head.some((cell) => cell.includes(label)),
        );
      });

    const columnIndex = (head, label) =>
      head.findIndex((cell) => cell.includes(label));

    const books = [];
    const bookTable = findTable(["書名", "作者", "出版社"]);
    if (bookTable) {
      const head = bookTable[0];
      const titleIndex = columnIndex(head, "書名");
      const authorIndex = columnIndex(head, "作者");
      const publisherIndex = columnIndex(head, "出版社");
      const yearIndex = columnIndex(head, "出版年度");
      const editionIndex = columnIndex(head, "版次");
      const placeIndex = columnIndex(head, "出版地");

      for (const row of bookTable.slice(1)) {
        const title = titleIndex >= 0 ? row[titleIndex] || "" : "";
        if (!title) continue;
        books.push({
          title,
          author: authorIndex >= 0 ? row[authorIndex] || "" : "",
          publisher: publisherIndex >= 0 ? row[publisherIndex] || "" : "",
          year: yearIndex >= 0 ? row[yearIndex] || "" : "",
          edition: editionIndex >= 0 ? row[editionIndex] || "" : "",
          place: placeIndex >= 0 ? row[placeIndex] || "" : "",
        });
      }
    }

    const assessment = { items: [], midtermWarning: "" };
    const assessmentTable = findTable(["評分項目", "比重"]);
    if (assessmentTable) {
      const head = assessmentTable[0];
      const labelIndex = columnIndex(head, "評分項目");
      const weightIndex = columnIndex(head, "比重");

      for (const row of assessmentTable.slice(1)) {
        const label = labelIndex >= 0 ? row[labelIndex] || "" : "";
        const weight = weightIndex >= 0 ? row[weightIndex] || "" : "";
        if (!label) continue;
        if (/期中預警/.test(label)) {
          assessment.midtermWarning = weight || "是";
          continue;
        }
        assessment.items.push({ label, weight });
      }
    }

    const weeks = [];
    const weekTable = findTable(["周次", "主題內容", "備註"]);
    if (weekTable) {
      const head = weekTable[0];
      const weekIndex = columnIndex(head, "周次");
      const topicIndex = columnIndex(head, "主題內容");
      const noteIndex = columnIndex(head, "備註");

      for (const row of weekTable.slice(1)) {
        const week = weekIndex >= 0 ? row[weekIndex] || "" : "";
        const topic = topicIndex >= 0 ? row[topicIndex] || "" : "";
        if (!week && !topic) continue;
        weeks.push({
          week,
          topic,
          note: noteIndex >= 0 ? row[noteIndex] || "" : "",
        });
      }
    }

    return {
      className: titleMatch?.[1] || "",
      name: titleMatch?.[2] || clean(document.querySelector("h1")?.textContent),
      teacher: teacherMatch?.[1] || firstLine,
      englishName: teacherMatch?.[2] || "",
      outline: String(
        document.querySelector("textarea[name='outline']")?.value || "",
      ).trim(),
      objective: String(
        document.querySelector("textarea[name='objective']")?.value || "",
      ).trim(),
      reference: String(
        document.querySelector("textarea[name='referece']")?.value ||
          document.querySelector("textarea[name='reference']")?.value ||
          "",
      ).trim(),
      books,
      assessment,
      weeks,
    };
  });
}

export async function getAisCourseDetail({ ccid, sem, force = false } = {}) {
  const courseId = Number(ccid);
  const term = String(sem || "")
    .replace(/\D/g, "")
    .slice(0, 4);

  if (
    !Number.isInteger(courseId) ||
    courseId <= 0 ||
    !/^\d{3,4}$/.test(term)
  ) {
    throw aisError("Unknown AIS course.", "AIS_COURSE_NOT_FOUND", 404);
  }

  const key = `${term}:${courseId}`;
  const cached = courseCache.get(key);
  if (!force && cached && Date.now() - cached.cachedAtMs < CACHE_TTL_MS) {
    return { ...cached.value, cached: true, stale: false };
  }
  if (courseInFlight.has(key)) return courseInFlight.get(key);

  const pending = (async () => {
    const session = await openAisWithServerSession({
      headless: true,
      timeoutMs: 10_000,
    });

    try {
      const { page } = session;
      const url = `${AIS_COURSE_URL}?sem=${encodeURIComponent(term)}&ccid=${courseId}`;
      await gotoAis(page, session, url, {
        waitFor: `document.querySelector("textarea[name='outline']") || document.querySelectorAll("table").length > 1`,
        settleMs: 300,
      });

      const detail = await readAisCourseDetail(page);
      const value = {
        source: "NUTC AIS",
        sourceUrl: url,
        fetchedAt: new Date().toISOString(),
        sem: term,
        ccid: courseId,
        ...detail,
      };
      courseCache.set(key, { cachedAtMs: Date.now(), value });
      return { ...value, cached: false, stale: false };
    } catch (error) {
      if (error?.code === "EPORTAL_LOGIN_REQUIRED") {
        courseCache.delete(key);
        throw error;
      }
      if (error?.name === "TimeoutError") {
        throw aisError(
          "AIS course details did not finish loading in time.",
          "AIS_COURSE_TIMEOUT",
          504,
        );
      }
      const stale = courseCache.get(key);
      if (stale) {
        return {
          ...stale.value,
          cached: true,
          stale: true,
          refreshError:
            error?.message || "Unable to refresh the AIS course.",
        };
      }
      throw error;
    } finally {
      await session.context.close().catch(() => {});
    }
  })();

  courseInFlight.set(key, pending);
  try {
    return await pending;
  } finally {
    courseInFlight.delete(key);
  }
}

// ---------------------------------------------------------------------------
// Announcements

export async function getAisAnnouncements({ page = 1, force = false } = {}) {
  const pageNumber = Math.max(1, Math.min(999, Number(page) || 1));
  const cached = announcementCache.get(pageNumber);
  const now = Date.now();

  if (!force && cached && now - cached.cachedAtMs < CACHE_TTL_MS) {
    return { ...cached.value, cached: true };
  }
  if (announcementInFlight.has(pageNumber)) {
    return announcementInFlight.get(pageNumber);
  }

  const pending = (async () => {
    const session = await openAisWithServerSession({
      headless: true,
      timeoutMs: 10_000,
    });

    try {
      const { page: browserPage } = session;
      const url = pageNumber === 1 ? AIS_HOME_URL : `${AIS_HOME_URL}?_p=${pageNumber}`;
      await gotoAis(browserPage, session, url, {
        waitFor: `document.querySelector("table") || /目前共有/.test(document.body.innerText)`,
      });
      const list = await readAisAnnouncementList(browserPage);
      const value = {
        source: "NUTC AIS",
        sourceUrl: AIS_HOME_URL,
        fetchedAt: new Date().toISOString(),
        page: pageNumber,
        ...list,
      };
      announcementCache.set(pageNumber, { cachedAtMs: Date.now(), value });
      return { ...value, cached: false };
    } finally {
      await session.context.close().catch(() => {});
    }
  })();

  announcementInFlight.set(pageNumber, pending);
  try {
    return await pending;
  } finally {
    announcementInFlight.delete(pageNumber);
  }
}

export async function getAisAnnouncement(id, { force = false } = {}) {
  const bulletinId = Number(id);
  if (!Number.isInteger(bulletinId) || bulletinId <= 0) {
    throw aisError("Unknown AIS announcement.", "AIS_ANNOUNCEMENT_NOT_FOUND", 404);
  }

  const cached = detailCache.get(bulletinId);
  if (!force && cached && Date.now() - cached.cachedAtMs < CACHE_TTL_MS) {
    return { ...cached.value, cached: true };
  }
  if (detailInFlight.has(bulletinId)) return detailInFlight.get(bulletinId);

  const pending = (async () => {
    const session = await openAisWithServerSession({
      headless: true,
      timeoutMs: 10_000,
    });

    try {
      const { page } = session;
      await gotoAis(page, session, `${AIS_BULLETIN_URL}?bid=${bulletinId}`, {
        waitFor: `document.querySelector("#icontent") || document.querySelector("table")`,
        settleMs: 700,
      });

      const detail = await page.evaluate(() => {
        const clean = (value) =>
          String(value ?? "")
            .replace(/\u00a0/g, " ")
            .replace(/\s+/g, " ")
            .trim();

        const fields = {};
        for (const row of document.querySelectorAll("table tr")) {
          const cells = [...row.querySelectorAll("th,td")];
          if (cells.length < 2) continue;
          const label = clean(cells[0].textContent).replace(/[：:]$/, "");
          if (label) fields[label] = clean(cells[1].textContent);
        }

        const frame = document.querySelector("#icontent");
        const frameDoc = frame?.contentDocument;
        const bodyHtml = frameDoc?.body?.innerHTML || "";
        const attachments = [...document.querySelectorAll("a[href*='dl.aspx']")].map((link) => ({
          name: clean(link.textContent),
          url: new URL(link.getAttribute("href"), location.href).href,
        }));

        return {
          unit: clean(document.querySelector(".alert-notice")?.textContent || ""),
          title: fields["標題"] || "",
          dateRange: fields["起迄日期"] || "",
          attachmentNames: fields["附件"] || "",
          bodyHtml,
          bodyText: clean(frameDoc?.body?.innerText || ""),
          attachments,
        };
      });

      const value = {
        source: "NUTC AIS",
        sourceUrl: `${AIS_BULLETIN_URL}?bid=${bulletinId}`,
        fetchedAt: new Date().toISOString(),
        id: bulletinId,
        ...detail,
      };
      detailCache.set(bulletinId, { cachedAtMs: Date.now(), value });
      return { ...value, cached: false };
    } finally {
      await session.context.close().catch(() => {});
    }
  })();

  detailInFlight.set(bulletinId, pending);
  try {
    return await pending;
  } finally {
    detailInFlight.delete(bulletinId);
  }
}
