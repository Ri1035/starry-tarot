/* ============================================================
 * 3D 牌桌 · 场景 + 卡牌系统（P1-P4）
 *
 * P1 场景：WebGL 渲染器 / 相机 / 灯光 / 圆桌 / 星空粒子 / OrbitControls
 * P2 卡牌：webp 贴图 Mesh（背面用 Canvas 纹理）、悬停浮起、3D 翻牌动画
 * P3 牌阵：spreads3d.js 坐标 → 卡牌飞入桌面卡位
 * P4 流程：飞牌(洗牌视觉) → 点击翻牌 → 全部翻开后通知 app.js 出解读
 *
 * Three.js 走 CDN ESM + importmap；模块通过 window.Tarot3D 暴露给
 * app.js（经典脚本）。事件契约：
 *   app.js → 窗口事件 'tarot:draw3d'   detail { spread, draw }
 *   app.js → window.Tarot3D.flipAll()  全部翻开
 *   table3d → 窗口事件 'tarot:flip3d'  每翻开一张
 *   table3d → 窗口事件 'tarot:use2d'   WebGL 不可用时引导回 2D
 *
 * 资源管理：所有 geometry/material/texture 在 unmount 时统一释放，
 * 避免切换视图导致内存泄漏。
 * ============================================================ */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { getSpreadPositions3d } from './spreads3d.js';

const CFG = {
  tableRadius: 5.0,
  tableThickness: 0.34,
  starCount: 520,
  starInner: 10,
  starOuter: 24,
  cardW: 1.4,
  cardH: 2.35,
  cardY: 0.03,
  flipDur: 0.7,       // 翻牌动画时长（秒）
  flipLift: 0.95,     // 翻牌过程抬起高度
  dealDur: 0.6,       // 单张飞牌时长
  dealGap: 0.09,      // 相邻飞牌延迟
  dealHeight: 3.1,    // 飞牌起点高度
  deckX: 0,
  deckZ: 4.4,         // 牌堆位置（相机前方）
  hoverLift: 0.22     // 悬停浮起高度
};

/* ---------- 模块状态（单例） ---------- */
let renderer = null;
let scene = null;
let camera = null;
let controls = null;
let starPoints = null;
let container = null;
let ro = null;
let rafId = 0;
let clock = null;
let disposed = true;

const cards = [];            // 桌面上的牌 [{group, frontMesh, backMesh, index, slot, ...}]
const anims = [];            // 进行中的动画
let hoverCard = null;        // 当前悬停的牌
let hoverTarget = 0;         // 悬停目标高度
let raycaster = null;
let ndc = null;
let dragging = false;
let pointerDown = null;

// 贴图缓存与共享资源
let planeGeo = null;
let backMat = null;
let frontTexCache = new Map();

/** WebGL 能力检测（含老内核 experimental-webgl） */
function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl') || c.getContext('experimental-webgl'));
  } catch (e) {
    return false;
  }
}

/* ---------- 场景构建 ---------- */
function createRenderer() {
  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,        // 透明背景，让页面星空/星云透过
    powerPreference: 'high-performance'
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.className = 't3d-canvas';
}

function createCamera() {
  camera = new THREE.PerspectiveCamera(
    42,
    container.clientWidth / container.clientHeight,
    0.1, 60
  );
  camera.position.set(0, 8.2, 9.6);
  camera.lookAt(0, 0, 0);
}

function createLights() {
  // three r155+ 默认物理光照模式（useLegacyLights=false），
  // 光照强度需按 candela 量级给值，否则场景欠曝。
  scene.add(new THREE.AmbientLight(0x3a2a66, 1.1));
  const key = new THREE.SpotLight(0xe8c56b, 210, 0, Math.PI / 5, 0.5);
  key.position.set(0, 12, 2);
  key.target.position.set(0, 0, 0);
  scene.add(key);
  scene.add(key.target);
  const violet = new THREE.PointLight(0x8b6cf0, 60, 26, 1.4);
  violet.position.set(-7, 5, -7);
  scene.add(violet);
}

