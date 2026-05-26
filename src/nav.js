/**
 * Toggles a sticky-nav state once the user scrolls past the hero baseline.
 * Pure scroll listener; no GSAP dependency so it still works under
 * reduced-motion.
 */

export function initNav() {
  const nav = document.getElementById("nav");
  if (!nav) return;

  const update = () => {
    if (window.scrollY > 80) nav.classList.add("is-scrolled");
    else nav.classList.remove("is-scrolled");
  };
  update();
  window.addEventListener("scroll", update, { passive: true });
}
