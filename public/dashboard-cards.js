/* Dashboard module and pinned-shortcut cards share this renderer.
 * Keep the inline fallback glass surfaces until every deployment reliably
 * rebuilds compiled CSS; mobile browsers may retain older stylesheets.
 */
export function moduleAccent(index) {
  const palette = window.NutcTheme?.palette?.() || [
    "#f0a8c8",
    "#e8b86d",
    "#c79af4",
    "#7cc9ff",
    "#151018",
  ];

  const order = [0, 1, 2, 3, 1];
  return palette[order[index % order.length]] || palette[0] || "#f0a8c8";
}

// Built-in modules and pinned external links use the exact same visual system.
// Their interaction differs (button vs external anchor), not their card chrome.
export function createDashboardModuleCard({
  tag = "button",
  accent,
  iconName,
  titleText,
  descriptionText,
  trailingIcon = "arrow-right",
}) {
  const card = document.createElement(tag);
  if (tag === "button") card.type = "button";
  card.className =
    "dashboard-module-card group relative flex min-h-[108px] w-full items-center gap-4 rounded-[20px] p-4 text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--primary-ring)] sm:p-5";
  // Core glass surfaces must render even when generated CSS is stale on a
  // mobile browser or the server was restarted before rebuilding its assets.
  // The stylesheet only adds smooth transitions and an optional hover sheen.
  const rgba = window.NutcTheme?.rgba ||
    ((_color, alpha) => "rgba(45, 40, 50, " + alpha + ")");
  card.style.setProperty("--module-accent", accent);
  card.style.border = "1px solid " + rgba(accent, 0.20);
  card.style.background =
    "linear-gradient(110deg, " + rgba(accent, 0.07) +
    " 0%, rgba(37,34,42,.74) 42%, rgba(22,20,27,.82) 100%)";
  card.style.boxShadow =
    "inset 0 1px 0 rgba(255,255,255,.055), 0 6px 18px -12px rgba(0,0,0,.42)";
  card.style.backdropFilter = "blur(18px) saturate(160%)";
  card.style.webkitBackdropFilter = "blur(18px) saturate(160%)";

  const icon = document.createElement("span");
  icon.className =
    "dashboard-module-icon relative z-10 grid h-11 w-11 shrink-0 place-items-center rounded-[12px]";
  icon.style.color = accent;
  icon.style.border = "1px solid " + rgba(accent, 0.24);
  icon.style.background = rgba(accent, 0.12);
  icon.style.boxShadow = "inset 0 1px 0 rgba(255,255,255,.055)";
  const iconGlyph = document.createElement("i");
  iconGlyph.setAttribute("data-lucide", iconName);
  iconGlyph.className = "h-[20px] w-[20px]";
  icon.append(iconGlyph);

  const copy = document.createElement("span");
  copy.className = "relative z-10 min-w-0 flex-1";
  const title = document.createElement("h3");
  title.className =
    "truncate text-base font-semibold tracking-[-0.02em] text-[var(--foreground)] sm:text-[17px]";
  title.textContent = titleText;
  const description = document.createElement("p");
  description.className =
    "mt-1 line-clamp-2 text-[13px] font-medium leading-5 text-[var(--muted)]";
  description.textContent = descriptionText;
  copy.append(title, description);

  const arrow = document.createElement("span");
  arrow.className =
    "dashboard-module-action relative z-10 grid h-9 w-9 shrink-0 place-items-center rounded-[10px]";
  arrow.style.color = accent;
  arrow.style.border = "1px solid " + rgba(accent, 0.18);
  arrow.style.background = rgba(accent, 0.08);
  arrow.style.boxShadow = "inset 0 1px 0 rgba(255,255,255,.04)";
  const arrowGlyph = document.createElement("i");
  arrowGlyph.setAttribute("data-lucide", trailingIcon);
  arrowGlyph.setAttribute("aria-hidden", "true");
  arrowGlyph.className = "h-[18px] w-[18px]";
  arrow.append(arrowGlyph);

  card.append(icon, copy, arrow);
  return card;
}

