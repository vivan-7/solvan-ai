/**
 * 3D tilt on cards. Apply class .tilt to any element. The card rotates
 * up to ±8° on X/Y based on cursor position over the card, with a slight
 * highlight overlay that follows the pointer.
 *
 * Uses CSS custom properties for the transform so it composes cleanly
 * with other transforms applied via classes.
 */

const MAX_TILT = 8; // degrees
const PERSPECTIVE = 1000; // px

export function initTilt({ prefersReducedMotion = false } = {}) {
  if (prefersReducedMotion) return;

  document.querySelectorAll(".tilt").forEach((card) => {
    const inner = card.querySelector(".tilt__inner") || card;
    const glare = card.querySelector(".tilt__glare");
    let raf = 0;
    let rect = null;
    const state = { rx: 0, ry: 0, tx: 0, ty: 0, glare: { x: 50, y: 50 } };

    const measure = () => (rect = card.getBoundingClientRect());

    const onEnter = () => {
      measure();
      card.style.transition = "transform 200ms ease-out";
      requestAnimationFrame(() => (card.style.transition = ""));
    };

    const onMove = (e) => {
      if (!rect) measure();
      const x = (e.clientX - rect.left) / rect.width; // 0..1
      const y = (e.clientY - rect.top) / rect.height;
      state.tx = (x - 0.5) * 2 * MAX_TILT * -1; // invert for natural tilt
      state.ty = (y - 0.5) * 2 * MAX_TILT;
      state.glare.x = x * 100;
      state.glare.y = y * 100;
      schedule();
    };

    const onLeave = () => {
      state.tx = 0;
      state.ty = 0;
      card.style.transition = "transform 480ms cubic-bezier(0.22, 1, 0.36, 1)";
      schedule();
      if (glare) glare.style.opacity = "0";
      setTimeout(() => (card.style.transition = ""), 520);
    };

    const schedule = () => {
      if (raf) return;
      raf = requestAnimationFrame(loop);
    };

    const loop = () => {
      state.rx += (state.ty - state.rx) * 0.18;
      state.ry += (state.tx - state.ry) * 0.18;
      inner.style.transform =
        `perspective(${PERSPECTIVE}px) ` +
        `rotateX(${state.rx.toFixed(2)}deg) ` +
        `rotateY(${state.ry.toFixed(2)}deg)`;
      if (glare) {
        glare.style.opacity = "1";
        glare.style.background =
          `radial-gradient(circle at ${state.glare.x}% ${state.glare.y}%,` +
          ` rgba(194, 116, 46, 0.18), transparent 55%)`;
      }
      if (
        Math.abs(state.tx - state.ry) > 0.05 ||
        Math.abs(state.ty - state.rx) > 0.05
      ) {
        raf = requestAnimationFrame(loop);
      } else {
        raf = 0;
        if (state.tx === 0 && state.ty === 0) inner.style.transform = "";
      }
    };

    card.addEventListener("pointerenter", onEnter);
    card.addEventListener("pointermove", onMove);
    card.addEventListener("pointerleave", onLeave);
    window.addEventListener("resize", () => (rect = null));
  });
}