function createTable() {
  const topGeo = new THREE.CylinderGeometry(
    CFG.tableRadius, CFG.tableRadius * 0.985, CFG.tableThickness, 72
  );
  const topMat = new THREE.MeshStandardMaterial({ color: 0x15092c, roughness: 0.82, metalness: 0.12 });
  const top = new THREE.Mesh(topGeo, topMat);
  top.position.y = -CFG.tableThickness / 2;
  scene.add(top);

  const ringGeo = new THREE.TorusGeometry(CFG.tableRadius + 0.05, 0.09, 12, 96);
  const ringMat = new THREE.MeshStandardMaterial({
    color: 0xe8c56b, emissive: 0x8a5a12, emissiveIntensity: 0.4,
    roughness: 0.35, metalness: 0.6
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.02;
  scene.add(ring);
}

function createStars() {
  const count = CFG.starCount;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const palette = [new THREE.Color(0xf5dfa0), new THREE.Color(0xe6dcff), new THREE.Color(0x8b6cf0)];
  const tmp = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const r = CFG.starInner + Math.random() * (CFG.starOuter - CFG.starInner);
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.cos(phi);
    positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    tmp.copy(palette[(Math.random() * palette.length) | 0]).multiplyScalar(0.55 + Math.random() * 0.45);
    colors[i * 3] = tmp.r;
    colors[i * 3 + 1] = tmp.g;
    colors[i * 3 + 2] = tmp.b;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.11, vertexColors: true, transparent: true, opacity: 0.95,
    depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true
  });
  starPoints = new THREE.Points(geo, mat);
  scene.add(starPoints);
}

function createControls() {
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.minDistance = 4;
  controls.maxDistance = 18;
  controls.minPolarAngle = 0.15;
  controls.maxPolarAngle = Math.PI / 2 - 0.06;
  controls.target.set(0, 0, 0);
}

/* ---------- 卡牌资源（共享，避免重复创建） ---------- */
function ensureCardShared() {
  if (planeGeo) return;
  planeGeo = new THREE.PlaneGeometry(CFG.cardW, CFG.cardH);

  const c = document.createElement('canvas');
  c.width = 128; c.height = 224;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, c.height);
  grad.addColorStop(0, '#4a2f7e');
  grad.addColorStop(0.5, '#2b1950');
  grad.addColorStop(1, '#3a2560');
  g.fillStyle = grad;
  g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = 'rgba(240,205,130,0.95)';
  g.lineWidth = 5;
  g.strokeRect(3, 3, c.width - 6, c.height - 6);
  g.strokeStyle = 'rgba(240,205,130,0.45)';
  g.lineWidth = 1.5;
  g.strokeRect(8, 8, c.width - 16, c.height - 16);
  for (let i = 0; i < 42; i++) {
    g.fillStyle = 'rgba(240,228,255,' + (Math.random() * 0.6 + 0.3) + ')';
    g.beginPath();
    g.arc(Math.random() * c.width, Math.random() * c.height, Math.random() * 1.2 + 0.3, 0, Math.PI * 2);
    g.fill();
  }
  g.strokeStyle = 'rgba(232,197,107,0.75)';
  g.lineWidth = 1.5;
  g.beginPath(); g.arc(c.width / 2, c.height / 2, 16, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.arc(c.width / 2, c.height / 2, 9, 0, Math.PI * 2); g.stroke();
  g.fillStyle = 'rgba(250,230,170,0.95)';
  g.beginPath(); g.arc(c.width / 2 - 3, c.height / 2 - 2, 4, 0, Math.PI * 2); g.fill();

  const backTex = new THREE.CanvasTexture(c);
  backTex.colorSpace = THREE.SRGBColorSpace;
  backMat = new THREE.MeshStandardMaterial({
    map: backTex, roughness: 0.75, metalness: 0.08,
    emissive: 0x2a1650, emissiveIntensity: 0.7   // 微自发光，让卡牌从桌面浮现
  });
}

function getFrontTexture(img) {
  let t = frontTexCache.get(img);
  if (t) return t;
  t = new THREE.TextureLoader().load('assets/cards/' + img);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  frontTexCache.set(img, t);
  return t;
}

/* ---------- 牌阵落牌 ---------- */
function placeCards(spread, draw) {
  clearCards();
  ensureCardShared();
  const slots = getSpreadPositions3d(spread);

  draw.forEach((d, i) => {
    const s = slots[i] || { x: 0, z: 0, y: CFG.cardY, rotY: 0 };
    const group = new THREE.Group();

    // 背面（初始朝上）：normal +y
    const backMesh = new THREE.Mesh(planeGeo, backMat);
    backMesh.position.y = 0.002;
    // 正面（初始朝下）：normal -y；最终 group 翻转后朝上
    const frontMat = new THREE.MeshStandardMaterial({
      map: getFrontTexture(d.card.img),
      roughness: 0.6,
      metalness: 0.08
    });
    const frontMesh = new THREE.Mesh(planeGeo, frontMat);
    frontMesh.rotation.x = Math.PI;
    frontMesh.position.y = -0.002;
    // 逆位：翻开后整张 180° 倒置
    if (d.orientation === 'reversed') frontMesh.rotation.z = Math.PI;

    group.add(backMesh);
    group.add(frontMesh);

    const card = {
      group,
      frontMesh,
      index: i,
      slot: { x: s.x, z: s.z, y: s.y !== undefined ? s.y : CFG.cardY, rotY: s.rotY || 0 },
      flipped: false,
      dealt: false,
      hoverY: 0
    };

    // 从牌堆飞向卡位（背面朝上）
    group.position.set(CFG.deckX, CFG.dealHeight, CFG.deckZ);
    group.rotation.x = -Math.PI / 2;   // 背面（法线 +Z）朝上
    group.rotation.y = (Math.random() * 6 - 3) * (Math.PI / 180);

    scene.add(group);
    cards.push(card);
    anims.push({
      kind: 'deal', card,
      dur: CFG.dealDur, delay: i * CFG.dealGap, t: 0,
      from: { x: group.position.x, y: group.position.y, z: group.position.z, ry: group.rotation.y },
      to: { x: card.slot.x, y: card.slot.y, z: card.slot.z, ry: card.slot.rotY }
    });
  });
}

