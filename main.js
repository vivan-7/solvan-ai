import { initCrystal } from "./src/crystal.js";
import { initConstellation } from "./src/constellation.js";
import { initScroll } from "./src/scroll.js";
import { initReveals } from "./src/reveals.js";
import { initNav } from "./src/nav.js";
import { initProgress } from "./src/progress.js";
import { initMagneticCTA } from "./src/cursor.js";
import { initMarquee } from "./src/marquee.js";
import { initCounters } from "./src/counters.js";
import { initTilt } from "./src/tilt.js";

const prefersReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
).matches;

const crystalCanvas = document.getElementById("crystal");
const constellationCanvas = document.getElementById("constellation");

const ready = document.fonts?.ready ?? Promise.resolve();

ready.then(() => {
  document.documentElement.classList.add("is-ready");

  initProgress();
  initNav();
  initScroll({ prefersReducedMotion });
  initReveals({ prefersReducedMotion });
  initMagneticCTA({ prefersReducedMotion });
  initMarquee({ prefersReducedMotion });
  initCounters({ prefersReducedMotion });
  initTilt({ prefersReducedMotion });

  if (crystalCanvas) {
    initCrystal({ canvas: crystalCanvas, prefersReducedMotion });
  }
  if (constellationCanvas) {
    initConstellation({
      canvas: constellationCanvas,
      count: 88,
      prefersReducedMotion,
    });
  }
});
