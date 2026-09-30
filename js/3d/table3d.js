/* ============================================================
 * 星穹塔罗 · 3D 占卜牌桌
 *
 * P1 场景：WebGL 渲染器 / 固定相机 / 灯光 / 星尘圆桌 / 星空粒子
 * P2 卡牌：webp 贴图 Mesh（背面用 Canvas 纹理）、悬停浮起、左右翻牌动画
 * P3 牌阵：spreads3d.js 坐标 → 卡牌飞入桌面卡位
 * P4 流程：飞牌（洗牌视觉）→ 点击翻牌 → 全部翻开后通知 app.js 出解读
 * P5 魔幻符号：程序化绘制的卢恩符文魔法阵（桌面）+ 悬浮符文 + 光晕
 *
 * 视角策略（v1.3.3）：移除 OrbitControls，改为固定视角。
 *   原因：牌桌是"看牌"场景而非"看模型"场景，拖拽旋转会让卡牌侧对相机、
 *   无法辨认牌面，滚轮缩放也容易误触；固定俯视构图反而更稳、更像祭坛。
 *   因此不再需要 three/addons/ 依赖，index.html 的 importmap 已同步精简。
 *
 * 翻牌方向（v1.3.3）：左右翻，不是上下翻。
 *   实现方式：卡牌挂在一个 flipper 子节点上，翻转动画只改 flipper.rotation.y。
 *   局部坐标系下，flipper 的 Y 轴经外层 group.rotation.x = -90° 后映射到世界的
 *   Z 轴（纵深轴），因此绕它旋转 180° 表现为"左右掀开"；而旧实现改的是
 *   group.rotation.x（映射到世界 X 轴），表现为"上下翻"，与塔罗习惯不符。
 *
 * 事件契约：
 *   app.js → window.Tarot3D.startReading(spread, draw)  开始一次占卜
 *   app.js → window.Tarot3D.flipAll()                   全部翻开
 *   table3d → 窗口事件 'tarot:flip3d'                    每翻开一张
 *   table3d → 窗口事件 'tarot:use2d'                     WebGL 不可用时引导回 2D
 *
 * 资源管理：所有 geometry/material/texture 在 unmount 时统一释放，
 * 避免切换视图导致内存泄漏。
 * ============================================================ */
import * as THREE from 'three';
import { getSpreadPositions3d } from './spreads3d.js';

const CFG = {
  /* 桌面 */
  tableRadius: 5.0,
  tableThickness: 0.34,
  starCount: 520,
  starInner: 10,
  starOuter: 24,
  /* 卡牌 */
  cardW: 1.4,
  cardH: 2.35,
  cardY: 0.03,
  flipDur: 0.85,      // 翻牌动画时长（秒）
  flipLift: 0.6,      // 左右翻牌过程中的抬升高度，避免与桌面穿插
  dealDur: 0.6,       // 单张飞牌时长
  dealGap: 0.09,      // 相邻飞牌延迟
  dealHeight: 3.1,    // 飞牌起点高度
  deckX: 0,
  deckZ: 4.4,         // 牌堆位置（相机前方）
  hoverLift: 0.22,    // 悬停浮起高度
  /* 魔幻符号 */
  circleRadius: 3.55, // 桌面魔法阵半径（大于最外圈卡位，符文不被压住）
  circleY: 0.012,
  glowY: 0.004,
  runeCount: 8        // 悬浮卢恩符文数量
};

/* ---------- 模块状态（单例） ---------- */
let renderer = null;
let scene = null;
let camera = null;
let starPoints = null;
let container = null;
let ro = null;
let rafId = 0;
let clock = null;
let disposed = true;
let elapsed = 0;             // 场景累计时间（驱动光晕呼吸与符文漂浮）

const cards = [];            // 桌面上的牌 [{ group, flipper, hitMeshes, index, slot, flipped, dealt, hoverY, animating }]
const anims = [];            // 进行中的动画
let hoverCard = null;        // 当前悬停的牌
let raycaster = null;
let ndc = null;
let pointerDown = null;      // 记录按下位置，用于区分点击与滑动

