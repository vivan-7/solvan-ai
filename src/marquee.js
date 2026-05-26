/**
 * Infinite horizontal capabilities ticker. CSS handles the animation;
 * this module just duplicates the track so the loop is seamless and
 * pauses/resumes via prefers-reduced-motion.
 */

export function initMarquee({ prefersReducedMotion = false } = {}) {
  document.querySelectorAll(".marquee").forEach((m) => {
    const track = m.querySelector(".marquee__track");
    if (!track) return;
    // Duplicate the children once so a -50% translate loops seamlessly.
    const clone = track.cloneNode(true);
    clone.setAttribute("aria-hidden", "true");
    m.appendChild(clone);
    if (prefersReducedMotion) {
      m.querySelectorAll(".marquee__track").forEach(
        (t) => (t.style.animationPlayState = "paused")
      );
    }
  });
}
