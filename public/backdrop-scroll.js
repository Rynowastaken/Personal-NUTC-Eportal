(() => {
  "use strict";

  const backdrop = document.getElementById("portalBackdrop");
  if (!backdrop) return;

  // The element overflows the viewport by 72px at both ends. Moving it by
  // 0–144px follows downward scrolling without showing uncovered edges.
  const TRAVEL_PX = 144;
  const motionPreference = window.matchMedia?.("(prefers-reduced-motion: reduce)");
  let scheduled = false;

  function updatePosition() {
    scheduled = false;

    if (motionPreference?.matches) {
      backdrop.style.transform = "translate3d(0, 0, 0)";
      return;
    }

    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const pageHeight = Math.max(
      document.documentElement.scrollHeight || 0,
      document.body?.scrollHeight || 0,
    );
    const scrollRange = Math.max(0, pageHeight - viewportHeight);
    const scrollTop = Math.max(0, window.scrollY || window.pageYOffset || 0);
    const progress = scrollRange > 0
      ? Math.min(1, scrollTop / scrollRange)
      : 0;

    backdrop.style.transform =
      "translate3d(0, " + (TRAVEL_PX * progress).toFixed(2) + "px, 0)";
  }

  function schedulePosition() {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(updatePosition);
  }

  // Passive listeners and a single animation-frame update keep wheel/touch
  // scrolling responsive, including on devices with high refresh rates.
  window.addEventListener("scroll", schedulePosition, { passive: true });
  window.addEventListener("resize", schedulePosition);
  window.addEventListener("pageshow", schedulePosition);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) schedulePosition();
  });
  motionPreference?.addEventListener?.("change", schedulePosition);

  // Handle browser-restored scroll positions immediately on navigation.
  updatePosition();
})();