function clearCards() {
  for (const c of cards) {
    scene.remove(c.group);
    c.frontMesh.material.dispose(); // 正位贴图材质按牌释放；背图材质为共享资源
  }
  cards.length = 0;
  hoverCard = null;
  hoverTarget = 0;
}

/* ---------- 翻牌 ---------- */
function flipCard(card) {
  if (!card || card.flipped || !card.dealt) return;
  card.flipped = true;
  anims.push({ kind: 'flip', card, dur: CFG.flipDur, delay: 0, t: 0 });
}

/** 全部翻开（逐张交错延迟） */
function flipAllCards() {
  cards.forEach((c, i) => {
    if (!c.flipped && c.dealt) {
      anims.push({ kind: 'flip', card: c, dur: CFG.flipDur, delay: i * 0.13, t: 0 });
      c.flipped = true;
    }
  });
}

/* ---------- 动画更新（渲染循环内驱动） ---------- */
function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
function easeInOutCubic(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

function updateAnims(dt) {
  for (let i = anims.length - 1; i >= 0; i--) {
    const a = anims[i];
    if (a.delay > 0) { a.delay -= dt; continue; }
    a.t += dt / a.dur;
    if (a.t >= 1) {
      anims.splice(i, 1);
      finalizeAnim(a);
      continue;
    }
    applyAnim(a);
  }
}

function applyAnim(a) {
  const k = easeInOutCubic(a.t);
  if (a.kind === 'deal') {
    const g = a.card.group;
    g.position.set(
      a.from.x + (a.to.x - a.from.x) * k,
      a.from.y + (a.to.y - a.from.y) * k,
      a.from.z + (a.to.z - a.from.z) * k
    );
    g.rotation.y = a.from.ry + (a.to.ry - a.from.ry) * k;
  } else if (a.kind === 'flip') {
    const g = a.card.group;
    g.rotation.x = -Math.PI / 2 + Math.PI * k; // -90° → +90°，正面翻上来
    g.position.y = a.card.slot.y + Math.sin(a.t * Math.PI) * CFG.flipLift;
    // 回落时叠加悬停浮起
    if (a.t > 0.5) g.position.y += a.card.hoverY;
  }
}

function finalizeAnim(a) {
  if (a.kind === 'deal') {
    const g = a.card.group;
    g.position.set(a.to.x, a.to.y, a.to.z);
    g.rotation.y = a.to.ry;
    a.card.dealt = true;
    // 触发悬浮（若有）
    g.position.y = a.to.y + a.card.hoverY;
  } else if (a.kind === 'flip') {
    const g = a.card.group;
    g.rotation.x = Math.PI / 2;   // 正面朝上
    g.position.y = a.card.slot.y + a.card.hoverY;
    window.dispatchEvent(new CustomEvent('tarot:flip3d', { detail: { index: a.card.index } }));
  }
}

/* ---------- 指针交互：悬停浮起 + 点击翻牌 ---------- */
function ensurePicker() {
  if (!raycaster) { raycaster = new THREE.Raycaster(); ndc = new THREE.Vector2(); }
}

function setNdc(e) {
  const r = renderer.domElement.getBoundingClientRect();
  ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
  ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
}

function pickCard(e) {
  ensurePicker();
  setNdc(e);
  raycaster.setFromCamera(ndc, camera);
  const meshes = [];
  for (const c of cards) {
    if (c.dealt && !c.flipped) meshes.push(c.group.children[0], c.group.children[1]);
  }
  if (!meshes.length) return null;
  const hits = raycaster.intersectObjects(meshes, false);
  if (!hits.length) return null;
  const mesh = hits[0].object;
  return cards.find((c) => c.group.children.indexOf(mesh) !== -1) || null;
}

function onPointerDown(e) {
  pointerDown = [e.clientX, e.clientY];
  dragging = false;
}

function onPointerMove(e) {
  if (pointerDown) {
    const dx = e.clientX - pointerDown[0];
    const dy = e.clientY - pointerDown[1];
    if (Math.hypot(dx, dy) > 8) { dragging = true; pointerDown = null; }
  }
  if (dragging) return; // 拖拽旋转时不做悬停
  const c = pickCard(e);
  if (c !== hoverCard) {
    hoverCard = c;
    hoverTarget = c ? CFG.hoverLift : 0;
  }
}

function onPointerUp(e) {
  if (pointerDown) {
    pointerDown = null;
    const c = pickCard(e);
    if (c) flipCard(c);
  }
}

function onPointerLeave() {
  pointerDown = null;
  dragging = false;
  hoverCard = null;
  hoverTarget = 0;
}

/* ---------- 渲染循环 ---------- */
function loop() {
  if (disposed) return;
  rafId = requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05); // 帧间最大 50ms，避免切后台跳变
  updateAnims(dt);
  // 悬停浮起（缓动趋近目标）
  if (hoverCard) {
    hoverCard.hoverY += (hoverTarget - hoverCard.hoverY) * 0.18;
    if (!hoverCard.flipped) hoverCard.group.position.y = hoverCard.slot.y + hoverCard.hoverY;
  }
  controls.update();
  if (starPoints) starPoints.rotation.y += 0.00035;
  renderer.render(scene, camera);
}

