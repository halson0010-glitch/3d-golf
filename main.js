import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { golfLocations } from "./locations.js";

// ─── User Profile ─────────────────────────────────────────
let userProfile = null;

const profileModal = document.getElementById("profile-modal");
const profileSubmit = document.getElementById("profile-submit");
const profileReset = document.getElementById("profile-reset");
const locateNearby = document.getElementById("locate-nearby");
const overviewOpen = document.getElementById("overview-open");
const listPanel = document.getElementById("list-panel");
const listTitle = document.getElementById("list-title");
const listSubtitle = document.getElementById("list-subtitle");
const listContent = document.getElementById("list-content");
const listClose = document.getElementById("list-close");
const profileScore = document.getElementById("profile-score");
const profileDrive = document.getElementById("profile-drive");
const profileMiss = document.getElementById("profile-miss");
const profileGoal = document.getElementById("profile-goal");
const radioGroups = ["strategy", "terrain", "environment", "skill"];
let userLocation = null;

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

function collectProfile() {
  const nextProfile = {};
  radioGroups.forEach((name) => {
    const checked = document.querySelector(`input[name="${name}"]:checked`);
    nextProfile[name] = checked.value;
  });
  nextProfile.scoreRange = profileScore.value;
  nextProfile.driveDistance = profileDrive.value;
  nextProfile.missTendency = profileMiss.value;
  nextProfile.goal = profileGoal.value.trim() || "未填写";
  return nextProfile;
}

function showProfileModal({ reset = false } = {}) {
  hideOverlay();
  if (reset) {
    userProfile = null;
    document.querySelectorAll("#profile-questions input[type=radio]").forEach((radio) => {
      radio.checked = false;
    });
    profileScore.value = "未填写";
    profileDrive.value = "未填写";
    profileMiss.value = "未填写";
    profileGoal.value = "";
    profileSubmit.disabled = true;
  }
  profileSubmit.textContent = userProfile ? "更新专属数字球童" : "生成专属数字球童";
  profileModal.classList.remove("hidden");
}

profileSubmit.addEventListener("click", () => {
  userProfile = collectProfile();
  profileModal.classList.add("hidden");
  scanAllCourses();
  if (userLocation) renderCourseList("nearby");
});

