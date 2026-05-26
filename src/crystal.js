import * as THREE from "three";

/**
 * Solvan AI crystal — a faceted, slowly-rotating obsidian form with a
 * saffron fresnel rim, environment reflections, and cursor parallax.
 *
 * Exports init() which boots the scene. Returns a small API.
 */

const SAFFRON = 0xc2742e;
const SEASHELL = 0xf3eadb;
const IVORY = 0xfaf5ec;
const OBSIDIAN = 0x1a1b1f;

export function initCrystal({ canvas, prefersReducedMotion = false } = {}) {
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
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(0, 0, 5.2);

  // Synthetic environment: gradient cube so the obsidian PBR surface
  // picks up subtle seashell highlights at the top and forest shadow at the bottom.
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  scene.environment = buildEnvMap(pmrem);

  // Geometry — subdivided icosahedron + deterministic vertex noise.
  // Higher subdivision yields more facets; we keep flat shading for the
  // chiseled obsidian look.
  const geometry = new THREE.IcosahedronGeometry(1.42, 2);
  applyVertexNoise(geometry);
  geometry.computeVertexNormals();

  // Faceted obsidian material. Clearcoat gives the surface a thin lacquer.
  const material = new THREE.MeshPhysicalMaterial({
    color: OBSIDIAN,
    roughness: 0.38,
    metalness: 0.55,
    clearcoat: 0.45,
    clearcoatRoughness: 0.25,
    envMapIntensity: 0.85,
    flatShading: true,
  });

  // Fresnel rim glow — saffron light wraps the silhouette edges.
  // Patched into the standard material via onBeforeCompile so we keep PBR.
  material.userData.rimColor = new THREE.Color(SAFFRON);
  material.userData.rimPower = { value: 2.6 };
  material.userData.rimStrength = { value: 1.35 };
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uRimColor = { value: material.userData.rimColor };
    shader.uniforms.uRimPower = material.userData.rimPower;
    shader.uniforms.uRimStrength = material.userData.rimStrength;

    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
         uniform vec3 uRimColor;
         uniform float uRimPower;
         uniform float uRimStrength;`
      )
      .replace(
        "#include <opaque_fragment>",
        `#include <opaque_fragment>
         vec3 viewDir = normalize(vViewPosition);
         float fresnel = pow(1.0 - max(dot(normalize(vNormal), viewDir), 0.0), uRimPower);
         gl_FragColor.rgb += uRimColor * fresnel * uRimStrength;`
      );
  };

  const crystal = new THREE.Mesh(geometry, material);
  crystal.rotation.set(0.15, -0.35, 0);
  scene.add(crystal);

  // Lighting — minimal, just enough to give the facets directionality.
  // The bulk of the surface reflection comes from the env map.
  const ambient = new THREE.AmbientLight(SEASHELL, 0.35);
  scene.add(ambient);

  const key = new THREE.DirectionalLight(0xffffff, 0.55);
  key.position.set(-3.2, 4, 5);
  scene.add(key);

  const fill = new THREE.PointLight(SAFFRON, 1.1, 14, 1.6);
  fill.position.set(3.2, -1.6, 2.4);
  scene.add(fill);

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

  // Cursor magnetism (canvas-local coordinates, smoothed)
  const target = { x: 0, y: 0, hovered: 0 };
  const current = { x: 0, y: 0, hovered: 0 };

  const onPointerMove = (e) => {
    const rect = canvas.getBoundingClientRect();
    // Use the viewport so the crystal can lean toward the cursor even
    // before the pointer is over the canvas itself.
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    target.x = ((e.clientX - cx) / window.innerWidth) * 2;
    target.y = ((e.clientY - cy) / window.innerHeight) * 2;
  };

  const onEnter = () => (target.hovered = 1);
  const onLeave = () => (target.hovered = 0);

  window.addEventListener("pointermove", onPointerMove, { passive: true });
  canvas.addEventListener("pointerenter", onEnter);
  canvas.addEventListener("pointerleave", onLeave);

  // devicemotion for mobile tilt (subtle, gated)
  const onTilt = (e) => {
    if (!e.gamma || !e.beta) return;
    target.x = Math.max(-1, Math.min(1, e.gamma / 30));
    target.y = Math.max(-1, Math.min(1, (e.beta - 45) / 30));
  };
  if ("ontouchstart" in window) {
    window.addEventListener("deviceorientation", onTilt, { passive: true });
  }

  // Pause when offscreen
  let isVisible = true;
  const io = new IntersectionObserver(
    (entries) => entries.forEach((e) => (isVisible = e.isIntersecting)),
    { threshold: 0 }
  );
  io.observe(canvas);

  // Entrance — scale in from a small value, slight overshoot, fade rim up.
  crystal.scale.setScalar(0.4);
  material.userData.rimStrength.value = 0;
  let spawnT = 0;
  let spawned = false;

  // Render loop with FPS cap
  const targetFPS = 60;
  const frameTime = 1000 / targetFPS;
  let last = 0;
  const start = performance.now();
  let rafId = 0;

  const tick = (now) => {
    rafId = requestAnimationFrame(tick);
    if (!isVisible) return;
    if (now - last < frameTime) return;
    last = now;

    const t = (now - start) * 0.001;

    if (!prefersReducedMotion) {
      // Spawn — eased scale up, rim fades in
      if (!spawned) {
        spawnT = Math.min(1, spawnT + 0.018);
        const eased = easeOutCubic(spawnT);
        const overshoot = 1 + Math.sin(spawnT * Math.PI) * 0.06;
        crystal.scale.setScalar(0.4 + (eased * 0.6) * overshoot);
        material.userData.rimStrength.value = eased * 1.35;
        if (spawnT >= 1) spawned = true;
      }

      // Continuous rotation
      crystal.rotation.y += 0.0032;
      crystal.rotation.x = 0.15 + Math.sin(t * 0.55) * 0.11;

      // Float
      crystal.position.y = Math.sin(t * 0.7) * 0.08;

      // Cursor magnetism — smooth toward target
      current.x += (target.x - current.x) * 0.06;
      current.y += (target.y - current.y) * 0.06;
      current.hovered += (target.hovered - current.hovered) * 0.08;

      crystal.rotation.z = current.x * 0.14;
      crystal.position.x = current.x * 0.18;
      crystal.position.y += -current.y * 0.12;

      // Hover lift — scale + brighter rim
      const lift = 1 + current.hovered * 0.04;
      crystal.scale.setScalar((spawned ? 1 : crystal.scale.x) * (spawned ? lift : 1));
      material.userData.rimStrength.value =
        (spawned ? 1.35 : material.userData.rimStrength.value) +
        current.hovered * 0.45;
    }

    renderer.render(scene, camera);
  };
  rafId = requestAnimationFrame(tick);

  return {
    mesh: crystal,
    renderer,
    destroy() {
      cancelAnimationFrame(rafId);
      window.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerenter", onEnter);
      canvas.removeEventListener("pointerleave", onLeave);
      io.disconnect();
      geometry.dispose();
      material.dispose();
      renderer.dispose();
      pmrem.dispose();
    },
  };
}

function applyVertexNoise(geometry) {
  const pos = geometry.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    const len = Math.hypot(x, y, z);
    const nx = x / len, ny = y / len, nz = z / len;
    const offset =
      Math.sin(x * 2.3 + y * 1.7) * 0.07 +
      Math.cos(y * 2.1 + z * 1.9) * 0.05 +
      Math.sin(z * 2.5 + x * 1.4) * 0.04;
    pos.setXYZ(i, x + nx * offset, y + ny * offset, z + nz * offset);
  }
  pos.needsUpdate = true;
}

function buildEnvMap(pmrem) {
  // Build a simple gradient environment via a CanvasTexture, then PMREM it.
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext("2d");
  const grad = ctx.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, "#FAF5EC"); // sky — ivory
  grad.addColorStop(0.45, "#F3EADB"); // mid — seashell
  grad.addColorStop(0.7, "#3a3530"); // horizon — warm dark
  grad.addColorStop(1, "#1A1B1F"); // floor — obsidian
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 128);

  // Add a subtle saffron warm spot to give the reflections direction
  const warm = ctx.createRadialGradient(200, 40, 0, 200, 40, 80);
  warm.addColorStop(0, "rgba(194,116,46,0.55)");
  warm.addColorStop(1, "rgba(194,116,46,0)");
  ctx.fillStyle = warm;
  ctx.fillRect(0, 0, 256, 128);

  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  const rt = pmrem.fromEquirectangular(tex);
  tex.dispose();
  return rt.texture;
}

function easeOutCubic(x) {
  return 1 - Math.pow(1 - x, 3);
}