/* ---------- 尺寸自适应 ---------- */
function onResize() {
  if (disposed || !container) return;
  const w = container.clientWidth;
  const h = container.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

/* ---------- WebGL 降级 ---------- */
function showFallback(el) {
  el.innerHTML =
    '<div class="tarot-table-fallback">' +
      '<p>当前浏览器不支持 WebGL，无法开启 3D 牌桌。</p>' +
      '<button type="button" class="btn btn-ghost" data-fallback-2d>✦　回到 2D 占卜</button>' +
    '</div>';
  el.querySelector('[data-fallback-2d]').addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('tarot:use2d'));
  });
}

/* ---------- 对外 API ---------- */
export function mount(el) {
  if (!el || el === container) return;
  unmount();
  container = el;
  container.innerHTML = '';

  if (!webglAvailable()) {
    showFallback(el);
    return;
  }

  createRenderer();
  scene = new THREE.Scene();
  createCamera();
  createLights();
  createTable();
  createStars();
  createControls();
  ensureCardShared();

  container.appendChild(renderer.domElement);
  const hint = document.createElement('div');
  hint.className = 't3d-hint';
  hint.textContent = '拖拽旋转 · 滚轮缩放 · 点击翻牌';
  container.appendChild(hint);

  // 指针交互（区分点击与拖拽）
  const canvasEl = renderer.domElement;
  canvasEl.addEventListener('pointerdown', onPointerDown);
  canvasEl.addEventListener('pointermove', onPointerMove);
  canvasEl.addEventListener('pointerup', onPointerUp);
  canvasEl.addEventListener('pointerleave', onPointerLeave);

  ro = new ResizeObserver(onResize);
  ro.observe(container);
  onResize();

  clock = new THREE.Clock();
  disposed = false;
  loop();
}

export function unmount() {
  if (disposed) return;
  disposed = true;

  cancelAnimationFrame(rafId);
  rafId = 0;

  if (ro) { ro.disconnect(); ro = null; }
  if (controls) { controls.dispose(); controls = null; }

  clearCards();

  if (scene) {
    scene.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      const mats = Array.isArray(obj.material) ? obj.material
        : (obj.material ? [obj.material] : []);
      for (const m of mats) {
        if (!m) continue;
        for (const key of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'alphaMap']) {
          if (m[key]) m[key].dispose();
        }
        m.dispose();
      }
    });
    scene = null;
  }

  // 释放共享卡牌资源
  if (planeGeo) { planeGeo.dispose(); planeGeo = null; }
  if (backMat) { if (backMat.map) backMat.map.dispose(); backMat.dispose(); backMat = null; }
  for (const [, t] of frontTexCache) t.dispose();
  frontTexCache.clear();
  anims.length = 0;
  hoverCard = null;

  if (renderer) {
    renderer.dispose();
    if (renderer.domElement.parentNode) {
      renderer.domElement.parentNode.removeChild(renderer.domElement);
    }
    renderer = null;
  }

  camera = null;
  starPoints = null;
  clock = null;
  if (container) { container.innerHTML = ''; container = null; }
}

/** 开始一次 3D 占卜：根据牌阵与抽牌结果落牌 */
export function startReading(spread, draw) {
  if (disposed || !scene) return;
  placeCards(spread, draw);
}

/** 全部翻开 */
export function flipAll() { if (!disposed) flipAllCards(); }

// 暴露给经典脚本（app.js）
window.Tarot3D = { mount, unmount, startReading, flipAll };
