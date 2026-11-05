/* Live tiles at the top of the dashboard: next class, absences and today.
 * app.js owns data loading and dispatches render events; this module only
 * turns that data into the tile wall, so it never fetches anything itself.
 */
const $ = (selector) => document.querySelector(selector);

const nextTile = $("#nextClassTile");
const nextLabel = $("#nextClassLabel");
const nextWhen = $("#nextClassWhen");
const nextName = $("#nextClassName");
const nextMeta = $("#nextClassMeta");
const absenceTile = $("#absenceCountTile");
const absenceValue = $("#absenceCountValue");
const absenceMeta = $("#absenceCountMeta");
const todayWeekday = $("#todayWeekday");
const todayDate = $("#todayDate");
const todayMeta = $("#todayMeta");

const WEEKDAYS = ["週一", "週二", "週三", "週四", "週五", "週六", "週日"];
const STATUS_TITLES = {
  login: "尚未登入",
  loading: "載入中…",
  error: "無法載入",
};
const ABSENCE_STATUS = {
  login: "登入後顯示",
  loading: "載入中…",
  error: "無法載入，請見下方",
};
let scheduleDetail = null;
let renderedClass = "";
let renderedAbsences = "";

export function taipeiClock(now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Taipei",
      weekday: "short",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((part) => [part.type, part.value]),
  );
  const weekdayIndex = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    .indexOf(parts.weekday);
  return {
    dayIndex: weekdayIndex,
    date: `${parts.month}/${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

function toMinutes(value) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value || "").trim());
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

// Pick what the student needs to know right now: the class in progress,
// the next one today, or the first class on a later day of this week.
export function pickNextClass(blocks, today, nowMinutes, noClassDays = []) {
  const usable = (blocks || [])
    .filter((block) => !noClassDays.includes(block.dayIndex))
    .map((block) => ({
      ...block,
      start: toMinutes(block.startTime),
      end: toMinutes(block.endTime),
    }))
    .filter((block) => block.start !== null && block.end !== null)
    .sort((a, b) => a.dayIndex - b.dayIndex || a.start - b.start);

  if (today >= 0) {
    const current = usable.find((block) =>
      block.dayIndex === today &&
      nowMinutes >= block.start && nowMinutes <= block.end);
    if (current) return { kind: "now", block: current };

    const later = usable.find((block) =>
      block.dayIndex === today && block.start > nowMinutes);
    if (later) return { kind: "today", block: later };
  }

  const upcoming = usable.find((block) => block.dayIndex > today);
  return upcoming ? { kind: "later", block: upcoming } : { kind: "none" };
}

function flip(tile) {
  if (!tile) return;
  tile.querySelectorAll(".live-tile-face").forEach((face) => {
    face.removeAttribute("data-flip");
    // Restart the animation on every data change.
    void face.offsetWidth;
    face.setAttribute("data-flip", "true");
  });
}

function setText(node, value) {
  if (node && node.textContent !== value) node.textContent = value;
}

function renderNextClass() {
  if (!nextTile) return;
  const clock = taipeiClock();

  // Status messages are sentences; the big slot gets a short state and the
  // full sentence goes to the meta line, which may wrap.
  if (!scheduleDetail?.blocks) {
    const kind = scheduleDetail?.kind;
    nextTile.classList.remove("live-tile--flood");
    setText(nextLabel, "下一堂");
    setText(nextWhen, "");
    setText(nextName, STATUS_TITLES[kind] || (scheduleDetail ? "沒有課表" : "載入中…"));
    setText(nextMeta, scheduleDetail?.message || "本週課表載入後自動更新");
    return;
  }

  const { blocks, today, noClassDays = [] } = scheduleDetail;
  const pick = pickNextClass(blocks, today, clock.minutes, noClassDays);
  let label = "下一堂";
  let when = "";
  let name = "本週已無課程";
  let meta = "好好休息，下週課表會自動出現";

  if (pick.block) {
    const { block } = pick;
    name = block.name || "未命名課程";
    meta = [block.room, block.teacher].filter(Boolean).join(" · ") || "教室未提供";
    if (pick.kind === "now") {
      label = "現在";
      when = `${block.startTime}–${block.endTime}`;
    } else if (pick.kind === "today") {
      const wait = block.start - clock.minutes;
      when = wait <= 90 ? `${wait} 分鐘後` : `${block.startTime} 開始`;
    } else {
      label = "下次上課";
      when = `${WEEKDAYS[block.dayIndex] || ""} ${block.startTime}`;
    }
  }

  nextTile.classList.toggle("live-tile--flood",
    pick.kind === "now" || pick.kind === "today");
  setText(nextLabel, label);
  setText(nextWhen, when);
  setText(nextName, name);
  setText(nextMeta, meta);
  nextTile.setAttribute("aria-label", `${label}：${name}${when ? "，" + when : ""}`);
  // Flip only when real data replaces real data, never on first load.
  if (renderedClass && renderedClass !== label + name) flip(nextTile);
  renderedClass = label + name;
}

function renderToday() {
  const clock = taipeiClock();
  setText(todayWeekday, WEEKDAYS[clock.dayIndex] || "今天");
  setText(todayDate, clock.date);
  if (!scheduleDetail?.blocks) {
    setText(todayMeta, "今日課程");
    return;
  }
  const { blocks, today, noClassDays = [] } = scheduleDetail;
  if (today < 0) {
    setText(todayMeta, "顯示下週課表");
    return;
  }
  if (noClassDays.includes(today)) {
    setText(todayMeta, "今天停課");
    return;
  }
  const todays = blocks.filter((block) => block.dayIndex === today);
  const remaining = todays.filter((block) =>
    (toMinutes(block.endTime) ?? 0) >= clock.minutes);
  setText(todayMeta, !todays.length
    ? "今天沒有課"
    : remaining.length
      ? `今天還有 ${remaining.length} 堂課`
      : "今天的課已結束");
}

function renderAbsences(detail) {
  if (!absenceTile) return;
  if (!detail || detail.message) {
    // The small tile only names the state; the full hint is in the panel below.
    setText(absenceValue, "–");
    setText(absenceMeta, ABSENCE_STATUS[detail?.kind] || detail?.message || "本學期紀錄");
    absenceTile.setAttribute("aria-label", `缺曠紀錄：${detail?.message || "本學期紀錄"}`);
    return;
  }
  const total = String(Number(detail.total || 0));
  const summary = Object.entries(detail.summary || {})
    .filter(([, count]) => Number(count) > 0)
    .slice(0, 3)
    .map(([label, count]) => `${label} ${count}`)
    .join(" · ");
  setText(absenceValue, total);
  setText(absenceMeta, summary || (total === "0" ? "目前沒有缺曠" : "本學期紀錄"));
  absenceTile.setAttribute("aria-label", `缺曠紀錄 ${total} 筆${summary ? "：" + summary : ""}`);
  if (renderedAbsences && renderedAbsences !== total) flip(absenceTile);
  renderedAbsences = total;
}

function scrollToSection(selector) {
  const target = document.querySelector(selector);
  if (!target) return;
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
}

// Tiles lean toward the finger while pressed; CSS drops this for reduced motion.
function bindTilt() {
  const release = (tile) => {
    if (!tile) return;
    tile.removeAttribute("data-pressed");
    tile.style.removeProperty("--tilt-x");
    tile.style.removeProperty("--tilt-y");
    tile.style.removeProperty("--tilt-s");
  };
  document.addEventListener("pointerdown", (event) => {
    const tile = event.target.closest?.(".wall-tile, button.live-tile");
    if (!tile || event.button > 0) return;
    const rect = tile.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    // Wide tiles tilt less so the far edge never leaves the grid.
    const strength = rect.width > 420 ? 4 : 7;
    tile.dataset.pressed = "true";
    tile.style.setProperty("--tilt-x", `${(-y * strength).toFixed(2)}deg`);
    tile.style.setProperty("--tilt-y", `${(x * strength).toFixed(2)}deg`);
    tile.style.setProperty("--tilt-s", "0.985");
    const done = () => {
      release(tile);
      window.removeEventListener("pointerup", done);
      window.removeEventListener("pointercancel", done);
    };
    window.addEventListener("pointerup", done);
    window.addEventListener("pointercancel", done);
  });
}

export function initTodayTiles() {
  renderToday();
  renderNextClass();
  nextTile?.addEventListener("click", () => scrollToSection("#classScheduleSection"));
  absenceTile?.addEventListener("click", () => scrollToSection("#absenceListSection"));
  document.addEventListener("nutc:schedule", (event) => {
    scheduleDetail = event.detail || null;
    renderNextClass();
    renderToday();
  });
  document.addEventListener("nutc:absences", (event) => renderAbsences(event.detail));
  window.setInterval(() => {
    renderNextClass();
    renderToday();
  }, 30_000);
  bindTilt();
}
