import * as THREE from "three";

/**
 * A slowly orbiting constellation of nodes — each node is one deployed
 * "AI employee" in the Solvan staffing model. 88 by default (the Year-1
 * target). They orbit at varying radii and speeds, with thin connection
 * lines drawn between the nearest few neighbours.
 *
 * Renders into a canvas inside its host section. Pauses when offscreen.
 */

const SAFFRON = new THREE.Color(0xc2742e);
const OBSIDIAN = new THREE.Color(0x1a1b1f);
const SMOKE = new THREE.Color(0x4a4b52);

export function initConstellation({
  canvas,
  count = 88,
  prefersReducedMotion = false,
} = {}) {
  if (!canvas) return null;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0, 9);

  // Generate node positions on a tilted disc — gives a galactic feel
  // when slowly rotated.
  const nodes = [];
  for (let i = 0; i < count; i++) {
    const r = 1.6 + Math.random() * 2.6;
    const theta = Math.random() * Math.PI * 2;
    const yJitter = (Math.random() - 0.5) * 0.5;
    nodes.push({
      r,
      theta,
      yJitter,
      speed: 0.06 + Math.random() * 0.18,
      size: 0.04 + Math.random() * 0.06,
      hue: Math.random() > 0.85 ? SAFFRON : SMOKE, // ~15% accented
    });
  }

  // Node mesh — InstancedMesh for performance.
  const nodeGeom = new THREE.SphereGeometry(1, 12, 12);
  const nodeMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.9,
  });
  const instanced = new THREE.InstancedMesh(nodeGeom, nodeMat, count);
  instanced.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(instanced);

  const colorAttr = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const c = nodes[i].hue;
    colorAttr[i * 3 + 0] = c.r;
    colorAttr[i * 3 + 1] = c.g;
    colorAttr[i * 3 + 2] = c.b;
  }
  instanced.instanceColor = new THREE.InstancedBufferAttribute(colorAttr, 3);

  // Connection lines — start as a single BufferGeometry that we update
  // each frame with the K nearest pairs from a random subset (so we don't
  // do an O(n²) scan on every frame at 88 nodes).
  const maxLines = 96;
  const lineGeom = new THREE.BufferGeometry();
  const linePositions = new Float32Array(maxLines * 6); // 2 verts × xyz
  lineGeom.setAttribute(
    "position",
    new THREE.BufferAttribute(linePositions, 3)
  );
  const lineMat = new THREE.LineBasicMaterial({
    color: 0x8a857a,
    transparent: true,
    opacity: 0.22,
  });
  const lines = new THREE.LineSegments(lineGeom, lineMat);
  scene.add(lines);

  // Group everything so we can tilt + rotate as a whole.
  const root = new THREE.Group();
  root.add(instanced);
  root.add(lines);
  scene.add(root);
  scene.remove(instanced);
  scene.remove(lines);
  root.rotation.x = -0.45;

  // Sizing
  const size = () => {
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, rect.width);
    const h = Math.max(1, rect.height);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  size();
  let resizeTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(size, 80);
  });

  // Cursor parallax (subtle)
  const target = { x: 0, y: 0 };
  const current = { x: 0, y: 0 };
  window.addEventListener(
    "pointermove",
    (e) => {
      target.x = (e.clientX / window.innerWidth - 0.5) * 2;
      target.y = (e.clientY / window.innerHeight - 0.5) * 2;
    },
    { passive: true }
  );

  // Pause offscreen
  let isVisible = false;
  const io = new IntersectionObserver(
    (entries) => entries.forEach((e) => (isVisible = e.isIntersecting)),
    { threshold: 0 }
  );
  io.observe(canvas);

  // Render loop
  const targetFPS = 60;
  const frameTime = 1000 / targetFPS;
  let last = 0;
  const start = performance.now();
  let rafId = 0;

  const dummy = new THREE.Object3D();
  const positions = new Array(count).fill(null).map(() => new THREE.Vector3());

  const tick = (now) => {
    rafId = requestAnimationFrame(tick);
    if (!isVisible) return;
    if (now - last < frameTime) return;
    last = now;

    const t = (now - start) * 0.001;

    if (!prefersReducedMotion) {
      // Orbit each node
      for (let i = 0; i < count; i++) {
        const n = nodes[i];
        const theta = n.theta + t * n.speed;
        const x = Math.cos(theta) * n.r;
        const z = Math.sin(theta) * n.r;
        const y = n.yJitter + Math.sin(t * 0.5 + i) * 0.06;
        positions[i].set(x, y, z);
        dummy.position.set(x, y, z);
        dummy.scale.setScalar(n.size);
        dummy.updateMatrix();
        instanced.setMatrixAt(i, dummy.matrix);
      }
      instanced.instanceMatrix.needsUpdate = true;

      // Connection lines — connect each node to its nearest neighbour
      // (cheap O(n²/2) with n=88 ≈ 3.9k pair checks per frame, fine).
      let lineIdx = 0;
      for (let i = 0; i < count && lineIdx < maxLines; i++) {
        let nearest = -1;
        let nd = Infinity;
        for (let j = i + 1; j < count; j++) {
          const d = positions[i].distanceToSquared(positions[j]);
          if (d < nd) { nd = d; nearest = j; }
        }
        if (nearest >= 0 && nd < 1.2) {
          const a = positions[i];
          const b = positions[nearest];
          linePositions[lineIdx * 6 + 0] = a.x;
          linePositions[lineIdx * 6 + 1] = a.y;
          linePositions[lineIdx * 6 + 2] = a.z;
          linePositions[lineIdx * 6 + 3] = b.x;
          linePositions[lineIdx * 6 + 4] = b.y;
          linePositions[lineIdx * 6 + 5] = b.z;
          lineIdx++;
        }
      }
      // Zero-out unused line slots
      for (let i = lineIdx; i < maxLines; i++) {
        linePositions[i * 6 + 0] = 0;
        linePositions[i * 6 + 1] = 0;
        linePositions[i * 6 + 2] = 0;
        linePositions[i * 6 + 3] = 0;
        linePositions[i * 6 + 4] = 0;
        linePositions[i * 6 + 5] = 0;
      }
      lineGeom.attributes.position.needsUpdate = true;

      // Group rotation + parallax
      current.x += (target.x - current.x) * 0.04;
      current.y += (target.y - current.y) * 0.04;
      root.rotation.y = t * 0.06 + current.x * 0.2;
      root.rotation.x = -0.45 + current.y * 0.15;
    } else {
      // Static layout — render once
      for (let i = 0; i < count; i++) {
        const n = nodes[i];
        const x = Math.cos(n.theta) * n.r;
        const z = Math.sin(n.theta) * n.r;
        const y = n.yJitter;
        dummy.position.set(x, y, z);
        dummy.scale.setScalar(n.size);
        dummy.updateMatrix();
        instanced.setMatrixAt(i, dummy.matrix);
      }
      instanced.instanceMatrix.needsUpdate = true;
    }

    renderer.render(scene, camera);
  };
  rafId = requestAnimationFrame(tick);

  return {
    destroy() {
      cancelAnimationFrame(rafId);
      io.disconnect();
      nodeGeom.dispose();
      nodeMat.dispose();
      lineGeom.dispose();
      lineMat.dispose();
      renderer.dispose();
    },
  };
}
