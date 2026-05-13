import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { golfLocations } from "./locations.js";

// ─── User Profile ─────────────────────────────────────────
let userProfile = null;

const profileModal = document.getElementById("profile-modal");
const profileSubmit = document.getElementById("profile-submit");
const radioGroups = ["strategy", "terrain", "environment", "skill"];

function checkProfileComplete() {
  const allChecked = radioGroups.every((name) => {
    const checked = document.querySelector(`input[name="${name}"]:checked`);
    return checked !== null;
  });
  profileSubmit.disabled = !allChecked;
}

document.querySelectorAll("#profile-questions input[type=radio]").forEach((radio) => {
  radio.addEventListener("change", checkProfileComplete);
});

profileSubmit.addEventListener("click", () => {
  userProfile = {};
  radioGroups.forEach((name) => {
    const checked = document.querySelector(`input[name="${name}"]:checked`);
    userProfile[name] = checked.value;
  });
  profileModal.classList.add("hidden");
  scanAllCourses();
});

// ─── Matching Engine v3.0 ───────────────────────────────────
const LEVEL_MAP = { "新手上路": 1, "业余高手": 2, "职业水准": 3 };

function calculateMatch(user, course) {
  const t = course.tags;
  let totalScore = 15;
  let terrainMatch = false;
  let strategyMatch = false;
  let environmentMatch = false;

  if (user.terrain === t.terrain) { totalScore += 35; terrainMatch = true; }
  if (user.strategy === t.strategy) { totalScore += 30; strategyMatch = true; }
  if (user.environment === t.environment) { totalScore += 20; environmentMatch = true; }

  const userLv = LEVEL_MAP[user.skill];
  const courseLv = LEVEL_MAP[t.skill];
  const isHighRisk = userLv < courseLv;

  if (isHighRisk) { totalScore -= 40; }

  const finalScore = Math.max(15, totalScore);

  return { finalScore, isHighRisk, terrainMatch, strategyMatch, environmentMatch, t, user };
}

// ─── Match dimension description ────────────────────────────
function describeMatches(m) {
  const parts = [];
  if (m.terrainMatch) parts.push(`「${m.t.terrain}」地形`);
  if (m.strategyMatch) parts.push(`「${m.t.strategy}」风格`);
  if (m.environmentMatch) parts.push(`「${m.t.environment}」条件`);
  if (parts.length === 0) return "综合";
  return parts.join("和");
}

// ─── Dialogue Decision Tree v3.0 ────────────────────────────
function getCaddyAdvice(loc) {
  if (!userProfile) return "请先完成您的专属高尔夫档案，我将为您提供个性化建议~";

  const m = calculateMatch(userProfile, loc);
  const pct = m.finalScore;

  if (m.isHighRisk) {
    return `贵宾，这是一座标定为「${m.t.skill}」的高难度球场！目前挑战极大，建议多备几盒球哦~（匹配度：${pct}%）`;
  }

  if (pct >= 85) {
    return `这里的「${m.t.terrain}」和您的打球风格完美契合，简直是为您量身定制的专属主场！（匹配度高达 ${pct}%）`;
  }

  if (pct >= 65) {
    return `这里的${describeMatches(m)}非常适合您发挥特长，我强烈推荐您去试试。（匹配度 ${pct}%）`;
  }

  return `这座球场的风格与您的日常偏好有所不同，当作一次打卡体验也未尝不可。（匹配度 ${pct}%）`;
}

// ─── Scene ────────────────────────────────────────────────
const scene = new THREE.Scene();

// ─── Camera ───────────────────────────────────────────────
const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.01,
  200
);

// ─── Renderer ─────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
renderer.domElement.style.touchAction = "none";
document.body.appendChild(renderer.domElement);

