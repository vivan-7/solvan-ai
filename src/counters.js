/**
 * Number count-up animation on scroll-into-view.
 *
 * Each .counter element has data-target (final number), optional
 * data-prefix (e.g. "₹"), data-suffix (e.g. "L"), and data-duration in ms.
 * The element renders the running value; everything around it stays as
 * static markup so the prefix/suffix can be styled separately.
 */

export function initCounters({ prefersReducedMotion = false } = {}) {
  const els = document.querySelectorAll(".counter");
  if (!els.length) return;

  const format = (el, value) => {
    const prefix = el.dataset.prefix || "";
    const suffix = el.dataset.suffix || "";
    const decimals = parseInt(el.dataset.decimals || "0", 10);
    el.textContent = `${prefix}${value.toFixed(decimals)}${suffix}`;
  };

  if (prefersReducedMotion) {
    els.forEach((el) => format(el, parseFloat(el.dataset.target)));
    return;
  }

  // Pre-set to 0 so the section doesn't flash the final value.
  els.forEach((el) => format(el, 0));

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        observer.unobserve(el);
        runCount(el, format);
      });
    },
    { threshold: 0.35 }
  );

  els.forEach((el) => observer.observe(el));
}

function runCount(el, format) {
  const target = parseFloat(el.dataset.target);
  const duration = parseFloat(el.dataset.duration || "1600");
  const start = performance.now();

  const tick = (now) => {
    const t = Math.min(1, (now - start) / duration);
    const eased = easeOutExpo(t);
    format(el, target * eased);
    if (t < 1) requestAnimationFrame(tick);
    else format(el, target);
  };
  requestAnimationFrame(tick);
}

function easeOutExpo(x) {
  return x === 1 ? 1 : 1 - Math.pow(2, -10 * x);
}
