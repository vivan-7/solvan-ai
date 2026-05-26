import { initCrystal } from "./src/crystal.js";
import { initScroll } from "./src/scroll.js";
import { initReveals } from "./src/reveals.js";
import { initNav } from "./src/nav.js";
import { initMagneticCTA } from "./src/cursor.js";

const prefersReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
).matches;

const canvas = document.getElementById("crystal");

// Wait for fonts so the hero word-stagger lands on stable type metrics.
const ready = document.fonts?.ready ?? Promise.resolve();

ready.then(() => {
  document.documentElement.classList.add("is-ready");

  initNav();
  initScroll({ prefersReducedMotion });
  initReveals({ prefersReducedMotion });
  initMagneticCTA({ prefersReducedMotion });

  if (canvas) {
    initCrystal({ canvas, prefersReducedMotion });
  }
});
