import { openAisWithServerSession } from "./portal-session.js";

export const AIS_SCHEDULE_URL =
  "https://ais.nutc.edu.tw/student/courses/my_week_time.aspx";
const CACHE_TTL_MS = 5 * 60_000;

export const CLASS_SCHEDULE_TIME_SLOTS = Object.freeze([
  { slot: "1", time: "08:10~09:00" },
  { slot: "2", time: "09:10~10:00" },
  { slot: "3", time: "10:10~11:00" },
  { slot: "4", time: "11:10~12:00" },
  { slot: "5", time: "13:25~14:15" },
  { slot: "6", time: "14:20~15:10" },
  { slot: "7", time: "15:20~16:10" },
  { slot: "8", time: "16:15~17:05" },
  { slot: "9", time: "17:10~18:00" },
  { slot: "10", time: "18:10~19:00" },
  { slot: "11", time: "19:10~20:00" },
  { slot: "12", time: "20:10~21:00" },
  { slot: "13", time: "21:10~22:00" },
]);

const DAY_LABELS = Object.freeze([
  "週一",
  "週二",
  "週三",
  "週四",
  "週五",
  "週六",
  "週日",
]);

let cachedSchedule = null;
let fetchInFlight = null;

function scheduleError(message, code, statusCode = 502) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

// Read the weekly grid and the course-detail table from a page that is already
// on my_week_time.aspx. The caller owns the AIS session, so the same page can
// also be used for grades, announcements and the rest of the student hub.
export async function readSchedule(page, { timeoutMs = 12_000 } = {}) {
  await page.waitForFunction(
    () =>
      typeof globalThis.g_ClsTime === "object" &&
      globalThis.g_ClsTime !== null,
    null,
    { timeout: timeoutMs },
  );

  const parsed = await page.evaluate(() => {
    const clean = (value) => {
      const element = document.createElement("div");
      element.innerHTML = String(value ?? "");
      return String(element.textContent || "")
        .replace(/\s+/g, " ")
        .trim();
    };

    const source = globalThis.g_ClsTime || {};
    const entries = [];

    for (const [key, rawValue] of Object.entries(source)) {
      const parts = String(key).split("-");
      const day = Number(parts[0]);
      const period = Number(parts[1]);

      if (
        !Number.isInteger(day) ||
        day < 1 ||
        day > 7 ||
        !Number.isInteger(period) ||
        period < 1 ||
        period > 13
      ) {
        continue;
      }

      const fields = String(rawValue ?? "").split("\t");
      const course = {
        name: clean(fields[1]),
        teacher: clean(fields[2]),
        room: clean(fields[3]),
      };

      if (!course.name && !course.teacher && !course.room) continue;

      entries.push({
        dayIndex: day - 1,
        periodIndex: period - 1,
        course,
      });
    }

    const selectedLabels = [...document.querySelectorAll("select option:checked")]
      .map((option) => clean(option.textContent))
      .filter(Boolean)
      .filter((label) => /學年|學期|上學期|下學期/.test(label))
      .slice(0, 2);

    const tabLabel = [...document.querySelectorAll(".TabPaneBox")]
      .map((node) => clean(node.textContent))
      .find((text) => /^\d{2,3}年\([上下]\)/.test(text));
    const termMatch = tabLabel?.match(/^(\d{2,3}年\([上下]\))/);

    const courseHeader = [...document.querySelectorAll("table")].find((table) => {
      const text = clean(table.textContent);
      return /上課時間\/教室/.test(text) && /上課教師/.test(text) && /學分/.test(text);
    });
    const courses = [];

    if (courseHeader) {
      for (const row of courseHeader.querySelectorAll("tr")) {
        const cells = [...row.querySelectorAll("td")];
        if (cells.length < 8) continue;
        const values = cells.map((cell) => clean(cell.textContent));
        const action = row.querySelector("[onclick*='course_detail']");
        const match = action?.getAttribute("onclick")?.match(/course_detail\((\d+)\)/);
        if (!match) continue;

        const creditParts = values[6].split("/").map(clean);
        courses.push({
          ccid: Number(match[1]),
          className: values[1],
          name: values[2],
          group: values[3],
          timeRoom: values[4],
          required: values[5],
          credits: creditParts[0] || "",
          hours: creditParts[1] || creditParts[0] || "",
          teacher: values[7],
        });
      }
    }

    return {
      entries,
      courses,
      termLabel: (selectedLabels.join(" ") || termMatch?.[1] || "").trim(),
    };
  });

  const periods = CLASS_SCHEDULE_TIME_SLOTS.map(({ slot, time }) => ({
    slot,
    time,
    days: DAY_LABELS.map(() => ({})),
  }));

  for (const entry of parsed.entries) {
    const period = periods[entry.periodIndex];
    if (!period) continue;
    period.days[entry.dayIndex] = entry.course;
  }

  return {
    source: "NUTC AIS",
    sourceUrl: AIS_SCHEDULE_URL,
    timezone: "Asia/Taipei",
    fetchedAt: new Date().toISOString(),
    termLabel: parsed.termLabel || "",
    dayLabels: DAY_LABELS,
    periods,
    courses: parsed.courses || [],
    scheduledCells: parsed.entries.length,
  };
}