// ─── Starfield ────────────────────────────────────────────
function createStarfield() {
  const count = 2000;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const r = 60 + Math.random() * 80;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);

    positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);

    const brightness = 0.6 + Math.random() * 0.4;
    colors[i * 3]     = brightness;
    colors[i * 3 + 1] = brightness;
    colors[i * 3 + 2] = brightness;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.PointsMaterial({
    size: 0.15,
    vertexColors: true,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  scene.add(new THREE.Points(geo, mat));
}

// ─── Lighting ─────────────────────────────────────────────
function createLighting() {
  const ambient = new THREE.AmbientLight(0x445577, 4.0);
  scene.add(ambient);

  const sun = new THREE.DirectionalLight(0xfff8e7, 3.5);
  sun.position.set(5, 2, 5);
  scene.add(sun);

  const fill = new THREE.DirectionalLight(0x445577, 1.2);
  fill.position.set(-3, -1, -4);
  scene.add(fill);

  return { sun };
}

// ─── Earth ────────────────────────────────────────────────
function createEarth() {
  const geo = new THREE.SphereGeometry(1, 128, 128);
  const mat = new THREE.MeshPhongMaterial({
    color: 0x224488,
    specular: 0x111122,
    shininess: 8,
  });
  const earth = new THREE.Mesh(geo, mat);
  scene.add(earth);

  const loader = new THREE.TextureLoader();
  loader.load(
    "https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg",
    (texture) => {
      texture.anisotropy = 16;
      texture.colorSpace = THREE.SRGBColorSpace;
      mat.map = texture;
      mat.color.set(0xffffff);
      mat.needsUpdate = true;
    },
    undefined,
    () => {
      mat.color.set(0x2255aa);
      mat.needsUpdate = true;
    }
  );

  return earth;
}

// ─── Atmosphere glow ──────────────────────────────────────
function createAtmosphere() {
  const geo = new THREE.SphereGeometry(1.015, 64, 64);
  const mat = new THREE.ShaderMaterial({
    vertexShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vPosition;
      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vPosition = worldPos.xyz;
        vNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vNormal;
      varying vec3 vPosition;
      void main() {
        vec3 viewDir = normalize(cameraPosition - vPosition);
        float fresnel = 1.0 - abs(dot(viewDir, vNormal));
        fresnel = pow(fresnel, 3.5);
        float alpha = fresnel * 0.25;
        gl_FragColor = vec4(0.3, 0.6, 1.0, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
  });
  const atmosphere = new THREE.Mesh(geo, mat);
  scene.add(atmosphere);
}

// ─── Coordinate utility ───────────────────────────────────
function latLngToVec3(lat, lng, radius) {
  const phi = THREE.MathUtils.degToRad(90 - lat);
  const theta = THREE.MathUtils.degToRad(lng + 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
     radius * Math.cos(phi),
     radius * Math.sin(phi) * Math.sin(theta)
  );
}

// ─── Glow texture factory ─────────────────────────────────
function createGlowTexture(r, g, b, alpha) {
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext("2d");
  const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${alpha})`);
  gradient.addColorStop(0.25, `rgba(${r}, ${g}, ${b}, ${alpha * 0.4})`);
  gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(canvas);
}

// ─── Markers ──────────────────────────────────────────────
const orangeTex = createGlowTexture(255, 170, 50, 0.75);
const cyanTex = createGlowTexture(0, 255, 220, 0.9);
let markerContainer;

function createMarkers(radius) {
  markerContainer = new THREE.Group();
  const dots = [];

  golfLocations.forEach((loc, i) => {
    const pos = latLngToVec3(loc.lat, loc.lng, radius * 1.006);
    const basePos = pos.clone();

    const geo = new THREE.SphereGeometry(0.0025, 8, 8);
    const dotMat = new THREE.MeshStandardMaterial({
      color: 0x222222,
      emissive: 0x000000,
      emissiveIntensity: 0,
      roughness: 0.5,
    });
    const dot = new THREE.Mesh(geo, dotMat);
    dot.userData = { index: i };
    dot.position.copy(pos);
    markerContainer.add(dot);

    const glowMat = new THREE.SpriteMaterial({
      map: orangeTex,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      transparent: true,
      opacity: 0.15,
    });
    const glow = new THREE.Sprite(glowMat);
    glow.position.copy(pos);
    glow.scale.set(0.022, 0.022, 1);
    markerContainer.add(glow);

    dots.push({ dot, glow, dotMat, glowMat, basePos, pillar: null, highlight: false });
  });

  scene.add(markerContainer);
  return dots;
}

// ─── Global scan after profile submission ─────────────────
function scanAllCourses() {
  markers.forEach((m, i) => {
    const loc = golfLocations[i];
    const { finalScore, isHighRisk } = calculateMatch(userProfile, loc);

    // Remove existing pillar if any
    if (m.pillar) {
      markerContainer.remove(m.pillar);
      m.pillar.geometry.dispose();
      m.pillar.material.dispose();
      m.pillar = null;
    }

    if (finalScore >= 65 && !isHighRisk) {
      // Highlight: yellow sphere + light pillar
      m.dotMat.color.set(0xffaa33);
      m.dotMat.emissive.set(0xffcc00);
      m.dotMat.emissiveIntensity = 1.2;
      m.glowMat.map = cyanTex;
      m.glowMat.opacity = 0.7;

      // Create light pillar
      const pillarGeo = new THREE.CylinderGeometry(0.0015, 0.003, 0.5, 8);
      const pillarMat = new THREE.MeshBasicMaterial({
        color: 0x00ffcc,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      });
      const pillar = new THREE.Mesh(pillarGeo, pillarMat);

      const normal = m.basePos.clone().normalize();
      const quat = new THREE.Quaternion().setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        normal
      );
      pillar.setRotationFromQuaternion(quat);
      pillar.position.copy(m.basePos).add(normal.multiplyScalar(0.25));
      pillar.userData = { index: i };

      markerContainer.add(pillar);
      m.pillar = pillar;
      m.highlight = true;
    } else {
      // Dim: slightly muted yellow
      m.dotMat.color.set(0x886622);
      m.dotMat.emissive.set(0x443300);
      m.dotMat.emissiveIntensity = 0.15;
      m.glowMat.map = orangeTex;
      m.glowMat.opacity = 0.25;
      m.highlight = false;
    }
  });
}

// ─── Build scene ──────────────────────────────────────────
createStarfield();
const { sun } = createLighting();
createEarth();
createAtmosphere();
const markerRadius = 1;
const markers = createMarkers(markerRadius);

// ─── Controls ─────────────────────────────────────────────
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.autoRotate = false;
controls.autoRotateSpeed = 0.35;
controls.minDistance = 1.05;
controls.maxDistance = 10;
controls.target.set(0, 0, 0);

const chinaDir = latLngToVec3(32, 108, 1);
camera.position.copy(chinaDir.multiplyScalar(3.2));
controls.update();

// ─── Mini 3D Clubhouse Scene ──────────────────────────────
const modelCanvas = document.getElementById("model-canvas");
const modelRenderer = new THREE.WebGLRenderer({ canvas: modelCanvas, antialias: true, alpha: true });
modelRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
modelRenderer.setClearColor(0x000000, 0);

const modelScene = new THREE.Scene();
const modelCamera = new THREE.PerspectiveCamera(45, 1, 0.1, 20);
modelCamera.position.set(3.5, 4.5, 5.0);
modelCamera.lookAt(0, -0.5, 0);

let lastModelW = 0;
let lastModelH = 0;

function updateModelRendererSize() {
  const w = modelCanvas.clientWidth;
  const h = modelCanvas.clientHeight;
  if (w > 0 && h > 0 && (w !== lastModelW || h !== lastModelH)) {
    modelRenderer.setSize(w, h);
    modelCamera.aspect = w / Math.max(h, 1);
    modelCamera.updateProjectionMatrix();
    lastModelW = w;
    lastModelH = h;
  }
}

modelScene.add(new THREE.AmbientLight(0xccccdd, 2.5));
const modelSun = new THREE.DirectionalLight(0xffffff, 5);
modelSun.position.set(3, 5, 4);
modelScene.add(modelSun);
const modelFill = new THREE.DirectionalLight(0x8899cc, 2);
modelFill.position.set(-2, 1, -3);
modelScene.add(modelFill);

// Load GLTF model
const modelGroup = new THREE.Group();
modelScene.add(modelGroup);

const loadingScreen = document.getElementById("loading-screen");
const loadingPercent = document.getElementById("loading-percent");
const loadingText = document.getElementById("loading-text");

const loader = new GLTFLoader();
loader.load(
  "./assets/golf_scene.glb",
  (gltf) => {
    const box = new THREE.Box3().setFromObject(gltf.scene);
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const targetSize = 6.0;
    const scale = targetSize / maxDim;

    gltf.scene.scale.setScalar(scale);
    const center = box.getCenter(new THREE.Vector3());
    gltf.scene.position.set(-center.x * scale, -center.y * scale + 0.35, -center.z * scale);

    modelGroup.add(gltf.scene);

    loadingText.textContent = "加载完成";
    loadingPercent.textContent = "100%";
    loadingScreen.classList.add("fade-out");
    setTimeout(() => {
      loadingScreen.style.display = "none";
    }, 700);
  },
  (xhr) => {
    if (xhr.total > 0) {
      const pct = Math.round((xhr.loaded / xhr.total) * 100);
      loadingPercent.textContent = pct + "%";
    }
  },
  () => {
    console.warn("Golf model failed to load, path:", "./assets/golf_scene.glb");
    loadingText.textContent = "加载失败";
    loadingPercent.textContent = "请刷新页面重试";
  }
);

// ─── Raycaster click interaction ───────────────────────────
const raycaster = new THREE.Raycaster();
raycaster.params.Points.threshold = 0.02;
const mouse = new THREE.Vector2();
const mouseDown = new THREE.Vector2();
const mouseUp = new THREE.Vector2();


const overlay = document.getElementById("overlay");
const cardTitle = document.getElementById("card-title");
const cardDesc = document.getElementById("card-desc");
const cardClose = document.getElementById("card-close");

const caddyText = document.getElementById("caddy-text");
const modelLabel = document.getElementById("model-label");

function hideOverlay() {
  overlay.classList.remove("visible");
}

cardClose.addEventListener("click", (e) => {
  e.stopPropagation();
  hideOverlay();
});

renderer.domElement.addEventListener("pointerdown", (e) => {
  mouseDown.set(e.clientX, e.clientY);
});

renderer.domElement.addEventListener("pointerup", (e) => {
  mouseUp.set(e.clientX, e.clientY);
  if (mouseDown.distanceTo(mouseUp) > 3) return;

  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const clickable = markers.flatMap(m => m.pillar ? [m.dot, m.pillar] : [m.dot]);
  const hits = raycaster.intersectObjects(clickable);

  if (hits.length > 0) {
    const idx = hits[0].object.userData.index;
    const loc = golfLocations[idx];
    cardTitle.textContent = loc.name + " · 高尔夫俱乐部";
    cardDesc.textContent = loc.description;
    modelLabel.textContent = loc.name + " · 高尔夫俱乐部";
    caddyText.textContent = getCaddyAdvice(loc);
    overlay.classList.add("visible");
    // Force model canvas resize on mobile layout switch
    requestAnimationFrame(() => requestAnimationFrame(updateModelRendererSize));
  } else {
    hideOverlay();
  }
});

// ─── Animation loop ───────────────────────────────────────
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const t = clock.getElapsedTime();

  markers.forEach((m, i) => {
    const pulse = 1 + Math.sin(t * 2.5 + i) * 0.04;

    if (m.highlight) {
      const s = pulse * 1.2;
      m.dot.scale.setScalar(s);
      m.glow.scale.set(0.026 * s, 0.026 * s, 1);

    } else {
      const s = pulse;
      m.dot.scale.setScalar(s);
      m.glow.scale.set(0.022 * s, 0.022 * s, 1);
    }
  });

  controls.update();
  sun.position.copy(camera.position);
  renderer.render(scene, camera);

  if (overlay.classList.contains("visible")) {
    updateModelRendererSize();
    modelGroup.rotation.y += 0.005;
    modelRenderer.render(modelScene, modelCamera);
  }
}

animate();

// ─── Touch hint adaptation ─────────────────────────────────
const hintEl = document.getElementById("hint");
const isTouchDevice = "ontouchstart" in window || navigator.maxTouchPoints > 0;
if (isTouchDevice) {
  hintEl.innerHTML = "👆 单指旋转 &nbsp;|&nbsp; 双指缩放 &nbsp;|&nbsp; 点击光点查看详情";
}

// ─── Resize handler ───────────────────────────────────────
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
