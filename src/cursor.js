/**
 * Subtle magnetic hover on the primary CTA. The button tracks the cursor
 * by a small offset while the pointer is near, then springs back on leave.
 * One restrained interaction — not a full custom-cursor takeover.
 */

export function initMagneticCTA({ prefersReducedMotion = false } = {}) {
  if (prefersReducedMotion) return;

  document.querySelectorAll(".btn--primary").forEach((btn) => {
    const radius = 90;
    const strength = 0.22;
    let raf = 0;
    const state = { x: 0, y: 0, tx: 0, ty: 0 };

    const onMove = (e) => {
      const rect = btn.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.hypot(dx, dy);
      if (dist < radius + Math.max(rect.width, rect.height) / 2) {
        state.tx = dx * strength;
        state.ty = dy * strength;
        schedule();
      } else if (state.tx !== 0 || state.ty !== 0) {
        state.tx = 0;
        state.ty = 0;
        schedule();
      }
    };

    const onLeave = () => {
      state.tx = 0;
      state.ty = 0;
      schedule();
    };

    const schedule = () => {
      if (raf) return;
      raf = requestAnimationFrame(loop);
    };

    const loop = () => {
      state.x += (state.tx - state.x) * 0.18;
      state.y += (state.ty - state.y) * 0.18;
      btn.style.transform = `translate(${state.x.toFixed(2)}px, ${state.y.toFixed(2)}px)`;
      if (Math.abs(state.tx - state.x) > 0.05 || Math.abs(state.ty - state.y) > 0.05) {
        raf = requestAnimationFrame(loop);
      } else {
        raf = 0;
        if (state.tx === 0 && state.ty === 0) {
          btn.style.transform = "";
        }
      }
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    btn.addEventListener("pointerleave", onLeave);
  });
}
