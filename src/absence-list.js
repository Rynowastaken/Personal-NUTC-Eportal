import { openAisWithServerSession } from "./portal-session.js";

export const AIS_ABSENCE_URL =
  "https://ais.nutc.edu.tw/student/discipline/absence_list.aspx";
const CACHE_TTL_MS = 5 * 60_000;

let cachedAbsences = null;
let fetchInFlight = null;

function absenceError(message, code, statusCode = 502) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  return error;
}

// Read the absence table and its summary counts from a page that is already on
// absence_list.aspx. The caller owns the AIS session.
export async function readAbsences(page) {
  await page
    .waitForFunction(
      () =>
        document.querySelectorAll("table").length > 0 ||
        /無資料|查無|沒有資料/.test(document.body?.innerText || ""),
      null,
      { timeout: 10_000 },
    )
    .catch(() => {});

  const parsed = await page.evaluate(() => {
    const clean = (value) =>
      String(value ?? "")
        .replace(/\u00a0/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    const tables = [...document.querySelectorAll("table")];

    const candidate = tables
      .map((table) => {
        const rows = [...table.querySelectorAll("tr")];
        const headerRow = rows.find((row) => {
          const headers = [...row.querySelectorAll("th,td")].map((cell) =>
            clean(cell.textContent),
          );
          const joined = headers.join("|");

          return (
            /課程/.test(joined) &&
            /缺曠狀態|缺曠請假|缺曠/.test(joined) &&
            /上課教師|教師/.test(joined)
          );
        });

        if (!headerRow) return null;

        const headers = [...headerRow.querySelectorAll("th,td")].map((cell) =>
          clean(cell.textContent),
        );

        return { table, rows, headerRow, headers };
      })
      .find(Boolean);

    const items = [];
    let headers = [];

    if (candidate) {
      const { rows, headerRow } = candidate;
      headers = candidate.headers;
      const headerIndex = (pattern) =>
        headers.findIndex((header) => pattern.test(header));

      const classIndex = headerIndex(/開課班級|班級/);
      const courseIndex = headerIndex(/課程/);
      const groupIndex = headerIndex(/分組/);
      const requiredIndex = headerIndex(/修別/);
      const creditIndex = headerIndex(/學分.*時數|學分\/時數/);
      const teacherIndex = headerIndex(/上課教師|教師/);
      const statusIndex = headerIndex(/缺曠狀態|缺曠請假|缺曠/);

      for (const row of rows) {
        if (row === headerRow) continue;

        const cellElements = [...row.querySelectorAll("td")];
        const cells = cellElements.map((cell) => clean(cell.textContent));
        if (!cells.length) continue;

        const read = (index) => (index >= 0 ? cells[index] || "" : "");
        const statusCell = statusIndex >= 0 ? cellElements[statusIndex] : null;
        const statusLines = String(
          statusCell?.innerText || statusCell?.textContent || "",
        )
          .split(/\r?\n|、|，|;/)
          .map(clean)
          .filter(Boolean)
          .filter((entry) => !/^[-—–]+$/.test(entry));
        const status = statusLines.join(" · ");

        if (!status) continue;

        items.push({
          className: read(classIndex),
          course: read(courseIndex),
          group: read(groupIndex),
          required: read(requiredIndex),
          credits: read(creditIndex),
          teacher: read(teacherIndex),
          status,
          statusLines,
        });
      }
    }

    const selectedLabels = [...document.querySelectorAll("select option:checked")]
      .map((option) => clean(option.textContent))
      .filter(Boolean)
      .filter((label) => /學期|上學期|下學期|第.*學期|\d{2,3}年/.test(label))
      .slice(0, 2);
    const termSelect = [...document.querySelectorAll("select")].find((select) =>
      [...select.options].some((option) => /\d{2,3}年\([上下]\)/.test(clean(option.textContent))),
    );
    const terms = termSelect
      ? [...termSelect.options].map((option) => ({
          value: option.value,
          label: clean(option.textContent),
        }))
      : [];

    // The summary is a small table: the first row holds 曠課/遲到/早退/請假/
    // 操行, the second holds the leave types, and the third holds the numbers.
    const summary = {};
    const summaryTable = tables.find((table) => {
      const text = clean(table.textContent);
      return /曠課/.test(text) && /遲到/.test(text) && /操行/.test(text);
    });

    if (summaryTable) {
      const rows = [...summaryTable.querySelectorAll("tr")].map((row) =>
        [...row.querySelectorAll("th,td")].map((cell) => clean(cell.textContent)),
      );
      const headerRow = rows.find((cells) => cells.includes("曠課") && cells.includes("遲到"));
      const leaveRow = rows.find((cells) => cells.includes("公假"));
      const numberRow = rows.find(
        (cells) =>
          cells.length >= 2 &&
          cells.filter((cell) => /^-?\d+$/.test(cell)).length >= 2,
      );

      if (headerRow && numberRow) {
        // The header uses rowspans/colspans: 曠課, 遲到, 早退, 請假 (8
        // columns), 操行. The number row has one cell per leave type, so the
        // first four counts are the first four cells and 操行 is the last.
        summary.absent = Number(numberRow[0]);
        summary.late = Number(numberRow[1]);
        summary.earlyLeave = Number(numberRow[2]);
        summary.leaveTotal = Number(numberRow[3]);
        summary.conduct = numberRow[numberRow.length - 1] || "";
      }

      if (leaveRow && numberRow) {
        const leaveTypes = {};
        const offset = Math.max(0, numberRow.length - leaveRow.length - 1);
        ["公假", "事假", "病假", "喪假", "生理假", "婚假", "分娩假", "產前假"].forEach((label, index) => {
          const value = numberRow[offset + index];
          if (/^-?\d+$/.test(value || "")) leaveTypes[label] = Number(value);
        });
        summary.leaveTypes = leaveTypes;
      }
    }

    const bodyText = clean(document.body?.innerText || "");
    const summaryLabels = ["曠課", "遲到", "早退", "公假", "事假", "病假", "喪假", "生理假", "婚假", "分娩假", "產前假"];

    if (!summaryTable) {
      for (const label of summaryLabels) {
        const pattern = new RegExp(label + "\\s*[：:]?\\s*(\\d+)");
        const match = bodyText.match(pattern);
        if (match) summary[label] = Number(match[1]);
      }
    }

    return {
      items,
      headers,
      terms,
      termLabel: (selectedLabels.join(" ") || terms.find((term) => term.label)?.label || "").trim(),
      summary,
      emptyMessage: items.length ? "" : "目前沒有缺曠紀錄。",
    };
  });

  return {
    source: "NUTC AIS",
    sourceUrl: AIS_ABSENCE_URL,
    timezone: "Asia/Taipei",
    fetchedAt: new Date().toISOString(),
    termLabel: parsed.termLabel || "",
    terms: parsed.terms || [],
    headers: parsed.headers || [],
    items: parsed.items || [],
    total: parsed.items?.length || 0,
    summary: parsed.summary || {},
    emptyMessage: parsed.emptyMessage || "",
  };
}

async function fetchFreshAbsences() {
  const session = await openAisWithServerSession({
    headless: true,
    timeoutMs: 8_000,
  });

  try {
    const { page } = session;

    await page.goto(AIS_ABSENCE_URL, {
      waitUntil: "domcontentloaded",
      timeout: 20_000,
    });

    const current = new URL(page.url());

    if (
      current.hostname !== "ais.nutc.edu.tw" ||
      /\/login\.aspx$/i.test(current.pathname)
    ) {
      throw absenceError(
        "Server ePortal session expired. Sign in again to load absence records.",
        "EPORTAL_LOGIN_REQUIRED",
        401,
      );
    }

    session.aisAuth.assertValid();
    // AIS can report expired authentication using a blocking JS alert while
    // staying on the expected URL. Check again after page data has loaded.
    const absences = await readAbsences(page);
    session.aisAuth.assertValid();
    return absences;
  } catch (error) {
    session.aisAuth.assertValid();
    if (error?.code === "EPORTAL_LOGIN_REQUIRED") throw error;

    if (error?.name === "TimeoutError") {
      throw absenceError(
        "AIS absence records did not finish loading in time.",
        "ABSENCE_LIST_TIMEOUT",
        504,
      );
    }

    throw error;
  } finally {
    await session.context.close().catch(() => {});
  }
}

export function clearAbsenceListCache() {
  cachedAbsences = null;
}

export async function getAbsenceList({ force = false } = {}) {
  const now = Date.now();

  if (
    !force &&
    cachedAbsences &&
    now - cachedAbsences.cachedAtMs < CACHE_TTL_MS
  ) {
    return {
      ...cachedAbsences.value,
      cached: true,
      stale: false,
    };
  }

  if (fetchInFlight) return fetchInFlight;

  fetchInFlight = (async () => {
    try {
      const value = await fetchFreshAbsences();
      cachedAbsences = {
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
        clearAbsenceListCache();
        throw error;
      }

      if (cachedAbsences) {
        return {
          ...cachedAbsences.value,
          cached: true,
          stale: true,
          refreshError: error?.message || "Unable to refresh absence records.",
        };
      }

      throw error;
    } finally {
      fetchInFlight = null;
    }
  })();

  return fetchInFlight;
}
