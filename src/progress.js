/**
 * Thin scroll-progress indicator across the very top of the viewport.
 * Driven by raw scrollY / (scrollHeight - innerHeight), so it stays
 * accurate regardless of whether Lenis is active.
 */

export function initProgress() {
  const bar = document.getElementById("progress-bar");
  if (!bar) return;

  let raf = 0;
  const update = () => {
    raf = 0;
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    const pct = scrollable > 0 ? Math.min(1, window.scrollY / scrollable) : 0;
    bar.style.transform = `scaleX(${pct})`;
  };

  const schedule = () => {
    if (raf) return;
    raf = requestAnimationFrame(update);
  };

  update();
  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule);
}
