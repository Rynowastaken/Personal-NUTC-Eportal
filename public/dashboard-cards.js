/* Dashboard module and pinned-shortcut cards share this renderer.
 * Keep the inline fallback glass surfaces until every deployment reliably
 * rebuilds compiled CSS; mobile browsers may retain older stylesheets.
 */
// Theme palettes include a dark "secondary" swatch meant for fills. As a tile
// tint or icon colour it vanishes into the glass, so lift dark swatches.
export function legibleAccent(color) {
  const match = /^#?([0-9a-f]{6})$/i.exec(String(color || ""));
  if (!match) return color;
  const value = parseInt(match[1], 16);
  const channels = [value >> 16, (value >> 8) & 255, value & 255];
  const luminance = (channels[0] * 299 + channels[1] * 587 + channels[2] * 114) / 255000;
  if (luminance >= 0.42) return color;
  const lift = 0.42 - luminance + 0.25;
  return "#" + channels
    .map((channel) => Math.round(channel + (255 - channel) * Math.min(lift, 0.7)))
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("");
}

export function moduleAccent(index) {
  const palette = window.NutcTheme?.palette?.() || [
    "#f0a8c8",
    "#e8b86d",
    "#c79af4",
    "#7cc9ff",
    "#151018",
  ];

  const order = [0, 1, 2, 3, 1];
  return legibleAccent(palette[order[index % order.length]] || palette[0] || "#f0a8c8");
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
    "dashboard-module-card wall-tile group relative flex min-h-[128px] w-full flex-col justify-between gap-4 p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent sm:min-h-[148px]";
  // Core glass surfaces must render even when generated CSS is stale on a
  // mobile browser or the server was restarted before rebuilding its assets.
  // The stylesheet only adds the press tilt and hover wash.
  const rgba = window.NutcTheme?.rgba ||
    ((_color, alpha) => "rgba(45, 40, 50, " + alpha + ")");
  card.style.setProperty("--module-accent", accent);
  // The same flat dark glass as the live tiles and the schedule and absence
  // panels; the accent colour stays on the icon chip.
  card.style.borderRadius = "6px";
  card.style.overflow = "hidden";
  card.style.border = "1px solid rgba(255,255,255,.12)";
  card.style.background = "var(--glass, rgba(18,15,22,.46))";
  // The background shorthand resets background-clip, so this must be last.
  card.style.backgroundClip = "padding-box";
  card.style.boxShadow = "none";
  card.style.backdropFilter = "blur(20px) saturate(160%)";
  card.style.webkitBackdropFilter = "blur(20px) saturate(160%)";

  const icon = document.createElement("span");
  icon.className =
    "dashboard-module-icon relative z-10 grid h-9 w-9 shrink-0 place-items-center";
  icon.style.color = accent;
  icon.style.borderRadius = "4px";
  icon.style.border = "1px solid " + rgba(accent, 0.3);
  icon.style.background = rgba(accent, 0.16);
  icon.style.backgroundClip = "padding-box";
  icon.style.boxShadow = "none";
  const iconGlyph = document.createElement("i");
  iconGlyph.setAttribute("data-lucide", iconName);
  iconGlyph.className = "h-[18px] w-[18px]";
  icon.append(iconGlyph);

  const copy = document.createElement("span");
  copy.className = "relative z-10 min-w-0";
  const title = document.createElement("h3");
  title.className =
    "dashboard-module-title truncate text-[19px] font-normal leading-tight tracking-[-0.02em] text-[var(--foreground)] sm:text-[22px]";
  title.textContent = titleText;
  const description = document.createElement("p");
  description.className =
    "mt-1 line-clamp-1 text-[12px] font-normal leading-5 text-[var(--muted)]";
  description.textContent = descriptionText;
  copy.append(title, description);

  const arrow = document.createElement("span");
  arrow.className =
    "dashboard-module-action absolute right-3 top-3 z-10 grid h-7 w-7 place-items-center";
  arrow.style.color = "var(--muted)";
  arrow.style.borderRadius = "4px";
  arrow.style.border = "1px solid rgba(255,255,255,0)";
  arrow.style.background = "rgba(255,255,255,0)";
  arrow.style.backgroundClip = "padding-box";
  arrow.style.boxShadow = "none";
  const arrowGlyph = document.createElement("i");
  arrowGlyph.setAttribute("data-lucide", trailingIcon);
  arrowGlyph.setAttribute("aria-hidden", "true");
  arrowGlyph.className = "h-[16px] w-[16px]";
  arrow.append(arrowGlyph);

  card.append(icon, copy, arrow);
  return card;
}