// 共享几何 / 材质（跨牌复用，避免重复创建）
let planeGeo = null;
let backMat = null;
const frontTexCache = new Map();   // 牌面贴图缓存：img → Texture

// 魔幻符号资源
let magicCircle = null;            // 桌面魔法阵 Mesh（缓慢自转）
let glowDisc = null;               // 桌面光晕
let runeSprites = [];              // 悬浮卢恩符文
const runeTexCache = new Map();    // 单字符文贴图缓存：runeIndex → Texture

/** WebGL 能力检测（含老内核 experimental-webgl） */
function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl') || c.getContext('experimental-webgl'));
  } catch (e) {
    return false;
  }
}

/* ============================================================
 * P1 场景
 * ============================================================ */
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

/** 固定视角：正面俯视，构图居中，不提供任何旋转/缩放交互 */
function createCamera() {
  camera = new THREE.PerspectiveCamera(
    42,
    container.clientWidth / container.clientHeight,
    0.1, 60
  );
  camera.position.set(0, 8.6, 9.4);
  camera.lookAt(0, 0, 0.2);
}

function createLights() {
  // three r155+ 默认物理光照模式（useLegacyLights=false），
  // 光照强度需按 candela 量级给值，否则场景欠曝。
  scene.add(new THREE.AmbientLight(0x3a2a66, 1.15));
  const key = new THREE.SpotLight(0xe8c56b, 220, 0, Math.PI / 5, 0.5);
  key.position.set(0, 12, 2);
  key.target.position.set(0, 0, 0);
  scene.add(key);
  scene.add(key.target);
  const violet = new THREE.PointLight(0x8b6cf0, 70, 26, 1.4);
  violet.position.set(-7, 5, -7);
  scene.add(violet);
  const violet2 = new THREE.PointLight(0x6f8bff, 45, 24, 1.4);
  violet2.position.set(7, 4, 6);
  scene.add(violet2);
}

