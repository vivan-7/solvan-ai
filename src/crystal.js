import * as THREE from "three";

/**
 * Solvan AI crystal — a faceted, slowly-rotating obsidian form with a
 * saffron fresnel rim, environment reflections, ambient dust motes, and
 * a soft saffron halo backdrop. Cursor parallax + scroll-driven drift.
 */

const SAFFRON = 0xc2742e;
const SEASHELL = 0xf3eadb;
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

  // PMREM environment
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  scene.environment = buildEnvMap(pmrem);

  // Soft saffron halo as a billboard behind the crystal
  const haloGeom = new THREE.PlaneGeometry(7, 7);
  const haloMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uIntensity: { value: 0.0 }, // animated up after spawn
      uColor: { value: new THREE.Color(SAFFRON) },
      uTime: { value: 0 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main(){
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uIntensity;
      uniform vec3 uColor;
      uniform float uTime;
      varying vec2 vUv;
      void main(){
        vec2 c = vUv - 0.5;
        float d = length(c);
        float pulse = 0.5 + 0.5 * sin(uTime * 1.2);
        float falloff = smoothstep(0.5, 0.05, d);
        float a = falloff * (0.22 + 0.06 * pulse) * uIntensity;
        gl_FragColor = vec4(uColor, a);
      }
    `,
  });
  const halo = new THREE.Mesh(haloGeom, haloMat);
  halo.position.z = -1.4;
  scene.add(halo);

  // Crystal geometry — subdivided icosahedron with deterministic noise
  const geometry = new THREE.IcosahedronGeometry(1.42, 2);
  applyVertexNoise(geometry);
  geometry.computeVertexNormals();

  const material = new THREE.MeshPhysicalMaterial({
    color: OBSIDIAN,
    roughness: 0.36,
    metalness: 0.58,
    clearcoat: 0.5,
    clearcoatRoughness: 0.22,
    envMapIntensity: 0.95,
    flatShading: true,
  });

  // Fresnel rim — saffron silhouette glow, with a pulsing strength uniform
  material.userData.rimColor = new THREE.Color(SAFFRON);
  material.userData.rimPower = { value: 2.6 };
  material.userData.rimStrength = { value: 0 };
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

  // Ambient dust motes drifting around the crystal
  const dust = createDust(180);
  scene.add(dust.mesh);

  // Lighting
  scene.add(new THREE.AmbientLight(SEASHELL, 0.35));
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

  // Cursor magnetism + hover state
  const target = { x: 0, y: 0, hovered: 0 };
  const current = { x: 0, y: 0, hovered: 0 };

  const onPointerMove = (e) => {
    const rect = canvas.getBoundingClientRect();
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

  // Touch tilt
  if ("ontouchstart" in window) {
    window.addEventListener(
      "deviceorientation",
      (e) => {
        if (!e.gamma || !e.beta) return;
        target.x = Math.max(-1, Math.min(1, e.gamma / 30));
        target.y = Math.max(-1, Math.min(1, (e.beta - 45) / 30));
      },
      { passive: true }
    );
  }

  // Scroll-velocity → rotation speed boost
  let scrollVel = 0;
  let lastScrollY = window.scrollY;
  let lastScrollT = performance.now();
  window.addEventListener(
    "scroll",
    () => {
      const now = performance.now();
      const dt = Math.max(1, now - lastScrollT);
      const dy = window.scrollY - lastScrollY;
      scrollVel = Math.min(8, Math.abs(dy) / dt);
      lastScrollY = window.scrollY;
      lastScrollT = now;
    },
    { passive: true }
  );

  // Offscreen pause
  let isVisible = true;
  const io = new IntersectionObserver(
    (entries) => entries.forEach((e) => (isVisible = e.isIntersecting)),
    { threshold: 0 }
  );
  io.observe(canvas);

  // Entrance
  crystal.scale.setScalar(0.4);
  let spawnT = 0;
  let spawned = false;

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
    haloMat.uniforms.uTime.value = t;
    dust.update(t);

    if (!prefersReducedMotion) {
      // Spawn
      if (!spawned) {
        spawnT = Math.min(1, spawnT + 0.018);
        const eased = easeOutCubic(spawnT);
        const overshoot = 1 + Math.sin(spawnT * Math.PI) * 0.06;
        crystal.scale.setScalar(0.4 + (eased * 0.6) * overshoot);
        material.userData.rimStrength.value = eased * 1.35;
        haloMat.uniforms.uIntensity.value = eased;
        if (spawnT >= 1) spawned = true;
      }

      // Continuous rotation — scroll velocity adds a temporary boost
      scrollVel *= 0.92;
      crystal.rotation.y += 0.0032 + scrollVel * 0.012;
      crystal.rotation.x = 0.15 + Math.sin(t * 0.55) * 0.11;
      crystal.position.y = Math.sin(t * 0.7) * 0.08;

      // Magnetism
      current.x += (target.x - current.x) * 0.06;
      current.y += (target.y - current.y) * 0.06;
      current.hovered += (target.hovered - current.hovered) * 0.08;

      crystal.rotation.z = current.x * 0.14;
      crystal.position.x = current.x * 0.18;
      crystal.position.y += -current.y * 0.12;

      // Hover lift
      if (spawned) {
        const lift = 1 + current.hovered * 0.04;
        crystal.scale.setScalar(lift);
        material.userData.rimStrength.value =
          1.35 + current.hovered * 0.5 + Math.sin(t * 2.4) * 0.06;
        haloMat.uniforms.uIntensity.value = 1 + current.hovered * 0.4;
      }
    }

    renderer.render(scene, camera);
  };
  rafId = requestAnimationFrame(tick);

  return {
    mesh: crystal,
    destroy() {
      cancelAnimationFrame(rafId);
      window.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerenter", onEnter);
      canvas.removeEventListener("pointerleave", onLeave);
      io.disconnect();
      geometry.dispose();
      material.dispose();
      haloGeom.dispose();
      haloMat.dispose();
      dust.dispose();
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
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext("2d");
  const grad = ctx.createLinearGradient(0, 0, 0, 128);
  grad.addColorStop(0, "#FAF5EC");
  grad.addColorStop(0.45, "#F3EADB");
  grad.addColorStop(0.7, "#3a3530");
  grad.addColorStop(1, "#1A1B1F");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 128);
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

function createDust(count) {
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    positions[i * 3 + 0] = (Math.random() - 0.5) * 6;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 4;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 4 - 0.5;
    seeds[i] = Math.random() * 100;
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geom.setAttribute("seed", new THREE.BufferAttribute(seeds, 1));

  const mat = new THREE.PointsMaterial({
    color: 0xb8a78a,
    size: 0.012,
    transparent: true,
    opacity: 0.55,
    sizeAttenuation: true,
    depthWrite: false,
  });
  const mesh = new THREE.Points(geom, mat);

  return {
    mesh,
    update(t) {
      const pos = geom.attributes.position.array;
      const s = geom.attributes.seed.array;
      for (let i = 0; i < count; i++) {
        pos[i * 3 + 1] += 0.0009 + Math.sin(t * 0.5 + s[i]) * 0.0004;
        pos[i * 3 + 0] += Math.sin(t * 0.3 + s[i]) * 0.0006;
        if (pos[i * 3 + 1] > 2.2) pos[i * 3 + 1] = -2.2;
      }
      geom.attributes.position.needsUpdate = true;
    },
    dispose() {
      geom.dispose();
      mat.dispose();
    },
  };
}

function easeOutCubic(x) { return 1 - Math.pow(1 - x, 3); }