profileReset.addEventListener("click", () => {
  showProfileModal({ reset: true });
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

function distanceKm(a, b) {
  const toRad = THREE.MathUtils.degToRad;
  const earthRadiusKm = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function getCourseDistance(loc) {
  if (!userLocation) return null;
  return distanceKm(userLocation, loc);
}

function formatDistance(km) {
  if (km === null) return "";
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

function getProfileSummary() {
  if (!userProfile) return "尚未建立档案";
  return [
    userProfile.strategy,
    userProfile.terrain,
    userProfile.environment,
    userProfile.skill,
    userProfile.scoreRange !== "未填写" ? `平均${userProfile.scoreRange}` : null,
    userProfile.driveDistance !== "未填写" ? `开球${userProfile.driveDistance}` : null,
    userProfile.missTendency !== "未填写" ? `常见失误：${userProfile.missTendency}` : null,
    userProfile.goal !== "未填写" ? `目标：${userProfile.goal}` : null,
  ].filter(Boolean).join("，");
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
function getCaddyAdvice(loc, mode = "strategy", note = "") {
  if (!userProfile) return "请先完成您的专属高尔夫档案，我将为您提供个性化建议~";

  const m = calculateMatch(userProfile, loc);
  const pct = m.finalScore;
  const distance = formatDistance(getCourseDistance(loc));
  const distanceText = distance ? `距离你约 ${distance}，` : "";
  const miss = userProfile.missTendency !== "未填写" ? userProfile.missTendency : "主要失误";
  const drive = userProfile.driveDistance !== "未填写" ? userProfile.driveDistance : "常规开球距离";
  const goal = userProfile.goal !== "未填写" ? userProfile.goal : "稳定完赛";
  const noteText = note ? `你补充的现场信息是：${note}。` : "";

  if (m.isHighRisk) {
    return `风险提醒：${distanceText}${loc.name} 标定为「${m.t.skill}」，高于你当前「${userProfile.skill}」档案。建议优先选择保守落点，开球避免硬拼距离，短杆和补救杆要提前预留容错。${noteText}匹配度：${pct}%`;
  }

  if (mode === "club") {
    return `选杆建议：你的开球档案是「${drive}」，在「${loc.tags.terrain}」球场不必每洞都追求一号木满挥。长洞先找安全球道，遇到水障或沙坑密集区域，用更稳定的球杆把球放到可攻果岭距离。${noteText}匹配度：${pct}%`;
  }

  if (mode === "training") {
    return `训练计划：围绕「${goal}」，赛前重点练三项：开球落点控制、${miss}修正、50码内短杆落点。这个球场的核心标签是「${describeMatches(m)}」，练习时把安全区和惩罚区想清楚，比单纯追距离更有价值。`;
  }

  if (mode === "routine") {
    return `赛前清单：确认天气和风向，热身顺序从肩背、髋部到半挥杆；前3洞按七成力量进入节奏。你当前目标是「${goal}」，所以第一优先级是少丢球，其次才是进攻旗杆。${distanceText}建议提前预留交通和练习果岭时间。`;
  }

  if (pct >= 85) {
    return `球场攻略：${distanceText}这里的「${m.t.terrain}」和你的档案高度契合。开局可以积极一些，但每次进攻前先确认落点后的第二杆角度；如果出现${miss}，立即切换到保守线，避免连续丢杆。匹配度：${pct}%`;
  }

  if (pct >= 65) {
    return `球场攻略：${distanceText}这里的${describeMatches(m)}适合你发挥，但不要把每个洞都打成进攻洞。建议用「安全落点优先、果岭前沿可接受」的策略，稳住节奏后再挑选短四杆洞或顺风洞进攻。匹配度：${pct}%`;
  }

  return `球场攻略：${distanceText}这座球场和你的日常偏好不完全一致，更适合作为体验局。建议降低进攻预期，优先把球放回球道，遇到不熟悉地形时宁可多打一杆，也不要挑战低成功率线路。匹配度：${pct}%`;
}

// ─── Local LLM Caddy ───────────────────────────────────────
const CADDY_API_BASE = "http://localhost:11434/v1";
const CADDY_MODEL_KEY = "golf-caddy-model";
const DEFAULT_CADDY_MODEL = "qwen3:8b";
let detectedCaddyModel = null;
let modelDetectionStarted = false;

async function resolveCaddyModel() {
  if (detectedCaddyModel !== null) return detectedCaddyModel;
  if (modelDetectionStarted) return null;

  modelDetectionStarted = true;
  try {
    const preferred = localStorage.getItem(CADDY_MODEL_KEY) || DEFAULT_CADDY_MODEL;
    const res = await fetch(`${CADDY_API_BASE}/models`);
    if (!res.ok) throw new Error(`Model list failed: ${res.status}`);

    const body = await res.json();
    const models = Array.isArray(body.data) ? body.data.map((m) => m.id).filter(Boolean) : [];
    detectedCaddyModel = models.includes(preferred) ? preferred : models[0] || null;
    return detectedCaddyModel;
  } catch {
    detectedCaddyModel = null;
    return null;
  } finally {
    modelDetectionStarted = false;
  }
}

function buildCaddyPrompt(loc, mode, note) {
  const m = calculateMatch(userProfile, loc);
  const taskMap = {
    strategy: "球场攻略和路线管理",
    club: "选杆、距离控制和落点选择",
    training: "赛前训练计划和弱点修正",
    routine: "赛前准备、热身、节奏和注意事项",
  };
  return [
    "你是一个现实球场里的专业中文高尔夫球童。你需要像真人球童一样，结合球员能力、常见失误、目标、球场地形和距离，给出具体而可执行的建议。",
    "不要只说推荐或不推荐。必须体现个人定制化。",
    `本次任务：${taskMap[mode] || taskMap.strategy}`,
    "输出 120-180 字，分成 3 段：1.判断 2.打法/训练/选杆 3.风险提醒。不要编造不存在的球洞编号、价格、电话或天气。",
    "",
    `用户档案：${JSON.stringify(userProfile)}。档案摘要：${getProfileSummary()}`,
    `球场信息：${JSON.stringify(loc)}`,
    `用户位置距离：${formatDistance(getCourseDistance(loc)) || "未知"}`,
    `用户现场补充：${note || "无"}`,
    `匹配结果：${JSON.stringify({
      score: m.finalScore,
      highRisk: m.isHighRisk,
      matched: {
        terrain: m.terrainMatch,
        strategy: m.strategyMatch,
        environment: m.environmentMatch,
      },
    })}`,
  ].join("\n");
}

async function getCaddyAdviceFromLLM(loc, mode = "strategy", note = "") {
  const fallback = getCaddyAdvice(loc, mode, note);
  const model = await resolveCaddyModel();

  if (!model) {
    return `${fallback}\n\n本地球童已启用基础模式。安装模型后会自动升级为大模型建议。`;
  }

  try {
    const res = await fetch(`${CADDY_API_BASE}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        temperature: 0.72,
        max_tokens: 420,
        messages: [
          { role: "system", content: "你只输出中文高尔夫球童建议，不输出推理过程。语气专业、具体、像真人球童，不要泛泛而谈。" },
          { role: "user", content: buildCaddyPrompt(loc, mode, note) },
        ],
      }),
    });

    if (!res.ok) throw new Error(`Caddy request failed: ${res.status}`);
    const body = await res.json();
    const content = body?.choices?.[0]?.message?.content?.trim();
    return content || fallback;
  } catch {
    return `${fallback}\n\n本地大模型暂时未响应，已切换基础建议。`;
  }
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
  if (!userProfile) return;
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

function getRankedCourses(mode) {
  return golfLocations.map((loc, index) => {
    const match = userProfile ? calculateMatch(userProfile, loc).finalScore : 0;
    const distance = getCourseDistance(loc);
    const distanceBoost = distance === null ? 0 : Math.max(0, 120 - distance) / 2;
    return { loc, index, match, distance, score: match + distanceBoost };
  }).sort((a, b) => {
    if (mode === "nearby" && a.distance !== null && b.distance !== null) return a.distance - b.distance;
    if (mode === "recommend") return b.score - a.score;
    return b.match - a.match || a.loc.name.localeCompare(b.loc.name, "zh-Hans-CN");
  });
}

function renderCourseList(mode = "overview") {
  const ranked = getRankedCourses(mode);
  const nearby = mode === "nearby";
  const title = nearby ? "附近高尔夫球场" : "中国高尔夫球场全览";
  const subtitle = nearby
    ? (userLocation ? `已按当前位置由近到远排序，共 ${ranked.length} 座球场。` : "定位后会按距离优先推荐。")
    : `收录 ${ranked.length} 座中国高尔夫球场，可按个人档案查看匹配度。`;

  listTitle.textContent = title;
  listSubtitle.textContent = subtitle;
  listContent.innerHTML = ranked.map(({ loc, index, match, distance }) => {
    const distanceText = formatDistance(distance);
    const badge = nearby && distanceText ? distanceText : (userProfile ? `${match}%` : "查看");
    return `
      <button class="course-row" type="button" data-course-index="${index}">
        <span class="course-row-title">
          <strong>${loc.name}</strong>
          <span>${badge}</span>
        </span>
        <p class="course-row-desc">${loc.description}</p>
        <span class="course-row-tags">
          <span>${loc.tags.strategy}</span>
          <span>${loc.tags.terrain}</span>
          <span>${loc.tags.environment}</span>
          <span>${loc.tags.skill}</span>
        </span>
      </button>
    `;
  }).join("") || `<p class="list-empty">暂无可展示球场。</p>`;

  listPanel.classList.add("visible");
  listPanel.setAttribute("aria-hidden", "false");
}

function showLocationStatus(text) {
  listTitle.textContent = "附近高尔夫球场";
  listSubtitle.textContent = text;
  listContent.innerHTML = `<p class="list-empty">${text}</p>`;
  listPanel.classList.add("visible");
  listPanel.setAttribute("aria-hidden", "false");
}

function requestNearbyCourses() {
  if (!navigator.geolocation) {
    showLocationStatus("当前浏览器不支持定位，可以先查看中国球场全览。");
    return;
  }

  showLocationStatus("正在获取当前位置，请在浏览器提示中允许定位。");
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      userLocation = {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
      };
      renderCourseList("nearby");
      const nearest = getRankedCourses("nearby")[0];
      if (nearest) flyToCourse(nearest.index, 1.7);
    },
    () => {
      showLocationStatus("定位未成功。你仍然可以通过全览查看球场，或检查浏览器定位权限后再试。");
    },
    { enableHighAccuracy: true, timeout: 9000, maximumAge: 300000 }
  );
}

overviewOpen.addEventListener("click", () => renderCourseList("overview"));
locateNearby.addEventListener("click", requestNearbyCourses);
listClose.addEventListener("click", () => {
  listPanel.classList.remove("visible");
  listPanel.setAttribute("aria-hidden", "true");
});
listContent.addEventListener("click", (e) => {
  const row = e.target.closest("[data-course-index]");
  if (!row) return;
  const idx = Number(row.dataset.courseIndex);
  openCourse(idx, { fly: true });
});

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
controls.dampingFactor = 0.06;
controls.rotateSpeed = 0.22;
controls.zoomSpeed = 0.45;
controls.panSpeed = 0.35;
controls.autoRotate = false;
controls.autoRotateSpeed = 0.35;
controls.enablePan = false;
controls.minDistance = 1.18;
controls.maxDistance = 10;
controls.target.set(0, 0, 0);

const chinaDir = latLngToVec3(32, 108, 1);
camera.position.copy(chinaDir.multiplyScalar(3.2));
controls.update();

let earthCameraTween = null;

function flyToCourse(index, distance = 1.55) {
  const marker = markers[index];
  if (!marker) return;

  const normal = marker.basePos.clone().normalize();
  earthCameraTween = {
    startTime: performance.now(),
    duration: 760,
    fromPosition: camera.position.clone(),
    toPosition: normal.multiplyScalar(distance),
  };
  controls.enabled = false;
}

function updateEarthCameraTween() {
  if (!earthCameraTween) return;

  const p = Math.min((performance.now() - earthCameraTween.startTime) / earthCameraTween.duration, 1);
  const t = easeOutCubic(p);
  camera.position.lerpVectors(earthCameraTween.fromPosition, earthCameraTween.toPosition, t);
  controls.target.set(0, 0, 0);
  controls.update();

  if (p >= 1) {
    earthCameraTween = null;
    controls.enabled = true;
  }
}

// ─── Mini 3D Clubhouse Scene ──────────────────────────────
const modelCanvas = document.getElementById("model-canvas");
const modelRotateToggle = document.getElementById("model-rotate-toggle");
const modelRotateSpeed = document.getElementById("model-rotate-speed");
const photoDetail = document.getElementById("photo-detail");
const photoDetailImage = document.getElementById("photo-detail-image");
const photoDetailTitle = document.getElementById("photo-detail-title");
const photoDetailMeta = document.getElementById("photo-detail-meta");
const photoDetailClose = document.getElementById("photo-detail-close");
const modelRenderer = new THREE.WebGLRenderer({
  canvas: modelCanvas,
  antialias: true,
  alpha: true,
  preserveDrawingBuffer: true,
});
modelRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
modelRenderer.setClearColor(0x000000, 0);

const modelScene = new THREE.Scene();
const modelCamera = new THREE.PerspectiveCamera(45, 1, 0.1, 20);
modelCamera.position.set(3.5, 4.5, 5.0);
modelCamera.lookAt(0, -0.5, 0);

const modelControls = new OrbitControls(modelCamera, modelCanvas);
modelControls.enableDamping = true;
modelControls.dampingFactor = 0.08;
modelControls.enableRotate = false;
modelControls.rotateSpeed = Number(modelRotateSpeed.value);
modelControls.zoomSpeed = 0.65;
modelControls.panSpeed = 0.45;
modelControls.minDistance = 0.75;
modelControls.maxDistance = 8;
modelControls.mouseButtons.LEFT = THREE.MOUSE.PAN;
modelControls.touches.ONE = THREE.TOUCH.PAN;
modelControls.target.set(0, -0.45, 0);
modelControls.update();

let modelRotationEnabled = false;
let modelIsDragging = false;

function syncModelRotationMode() {
  modelControls.enableRotate = modelRotationEnabled;
  modelControls.mouseButtons.LEFT = modelRotationEnabled ? THREE.MOUSE.ROTATE : THREE.MOUSE.PAN;
  modelControls.touches.ONE = modelRotationEnabled ? THREE.TOUCH.ROTATE : THREE.TOUCH.PAN;
  modelRotateToggle.textContent = modelRotationEnabled ? "旋转模式：开" : "旋转模式：关";
  modelRotateToggle.classList.toggle("active", modelRotationEnabled);
}

modelRotateToggle.addEventListener("click", () => {
  modelRotationEnabled = !modelRotationEnabled;
  syncModelRotationMode();
});

modelRotateSpeed.addEventListener("input", () => {
  modelControls.rotateSpeed = Number(modelRotateSpeed.value);
});

syncModelRotationMode();

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
      const pct = Math.min(99, Math.round((xhr.loaded / xhr.total) * 100));
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
const modelRaycaster = new THREE.Raycaster();
const modelMouse = new THREE.Vector2();
const modelMouseDown = new THREE.Vector2();
const modelMouseUp = new THREE.Vector2();
let lastModelFocusPoint = null;
let modelZoomStep = 0;
let modelCameraTween = null;
let caddyRequestId = 0;


const overlay = document.getElementById("overlay");
const cardTitle = document.getElementById("card-title");
const cardDesc = document.getElementById("card-desc");
const cardClose = document.getElementById("card-close");

const caddyText = document.getElementById("caddy-text");
const caddyBubble = document.getElementById("caddy-bubble");
const modelLabel = document.getElementById("model-label");
const caddyModeButtons = document.querySelectorAll(".caddy-mode");
const caddyNote = document.getElementById("caddy-note");
const caddyAsk = document.getElementById("caddy-ask");
let selectedCourseIndex = null;
let selectedCaddyMode = "strategy";
let photoDetailVisible = false;

function hideOverlay() {
  caddyRequestId += 1;
  hidePhotoDetail();
  selectedCourseIndex = null;
  overlay.classList.remove("visible");
}

function easeOutCubic(p) {
  return 1 - Math.pow(1 - p, 3);
}

function focusModelAtPoint(point) {
  const distances = [4.6, 2.35, 1.05];
  const sameArea = lastModelFocusPoint && lastModelFocusPoint.distanceTo(point) < 2.4;
  modelZoomStep = sameArea ? Math.min(modelZoomStep + 1, distances.length - 1) : 0;
  lastModelFocusPoint = point.clone();

  const currentOffset = modelCamera.position.clone().sub(modelControls.target);
  const direction = currentOffset.lengthSq() > 0.0001
    ? currentOffset.normalize()
    : new THREE.Vector3(0.55, 0.6, 0.55).normalize();

  modelCameraTween = {
    startTime: performance.now(),
    duration: 680,
    fromPosition: modelCamera.position.clone(),
    fromTarget: modelControls.target.clone(),
    toPosition: point.clone().add(direction.multiplyScalar(distances[modelZoomStep])),
    toTarget: point.clone(),
    revealPhoto: modelZoomStep === distances.length - 1,
  };
}

function updateModelCameraTween() {
  if (!modelCameraTween) return;

  const elapsed = performance.now() - modelCameraTween.startTime;
  const p = Math.min(elapsed / modelCameraTween.duration, 1);
  const t = easeOutCubic(p);

  modelCamera.position.lerpVectors(modelCameraTween.fromPosition, modelCameraTween.toPosition, t);
  modelControls.target.lerpVectors(modelCameraTween.fromTarget, modelCameraTween.toTarget, t);

  if (p >= 1) {
    const shouldRevealPhoto = modelCameraTween.revealPhoto;
    modelCameraTween = null;
    if (shouldRevealPhoto) showPhotoDetail();
  }
}

function createFallbackPhoto(loc) {
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 760;
  const ctx = canvas.getContext("2d");
  const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
  sky.addColorStop(0, "#c7e4f2");
  sky.addColorStop(0.38, "#7fb2a4");
  sky.addColorStop(1, "#315f33");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.translate(canvas.width * 0.5, canvas.height * 0.62);
  ctx.rotate(-0.16);
  ctx.fillStyle = "#6fb55b";
  ctx.beginPath();
  ctx.ellipse(0, 0, 560, 210, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#93cf79";
  for (let i = 0; i < 7; i++) {
    ctx.beginPath();
    ctx.ellipse(-470 + i * 160, Math.sin(i) * 42, 120, 42, Math.sin(i) * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "#345d86";
  ctx.beginPath();
  ctx.ellipse(230, 35, 145, 54, 0.22, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#e6d8a8";
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.ellipse(-330 + i * 150, 70 + Math.sin(i) * 32, 52, 22, i * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  const vignette = ctx.createRadialGradient(600, 380, 120, 600, 380, 760);
  vignette.addColorStop(0, "rgba(255,255,255,0)");
  vignette.addColorStop(1, "rgba(0,0,0,0.34)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.font = "700 38px Microsoft YaHei, sans-serif";
  ctx.fillText(loc.name, 44, 72);
  ctx.font = "24px Microsoft YaHei, sans-serif";
  ctx.fillText(`${loc.tags.terrain} · ${loc.tags.skill}`, 44, 112);
  return canvas.toDataURL("image/png");
}

function showPhotoDetail() {
  if (selectedCourseIndex === null) return;
  const loc = golfLocations[selectedCourseIndex];

  let src = "";
  try {
    modelControls.update();
    modelRenderer.render(modelScene, modelCamera);
    src = modelCanvas.toDataURL("image/png");
  } catch {
    src = createFallbackPhoto(loc);
  }

  photoDetailImage.src = src || createFallbackPhoto(loc);
  photoDetailTitle.textContent = `${loc.name} · 实景细节`;
  photoDetailMeta.textContent = "点击返回 3D 后，可继续在模型中选择新的落点推进。";
  photoDetail.classList.add("visible");
  photoDetail.setAttribute("aria-hidden", "false");
  photoDetailVisible = true;
  modelControls.enabled = false;
}

function hidePhotoDetail() {
  if (!photoDetail) return;
  photoDetail.classList.remove("visible");
  photoDetail.setAttribute("aria-hidden", "true");
  photoDetailVisible = false;
  if (modelControls) modelControls.enabled = true;
}

function getCourseDescription(loc) {
  const parts = [loc.description];
  if (userProfile) {
    const match = calculateMatch(userProfile, loc);
    parts.push(`匹配度 ${match.finalScore}%，难度 ${loc.tags.skill}，核心风格：${loc.tags.strategy} / ${loc.tags.terrain} / ${loc.tags.environment}。`);
  }
  const distance = formatDistance(getCourseDistance(loc));
  if (distance) parts.push(`当前位置距离约 ${distance}。`);
  return parts.join(" ");
}

function refreshCaddyAdvice() {
  if (selectedCourseIndex === null) return;

  const loc = golfLocations[selectedCourseIndex];
  const note = caddyNote.value.trim();
  const requestId = ++caddyRequestId;
  caddyText.textContent = "数字球童正在结合档案、球场、距离与现场补充重新分析...";
  caddyBubble.scrollTop = 0;

  getCaddyAdviceFromLLM(loc, selectedCaddyMode, note).then((advice) => {
    if (requestId === caddyRequestId) {
      caddyText.textContent = advice;
      requestAnimationFrame(() => {
        caddyBubble.scrollTop = 0;
      });
    }
  });
}

function openCourse(index, options = {}) {
  const loc = golfLocations[index];
  if (!loc) return;

  selectedCourseIndex = index;
  selectedCaddyMode = "strategy";
  caddyModeButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.caddyMode === selectedCaddyMode);
  });
  hidePhotoDetail();
  lastModelFocusPoint = null;
  modelZoomStep = 0;
  modelCameraTween = null;

  cardTitle.textContent = loc.name + " · 高尔夫俱乐部";
  cardDesc.textContent = getCourseDescription(loc);
  modelLabel.textContent = loc.name + " · 高尔夫俱乐部";
  listPanel.classList.remove("visible");
  listPanel.setAttribute("aria-hidden", "true");
  overlay.classList.add("visible");

  if (options.fly) flyToCourse(index, options.distance || 1.55);
  refreshCaddyAdvice();
  requestAnimationFrame(() => requestAnimationFrame(updateModelRendererSize));
}

caddyModeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    selectedCaddyMode = button.dataset.caddyMode;
    caddyModeButtons.forEach((item) => item.classList.toggle("active", item === button));
    refreshCaddyAdvice();
  });
});

caddyAsk.addEventListener("click", refreshCaddyAdvice);

cardClose.addEventListener("click", (e) => {
  e.stopPropagation();
  hideOverlay();
});

photoDetailClose.addEventListener("click", (e) => {
  e.stopPropagation();
  hidePhotoDetail();
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
    openCourse(idx);
  } else {
    hideOverlay();
  }
});

modelCanvas.addEventListener("pointerdown", (e) => {
  modelMouseDown.set(e.clientX, e.clientY);
  modelIsDragging = true;
});

modelCanvas.addEventListener("pointerup", (e) => {
  modelIsDragging = false;
  if (photoDetailVisible) return;
  modelMouseUp.set(e.clientX, e.clientY);
  if (modelMouseDown.distanceTo(modelMouseUp) > 4) return;

  const rect = modelCanvas.getBoundingClientRect();
  modelMouse.x = ((e.clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1;
  modelMouse.y = -((e.clientY - rect.top) / Math.max(rect.height, 1)) * 2 + 1;

  modelRaycaster.setFromCamera(modelMouse, modelCamera);
  const hits = modelRaycaster.intersectObjects(modelGroup.children, true);
  if (hits.length > 0) focusModelAtPoint(hits[0].point);
});

modelCanvas.addEventListener("pointercancel", () => {
  modelIsDragging = false;
});

modelCanvas.addEventListener("pointerleave", () => {
  modelIsDragging = false;
});

// ─── Animation loop ───────────────────────────────────────
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const dt = clock.getDelta();
  const t = clock.elapsedTime;

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

  updateEarthCameraTween();
  if (!earthCameraTween) controls.update();
  sun.position.copy(camera.position);
  renderer.render(scene, camera);

  if (overlay.classList.contains("visible")) {
    updateModelRendererSize();
    updateModelCameraTween();
    modelControls.update();
    if (modelRotationEnabled && !modelIsDragging && !photoDetailVisible) {
      modelGroup.rotation.y += dt * Number(modelRotateSpeed.value);
    }
    modelRenderer.render(modelScene, modelCamera);
  }
}

animate();

// ─── Touch hint adaptation ─────────────────────────────────
const hintEl = document.getElementById("hint");
const isTouchDevice = "ontouchstart" in window || navigator.maxTouchPoints > 0;
if (isTouchDevice) {
  hintEl.innerHTML = "单指浏览 &nbsp;|&nbsp; 双指缩放 &nbsp;|&nbsp; 点击光点查看详情";
}

// ─── Resize handler ───────────────────────────────────────
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