/** 桌面贴图：中心偏亮的深紫径向渐变 + 细碎金屑，避免纯色显得"塑料" */
function createTableTexture() {
  const size = 512;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');

  const grad = g.createRadialGradient(size * 0.5, size * 0.5, size * 0.05, size * 0.5, size * 0.5, size * 0.5);
  grad.addColorStop(0, '#241041');
  grad.addColorStop(0.55, '#180b30');
  grad.addColorStop(1, '#0d0620');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);

  // 星屑金屑：随机小点，营造"星尘桌面"
  for (let i = 0; i < 340; i++) {
    const a = Math.random() * 0.22 + 0.04;
    g.fillStyle = 'rgba(232,197,107,' + a.toFixed(3) + ')';
    g.beginPath();
    g.arc(Math.random() * size, Math.random() * size, Math.random() * 1.4 + 0.3, 0, Math.PI * 2);
    g.fill();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createTable() {
  const topGeo = new THREE.CylinderGeometry(
    CFG.tableRadius, CFG.tableRadius * 0.985, CFG.tableThickness, 72
  );
  const topMat = new THREE.MeshStandardMaterial({
    map: createTableTexture(),
    roughness: 0.82,
    metalness: 0.12
  });
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

/* ============================================================
 * P5 魔幻符号（全部程序化绘制，零外部字体/图片依赖）
 *
 * 绝不引入外链字体或素材：项目既定策略是"自托管、无外部 CDN"，
 * 且符文用矢量路径手绘即可完全掌控观感与体积。
 * ============================================================ */

/**
 * 24 个 Elder Futhark（古弗萨克）卢恩符文，用归一化折线描述：
 * 每个符文是若干条折线，坐标范围 0~1（x 向右、y 向下）。
 */
const RUNE_PATHS = [
  // ᚠ Fehu
  [[[0.30, 0.06], [0.30, 0.94]], [[0.30, 0.20], [0.78, 0.06]], [[0.30, 0.54], [0.78, 0.40]]],
  // ᚢ Uruz
  [[[0.32, 0.06], [0.32, 0.94]], [[0.32, 0.06], [0.76, 0.30], [0.32, 0.54]]],
  // ᚦ Thurisaz
  [[[0.34, 0.06], [0.34, 0.94]], [[0.34, 0.32], [0.76, 0.50], [0.34, 0.68]]],
  // ᚨ Ansuz
  [[[0.34, 0.06], [0.34, 0.94]], [[0.34, 0.14], [0.76, 0.34]], [[0.34, 0.44], [0.76, 0.64]]],
  // ᚱ Raidho
  [[[0.34, 0.06], [0.34, 0.94]], [[0.34, 0.06], [0.74, 0.24], [0.34, 0.48]], [[0.34, 0.48], [0.76, 0.94]]],
  // ᚲ Kenaz
  [[[0.76, 0.08], [0.30, 0.50], [0.76, 0.92]]],
  // ᚷ Gebo
  [[[0.24, 0.08], [0.76, 0.92]], [[0.76, 0.08], [0.24, 0.92]]],
  // ᚹ Wunjo
  [[[0.34, 0.06], [0.34, 0.94]], [[0.34, 0.12], [0.72, 0.32], [0.34, 0.54]]],
  // ᚺ Hagalaz
  [[[0.30, 0.06], [0.30, 0.94]], [[0.70, 0.06], [0.70, 0.94]], [[0.30, 0.50], [0.70, 0.50]]],
  // ᚾ Nauthiz
  [[[0.34, 0.06], [0.34, 0.94]], [[0.70, 0.06], [0.70, 0.94]], [[0.34, 0.74], [0.70, 0.44]]],
  // ᛁ Isa
  [[[0.50, 0.06], [0.50, 0.94]]],
  // ᛃ Jera
  [[[0.74, 0.14], [0.34, 0.14]], [[0.34, 0.14], [0.30, 0.50], [0.70, 0.50]], [[0.70, 0.50], [0.66, 0.86]], [[0.66, 0.86], [0.26, 0.86]]],
  // ᛇ Eihwaz
  [[[0.34, 0.06], [0.34, 0.94]], [[0.72, 0.06], [0.34, 0.50]], [[0.34, 0.50], [0.72, 0.94]]],
  // ᛈ Perthro
  [[[0.28, 0.06], [0.28, 0.94]], [[0.28, 0.26], [0.66, 0.10], [0.66, 0.46], [0.28, 0.30]], [[0.30, 0.56], [0.66, 0.40]]],
  // ᛉ Algiz
  [[[0.50, 0.94], [0.50, 0.34]], [[0.50, 0.34], [0.20, 0.06]], [[0.50, 0.34], [0.80, 0.06]]],
  // ᛊ Sowilo
  [[[0.20, 0.06], [0.76, 0.46], [0.20, 0.94]]],
  // ᛏ Tiwaz
  [[[0.50, 0.06], [0.50, 0.94]], [[0.50, 0.06], [0.20, 0.34]], [[0.50, 0.06], [0.80, 0.34]]],
  // ᛒ Berkano
  [[[0.30, 0.06], [0.30, 0.94]], [[0.30, 0.06], [0.68, 0.18], [0.68, 0.44], [0.30, 0.56]], [[0.30, 0.56], [0.70, 0.70], [0.70, 0.94], [0.30, 0.94]]],
  // ᛖ Ehwaz
  [[[0.30, 0.06], [0.30, 0.94]], [[0.70, 0.06], [0.70, 0.94]], [[0.30, 0.06], [0.70, 0.44]], [[0.30, 0.56], [0.70, 0.94]]],
  // ᛗ Mannaz
  [[[0.26, 0.94], [0.26, 0.06]], [[0.74, 0.94], [0.74, 0.06]], [[0.26, 0.06], [0.50, 0.44], [0.74, 0.06]]],
  // ᛚ Laguz
  [[[0.66, 0.06], [0.34, 0.50], [0.66, 0.94]]],
  // ᛜ Ingwaz
  [[[0.50, 0.10], [0.80, 0.50], [0.50, 0.90], [0.20, 0.50], [0.50, 0.10]]],
  // ᛞ Dagaz
  [[[0.20, 0.08], [0.80, 0.08]], [[0.20, 0.92], [0.80, 0.92]], [[0.20, 0.08], [0.80, 0.92]], [[0.80, 0.08], [0.20, 0.92]]],
  // ᛟ Othala
  [[[0.20, 0.48], [0.50, 0.12], [0.80, 0.48], [0.50, 0.84], [0.20, 0.48]], [[0.50, 0.84], [0.50, 0.96]], [[0.50, 0.62], [0.24, 0.96]], [[0.50, 0.62], [0.76, 0.96]]]
];

/**
 * 在 2D 上下文里绘制单个卢恩符文（以 (cx,cy) 为中心，size 为边长）。
 * @param {CanvasRenderingContext2D} g
 * @param {number} runeIndex 0~23
 * @param {number} cx 中心 x
 * @param {number} cy 中心 y
 * @param {number} size 符文边长
 * @param {number} lw 线宽
 */
function drawRune(g, runeIndex, cx, cy, size, lw) {
  const paths = RUNE_PATHS[runeIndex % RUNE_PATHS.length];
  const s = size;
  const left = cx - s / 2;
  const top = cy - s / 2;
  g.lineWidth = lw;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.beginPath();
  for (const line of paths) {
    for (let i = 0; i < line.length; i++) {
      const px = left + line[i][0] * s;
      const py = top + line[i][1] * s;
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
  }
  g.stroke();
}

/**
 * 生成桌面魔法阵贴图：
 * 外圈双环 + 24 符文环（径向朝外）+ 内圈七芒星 + 刻度 + 中心柔光。
 * 返回可复用的 CanvasTexture。
 */
function createMagicCircleTexture() {
  const size = 1024;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const cx = size / 2, cy = size / 2;
  const GOLD = 'rgba(240,205,130,';

  // 中心柔光
  const glow = g.createRadialGradient(cx, cy, 0, cx, cy, size * 0.5);
  glow.addColorStop(0, GOLD + '0.16)');
  glow.addColorStop(0.45, GOLD + '0.05)');
  glow.addColorStop(1, GOLD + '0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, size, size);

  g.strokeStyle = GOLD + '0.75)';
  g.shadowColor = 'rgba(232,197,107,0.85)';
  g.shadowBlur = 16;

  // 外圈双环
  g.lineWidth = 3;
  g.beginPath(); g.arc(cx, cy, size * 0.472, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 1.4;
  g.beginPath(); g.arc(cx, cy, size * 0.452, 0, Math.PI * 2); g.stroke();

  // 符文环：24 个符文均匀分布，字头朝外
  const runeR = size * 0.404;
  const runeSize = size * 0.058;
  for (let i = 0; i < 24; i++) {
    const ang = (i / 24) * Math.PI * 2 - Math.PI / 2;
    g.save();
    g.translate(cx + Math.cos(ang) * runeR, cy + Math.sin(ang) * runeR);
    g.rotate(ang + Math.PI / 2);
    drawRune(g, i, 0, 0, runeSize, 2.6);
    g.restore();
  }

  // 刻度环（72 道短线）
  const tickR = size * 0.362;
  g.lineWidth = 1.6;
  for (let i = 0; i < 72; i++) {
    const ang = (i / 72) * Math.PI * 2;
    const long = i % 6 === 0;
    const inner = tickR - (long ? size * 0.026 : size * 0.013);
    g.globalAlpha = long ? 0.85 : 0.4;
    g.beginPath();
    g.moveTo(cx + Math.cos(ang) * inner, cy + Math.sin(ang) * inner);
    g.lineTo(cx + Math.cos(ang) * tickR, cy + Math.sin(ang) * tickR);
    g.stroke();
  }
  g.globalAlpha = 1;

  // 内环
  g.lineWidth = 1.6;
  g.beginPath(); g.arc(cx, cy, size * 0.332, 0, Math.PI * 2); g.stroke();

  // 七芒星 {7/3}：经典魔法阵骨架
  const starR = size * 0.322;
  g.lineWidth = 2;
  g.beginPath();
  for (let i = 0; i <= 7; i++) {
    const idx = (i * 3) % 7;
    const ang = (idx / 7) * Math.PI * 2 - Math.PI / 2;
    const px = cx + Math.cos(ang) * starR;
    const py = cy + Math.sin(ang) * starR;
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.stroke();

  // 中心小环 + 圆点
  g.lineWidth = 1.4;
  g.beginPath(); g.arc(cx, cy, size * 0.062, 0, Math.PI * 2); g.stroke();
  g.fillStyle = GOLD + '0.9)';
  g.beginPath(); g.arc(cx, cy, size * 0.014, 0, Math.PI * 2); g.fill();

  g.shadowBlur = 0;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** 生成柔光圆盘贴图（桌面外圈光晕） */
function createGlowTexture() {
  const size = 512;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(139,108,240,0.20)');
  grad.addColorStop(0.5, 'rgba(232,197,107,0.10)');
  grad.addColorStop(1, 'rgba(139,108,240,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** 生成单个卢恩符文贴图（用于悬浮符文 Sprite），按索引缓存避免重复创建 */
function getRuneTexture(runeIndex) {
  let t = runeTexCache.get(runeIndex);
  if (t) return t;
  const size = 128;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.strokeStyle = 'rgba(245,223,160,0.95)';
  g.shadowColor = 'rgba(232,197,107,0.95)';
  g.shadowBlur = 14;
  drawRune(g, runeIndex, size / 2, size / 2, size * 0.56, 6);
  t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  runeTexCache.set(runeIndex, t);
  return t;
}

/** 桌面魔法阵 + 光晕：两者都平铺在桌面上，加法混合，不写深度 */
function createMagicSymbols() {
  // 光晕圆盘（比桌面略大，形成"祭坛辉光"）
  const glowGeo = new THREE.PlaneGeometry(CFG.tableRadius * 2.6, CFG.tableRadius * 2.6);
  const glowMat = new THREE.MeshBasicMaterial({
    map: createGlowTexture(),
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  glowDisc = new THREE.Mesh(glowGeo, glowMat);
  glowDisc.rotation.x = -Math.PI / 2;
  glowDisc.position.y = CFG.glowY;
  glowDisc.renderOrder = 1;
  scene.add(glowDisc);

  // 魔法阵：PlaneGeometry 先被 rotation.z 在自身平面内旋转，再由 rotation.x 放平
  // （Euler 默认 XYZ 序：先 Z 再 Y 再 X），因此 rotation.z 即"阵盘自转"。
  const circleGeo = new THREE.PlaneGeometry(CFG.circleRadius * 2, CFG.circleRadius * 2);
  const circleMat = new THREE.MeshBasicMaterial({
    map: createMagicCircleTexture(),
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  magicCircle = new THREE.Mesh(circleGeo, circleMat);
  magicCircle.rotation.x = -Math.PI / 2;
  magicCircle.position.y = CFG.circleY;
  magicCircle.renderOrder = 2;
  scene.add(magicCircle);

  // 悬浮符文：环绕牌桌缓慢公转 + 上下浮动 + 呼吸明暗
  for (let i = 0; i < CFG.runeCount; i++) {
    const mat = new THREE.SpriteMaterial({
      map: getRuneTexture(i * 3),      // 取质数步长，符文分布更均匀
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: 0.85
    });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(0.62, 0.62, 1);
    sprite.userData = {
      angle: (i / CFG.runeCount) * Math.PI * 2,
      radius: CFG.tableRadius * 0.86 + (i % 3) * 0.22,
      baseY: 1.25 + (i % 4) * 0.42,
      phase: Math.random() * Math.PI * 2,
      speed: 0.055 + (i % 3) * 0.016
    };
    scene.add(sprite);
    runeSprites.push(sprite);
  }
}

/** 更新魔幻符号动画（在渲染循环内调用） */
function updateMagic(dt) {
  if (magicCircle) {
    magicCircle.rotation.z += dt * 0.06;                       // 阵盘缓慢自转
    magicCircle.material.opacity = 0.78 + Math.sin(elapsed * 0.9) * 0.14;  // 呼吸
  }
  if (glowDisc) {
    glowDisc.material.opacity = 0.72 + Math.sin(elapsed * 0.6) * 0.16;
  }
  for (const s of runeSprites) {
    const u = s.userData;
    u.angle += u.speed * dt;
    s.position.set(
      Math.cos(u.angle) * u.radius,
      u.baseY + Math.sin(elapsed * 0.8 + u.phase) * 0.24,
      Math.sin(u.angle) * u.radius
    );
    s.material.opacity = 0.42 + Math.sin(elapsed * 1.1 + u.phase) * 0.34;
  }
}

/* ============================================================
 * P2 卡牌资源
 * ============================================================ */

/** 卡背贴图 + 共享几何/材质（跨牌复用，避免重复创建） */
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
  // 卡背中心：一圈符文 + 星点，呼应桌面魔法阵
  g.strokeStyle = 'rgba(232,197,107,0.75)';
  g.lineWidth = 1.5;
  g.beginPath(); g.arc(c.width / 2, c.height / 2, 16, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.arc(c.width / 2, c.height / 2, 9, 0, Math.PI * 2); g.stroke();
  g.fillStyle = 'rgba(250,230,170,0.95)';
  g.beginPath(); g.arc(c.width / 2 - 3, c.height / 2 - 2, 4, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(232,197,107,0.6)';
  g.lineWidth = 2;
  drawRune(g, 20, c.width / 2, c.height * 0.78, 26, 2);   // ᛚ Laguz：水之流，寓意直觉

  const backTex = new THREE.CanvasTexture(c);
  backTex.colorSpace = THREE.SRGBColorSpace;
  backMat = new THREE.MeshStandardMaterial({
    map: backTex, roughness: 0.75, metalness: 0.08,
    emissive: 0x2a1650, emissiveIntensity: 0.7   // 微自发光，让卡牌从桌面浮现
  });
}

/** 牌面贴图（按图名缓存，避免同一张牌重复解码） */
function getFrontTexture(img) {
  let t = frontTexCache.get(img);
  if (t) return t;
  t = new THREE.TextureLoader().load('assets/cards/' + img);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  frontTexCache.set(img, t);
  return t;
}

/* ============================================================
 * P3 落牌
 * ============================================================ */
function placeCards(spread, draw) {
  clearCards();
  ensureCardShared();
  const slots = getSpreadPositions3d(spread);

  draw.forEach((d, i) => {
    const s = slots[i] || { x: 0, z: 0, y: CFG.cardY, rotY: 0 };
    const group = new THREE.Group();
    // flipper：只承载"翻牌"这一个自由度，与外层的落位/倾倒解耦
    const flipper = new THREE.Group();

    // 背面（初始朝上）：normal +y
    const backMesh = new THREE.Mesh(planeGeo, backMat);
    backMesh.position.y = 0.002;
    // 正面（初始朝下）：normal -y；翻转后朝上
    const frontMat = new THREE.MeshStandardMaterial({
      map: getFrontTexture(d.card.img),
      roughness: 0.6,
      metalness: 0.08
    });
    const frontMesh = new THREE.Mesh(planeGeo, frontMat);
    frontMesh.rotation.x = Math.PI;
    frontMesh.position.y = -0.002;
    // 逆位：翻上来后整张 180° 倒置
    if (d.orientation === 'reversed') frontMesh.rotation.z = Math.PI;

    flipper.add(backMesh);
    flipper.add(frontMesh);
    group.add(flipper);

    const card = {
      group,
      flipper,
      frontMesh,                          // 仅用于卸载时释放其独占材质
      hitMeshes: [backMesh, frontMesh],   // 射线拾取用
      index: i,
      slot: { x: s.x, z: s.z, y: s.y !== undefined ? s.y : CFG.cardY, rotY: s.rotY || 0 },
      flipped: false,
      dealt: false,
      animating: false,
      hoverY: 0
    };

    // 从牌堆飞向卡位（背面朝上）
    group.position.set(CFG.deckX, CFG.dealHeight, CFG.deckZ);
    group.rotation.x = -Math.PI / 2;   // 放平：背面（法线 +Z）朝上
    group.rotation.y = (Math.random() * 6 - 3) * (Math.PI / 180);

    scene.add(group);
    cards.push(card);
    card.animating = true;
    anims.push({
      kind: 'deal', card,
      dur: CFG.dealDur, delay: i * CFG.dealGap, t: 0,
      from: { x: group.position.x, y: group.position.y, z: group.position.z, ry: group.rotation.y },
      to: { x: card.slot.x, y: card.slot.y, z: card.slot.z, ry: card.slot.rotY }
    });
  });
}

/** 清空桌面卡牌：移除节点、释放独占材质、并丢弃所有指向旧卡的动画 */
function clearCards() {
  for (const c of cards) {
    scene.remove(c.group);
    c.frontMesh.material.dispose();   // 牌面材质为单张独占；几何与卡背材质是共享资源，此处不动
  }
  cards.length = 0;
  anims.length = 0;      // 关键：动画队列里可能仍指向已移除的卡，不清会产生"幽灵动画"
  hoverCard = null;
}

/* ============================================================
 * P4 翻牌（左右翻）
 * ============================================================ */

/**
 * 开始翻一张牌。
 * 左右翻的实现：只改 flipper.rotation.y（0 → π），绕"卡牌平面内竖直轴"旋转，
 * 经外层 group 放平后即表现为绕世界 Z 轴（纵深轴）掀开 —— 视觉上是左右翻。
 */
function flipCard(card) {
  if (!card || card.flipped || !card.dealt) return;
  card.flipped = true;
  card.animating = true;
  anims.push({ kind: 'flip', card, dur: CFG.flipDur, delay: 0, t: 0 });
}

/** 全部翻开（逐张交错延迟） */
function flipAllCards() {
  cards.forEach((c, i) => {
    if (!c.flipped && c.dealt) {
      c.flipped = true;
      c.animating = true;
      anims.push({ kind: 'flip', card: c, dur: CFG.flipDur, delay: i * 0.13, t: 0 });
    }
  });
}

/* ============================================================
 * 动画驱动
 * ============================================================ */
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
    const c = a.card;
    // 左右翻：flipper 绕自身 Y 轴 0 → π；同时轻微抬升，避免贴着桌面穿插
    c.flipper.rotation.y = Math.PI * k;
    c.group.position.y = c.slot.y + Math.sin(a.t * Math.PI) * CFG.flipLift + c.hoverY;
  }
}

function finalizeAnim(a) {
  const c = a.card;
  c.animating = false;
  if (a.kind === 'deal') {
    const g = c.group;
    g.position.set(a.to.x, a.to.y + c.hoverY, a.to.z);
    g.rotation.y = a.to.ry;
    c.dealt = true;
    // 全部落位后才通知外层显示「全部翻开」。
    // 早期实现由 app.js 用固定延时估算落牌时长，慢设备上按钮会先于落牌出现，
    // 此时点击会因卡牌尚未 dealt 而被跳过（"点了没反应"）。改用落位事件驱动，彻底消除时序假设。
    if (cards.length && cards.every((x) => x.dealt)) {
      window.dispatchEvent(new CustomEvent('tarot:alldealt'));
    }
  } else if (a.kind === 'flip') {
    c.flipper.rotation.y = Math.PI;   // 正面朝上（左右翻终态）
    c.group.position.y = c.slot.y + c.hoverY;
    window.dispatchEvent(new CustomEvent('tarot:flip3d', { detail: { index: c.index } }));
  }
}

/* ============================================================
 * 指针交互：悬停浮起 + 点击翻牌（无拖拽旋转）
 * ============================================================ */
function ensurePicker() {
  if (!raycaster) { raycaster = new THREE.Raycaster(); ndc = new THREE.Vector2(); }
}

function setNdc(e) {
  const r = renderer.domElement.getBoundingClientRect();
  ndc.x = ((e.clientX - r.left) / r.width) * 2 - 1;
  ndc.y = -((e.clientY - r.top) / r.height) * 2 + 1;
}

/** 拾取可翻的卡（未翻开、且已落位） */
function pickCard(e) {
  ensurePicker();
  setNdc(e);
  raycaster.setFromCamera(ndc, camera);
  const meshes = [];
  for (const c of cards) {
    if (c.dealt && !c.flipped) meshes.push(c.hitMeshes[0], c.hitMeshes[1]);
  }
  if (!meshes.length) return null;
  const hits = raycaster.intersectObjects(meshes, false);
  if (!hits.length) return null;
  const mesh = hits[0].object;
  return cards.find((c) => c.hitMeshes.indexOf(mesh) !== -1) || null;
}

function onPointerDown(e) {
  pointerDown = [e.clientX, e.clientY];
}

function onPointerMove(e) {
  const c = pickCard(e);
  if (c !== hoverCard) {
    hoverCard = c;
    renderer.domElement.style.cursor = c ? 'pointer' : 'default';
  }
}

function onPointerUp(e) {
  if (!pointerDown) return;
  const dx = e.clientX - pointerDown[0];
  const dy = e.clientY - pointerDown[1];
  pointerDown = null;
  // 移动超过 8px 视为滑动（移动端滚动页面），不触发翻牌
  if (Math.hypot(dx, dy) > 8) return;
  const c = pickCard(e);
  if (c) flipCard(c);
}

function onPointerLeave() {
  pointerDown = null;
  hoverCard = null;
  if (renderer) renderer.domElement.style.cursor = 'default';
}

/* ============================================================
 * 渲染循环
 * ============================================================ */
function loop() {
  if (disposed) return;
  rafId = requestAnimationFrame(loop);
  const dt = Math.min(clock.getDelta(), 0.05); // 帧间最大 50ms，避免切后台跳变
  elapsed += dt;

  updateAnims(dt);

  // 悬停浮起：对所有卡统一缓动趋近目标高度。
  // 旧实现只在"当前悬停牌"上更新，鼠标移开后该牌 hoverY 不再回落，
  // 会永久悬空 —— 这里改为全量遍历，离开即回落。
  for (const c of cards) {
    const target = (c === hoverCard) ? CFG.hoverLift : 0;
    c.hoverY += (target - c.hoverY) * 0.18;
    if (Math.abs(c.hoverY) < 0.0004) c.hoverY = 0;
    if (c.dealt && !c.animating) c.group.position.y = c.slot.y + c.hoverY;
  }

  updateMagic(dt);
  if (starPoints) starPoints.rotation.y += dt * 0.02;
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

/* ============================================================
 * 对外 API
 * ============================================================ */
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
  createMagicSymbols();
  ensureCardShared();

  container.appendChild(renderer.domElement);
  const hint = document.createElement('div');
  hint.className = 't3d-hint';
  hint.textContent = '固定视角 · 点击卡牌左右翻牌';
  container.appendChild(hint);

  // 指针交互（固定视角，仅拾取与点击）
  const canvasEl = renderer.domElement;
  canvasEl.addEventListener('pointerdown', onPointerDown);
  canvasEl.addEventListener('pointermove', onPointerMove);
  canvasEl.addEventListener('pointerup', onPointerUp);
  canvasEl.addEventListener('pointerleave', onPointerLeave);

  ro = new ResizeObserver(onResize);
  ro.observe(container);
  onResize();

  clock = new THREE.Clock();
  elapsed = 0;
  disposed = false;
  loop();
}

export function unmount() {
  if (disposed) return;
  disposed = true;

  cancelAnimationFrame(rafId);
  rafId = 0;

  if (ro) { ro.disconnect(); ro = null; }

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

  // 释放魔幻符号资源
  magicCircle = null;
  glowDisc = null;
  runeSprites.length = 0;
  for (const [, t] of runeTexCache) t.dispose();
  runeTexCache.clear();

  anims.length = 0;
  hoverCard = null;
  pointerDown = null;

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