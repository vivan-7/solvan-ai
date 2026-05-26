/**
 * GSAP-powered reveals: hero word stagger on load, and per-section fade-ups
 * via ScrollTrigger. Skipped under prefers-reduced-motion (CSS handles the
 * static fallback).
 */

export function initReveals({ prefersReducedMotion = false } = {}) {
  if (prefersReducedMotion || !window.gsap || !window.ScrollTrigger) return;

  const gsap = window.gsap;
  gsap.registerPlugin(window.ScrollTrigger);

  // Hero entrance — word stagger
  const words = document.querySelectorAll(".hero__headline .word");
  gsap.set(words, { y: 56, opacity: 0 });
  gsap.to(words, {
    y: 0,
    opacity: 1,
    duration: 1.0,
    ease: "power3.out",
    stagger: 0.08,
    delay: 0.2,
  });

  gsap.from(".hero__marker", {
    scaleY: 0,
    transformOrigin: "top",
    duration: 0.7,
    delay: 0.15,
    ease: "power2.out",
  });

  gsap.from(
    [
      ".hero__eyebrow",
      ".hero__sub",
      ".hero__ctas",
      ".hero__locale",
      ".hero__cue",
    ],
    {
      y: 18,
      opacity: 0,
      duration: 0.8,
      stagger: 0.09,
      delay: 0.65,
      ease: "power2.out",
    }
  );

  // Section reveals — anything with .reveal
  document.querySelectorAll(".reveal").forEach((el) => {
    gsap.to(el, {
      y: 0,
      opacity: 1,
      duration: 0.85,
      ease: "power2.out",
      scrollTrigger: {
        trigger: el,
        start: "top 88%",
        toggleActions: "play none none none",
      },
    });
  });

  // Hero crystal scroll-drift (the canvas wrapper moves + fades)
  const heroRight = document.querySelector(".hero__right");
  if (heroRight) {
    gsap.to(heroRight, {
      y: -100,
      opacity: 0,
      ease: "none",
      scrollTrigger: {
        trigger: ".hero",
        start: "top top",
        end: "bottom top",
        scrub: true,
      },
    });
  }

  // Scroll cue fades out almost immediately
  const cue = document.querySelector(".hero__cue");
  if (cue) {
    gsap.to(cue, {
      opacity: 0,
      y: 12,
      ease: "none",
      scrollTrigger: {
        trigger: ".hero",
        start: "top top",
        end: "+=180",
        scrub: true,
      },
    });
  }
}