async function fetchFreshSchedule() {
  const session = await openAisWithServerSession({
    headless: true,
    timeoutMs: 8_000,
  });

  try {
    const { page } = session;

    await page.goto(AIS_SCHEDULE_URL, {
      waitUntil: "domcontentloaded",
      timeout: 20_000,
    });

    const current = new URL(page.url());

    if (
      current.hostname !== "ais.nutc.edu.tw" ||
      /\/login\.aspx$/i.test(current.pathname)
    ) {
      throw scheduleError(
        "Server ePortal session expired. Sign in again to load the class schedule.",
        "EPORTAL_LOGIN_REQUIRED",
        401,
      );
    }

    session.aisAuth.assertValid();
    // AIS can report expired authentication using a blocking JS alert while
    // staying on the expected URL. Check again after page data has loaded.
    const schedule = await readSchedule(page);
    session.aisAuth.assertValid();
    return schedule;
  } catch (error) {
    session.aisAuth.assertValid();
    if (error?.code === "EPORTAL_LOGIN_REQUIRED") throw error;

    if (error?.name === "TimeoutError") {
      throw scheduleError(
        "AIS class schedule did not finish loading in time.",
        "CLASS_SCHEDULE_TIMEOUT",
        504,
      );
    }

    throw error;
  } finally {
    await session.context.close().catch(() => {});
  }
}

export function clearClassScheduleCache() {
  cachedSchedule = null;
}

export async function getClassSchedule({ force = false } = {}) {
  const now = Date.now();

  if (
    !force &&
    cachedSchedule &&
    now - cachedSchedule.cachedAtMs < CACHE_TTL_MS
  ) {
    return {
      ...cachedSchedule.value,
      cached: true,
      stale: false,
    };
  }

  if (fetchInFlight) return fetchInFlight;

  fetchInFlight = (async () => {
    try {
      const value = await fetchFreshSchedule();
      cachedSchedule = {
        cachedAtMs: Date.now(),
        value,
      };

      return {
        ...value,
        cached: false,
        stale: false,
      };
    } catch (error) {
      if (error?.code === "EPORTAL_LOGIN_REQUIRED") {
        clearClassScheduleCache();
        throw error;
      }

      if (cachedSchedule) {
        return {
          ...cachedSchedule.value,
          cached: true,
          stale: true,
          refreshError: error?.message || "Unable to refresh class schedule.",
        };
      }

      throw error;
    } finally {
      fetchInFlight = null;
    }
  })();

  return fetchInFlight;
}
