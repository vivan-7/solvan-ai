/**
 * Lenis smooth-scroll wired into GSAP's ticker so ScrollTrigger animations
 * stay in lockstep with the smoothed scroll position.
 *
 * Also intercepts in-page anchor clicks and routes them through Lenis so
 * the smooth scroll applies to the nav links as well as any href="#..." link.
 */

export function initScroll({ prefersReducedMotion = false } = {}) {
  if (prefersReducedMotion || !window.Lenis) {
    bindNativeAnchors();
    return null;
  }

  const lenis = new window.Lenis({
    lerp: 0.085,
    smoothWheel: true,
    wheelMultiplier: 1.0,
    touchMultiplier: 1.4,
  });

  if (window.gsap && window.ScrollTrigger) {
    lenis.on("scroll", window.ScrollTrigger.update);
    window.gsap.ticker.add((t) => lenis.raf(t * 1000));
    window.gsap.ticker.lagSmoothing(0);
  } else {
    const raf = (time) => {
      lenis.raf(time);
      requestAnimationFrame(raf);
    };
    requestAnimationFrame(raf);
  }

  // Intercept anchor links so they smooth-scroll via Lenis.
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const href = a.getAttribute("href");
      if (!href || href === "#") return;
      const target = document.querySelector(href);
      if (!target) return;
      e.preventDefault();
      lenis.scrollTo(target, { offset: -64, duration: 1.2 });
    });
  });

  return lenis;
}

function bindNativeAnchors() {
  // Reduced motion: still smoothly scroll, but via native API at the
  // browser's chosen behavior (which honors reduced-motion).
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const href = a.getAttribute("href");
      if (!href || href === "#") return;
      const target = document.querySelector(href);
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ block: "start" });
    });
  });
}
