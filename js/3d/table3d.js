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
  // v1.3.5 半径 5.0 → 5.5：卡位间距改为按牌的实际尺寸推导后，最大的牌阵
  // （十二宫 4×3）最外侧牌角距圆心约 5.18，半径 5.0 会让牌角悬空出桌沿。
  tableRadius: 5.5,
  tableThickness: 0.62,   // v1.3.7：0.34 → 0.62，侧裙在俯视构图里可见，"飞盘感"消失
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
  cardCorner: 0.1,    // 卡牌圆角半径（世界单位，约卡宽的 7%）
  shadowY: 0.006,     // 卡牌投影贴附桌面的高度
  /* 魔幻符号 */
  circleRadius: 3.9,  // 桌面魔法阵半径（随桌面放大，仍大于最外圈卡位，符文不被压住）
  circleY: 0.012,
  glowY: 0.004,
  runeCount: 8,       // 悬浮卢恩符文数量
  /* 桌面浮尘粒子 */
  moteCount: 130,     // 浮尘数量（点精灵，按帧更新位置，开销可忽略）
  moteRise: 0.22,     // 浮尘上升速度（单位/秒）
  moteTop: 4.2        // 浮尘升到该高度后回到底部循环
};

/* ---------- 模块状态（单例） ---------- */
let renderer = null;
let scene = null;
let camera = null;
let starPoints = null;
let starMat = null;           // 星点 ShaderMaterial（逐星闪烁）
let tableRimMat = null;       // 口沿金环材质（呼吸发光）
let motePoints = null;       // 桌面浮尘粒子
let moteData = null;         // 浮尘的 TypedArray 状态（位置/速度/相位等）
let container = null;
let ro = null;
let rafId = 0;
let clock = null;
let disposed = true;
let elapsed = 0;             // 场景累计时间（驱动光晕呼吸与符文漂浮）
let envRT = null;            // PMREM 环境反射渲染目标（v1.3.7，卸载时释放）
let camScale = 1;            // 相机距离系数（1 = 全景，<1 = 贴近牌阵）
let camScaleTarget = 1;      // 目标系数，按牌阵铺开半径平滑过渡

const cards = [];            // 桌面上的牌 [{ group, flipper, hitMeshes, index, slot, flipped, dealt, hoverY, animating }]
const anims = [];            // 进行中的动画
let hoverCard = null;        // 当前悬停的牌
let raycaster = null;
let ndc = null;
let pointerDown = null;      // 记录按下位置，用于区分点击与滑动
let hoverRaf = 0;            // 悬停拾取的合并帧句柄
let hoverPending = null;     // 待处理的最新指针位置

// 共享几何 / 材质（跨牌复用，避免重复创建）
let planeGeo = null;
let backMat = null;
let cardAlphaMask = null;        // 圆角遮罩贴图（全卡共享）
let shadowGeo = null;            // 接触投影几何（全卡共享）
let shadowMat = null;            // 接触投影材质（全卡共享）
let cardGlowGeo = null;          // 卡牌辉光几何（v1.5.3）
let cardGlowBaseMat = null;      // 卡牌辉光基础材质（每张牌 clone，独立控制透明度）
const frontTexCache = new Map();   // 牌面贴图缓存：img → Texture

// 魔幻符号资源
let magicCircle = null;            // 桌面魔法阵 Mesh（缓慢自转）
let glowDisc = null;               // 桌面光晕
let runeSprites = [];              // 悬浮卢恩符文
let rippleRings = [];              // 阵心向外扩散的光环
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
  // 色调映射：这里刻意用「直通」而不是 ACES。
  // 实测 ACES 会把 Rider-Waite 卡面的暖白底压成灰白、明显去饱和 ——
  // 卡面是本页的核心内容，保真优先于高光滚降；发光元素则靠自身 opacity 控制，
  // 本来就不会过曝（v1.3.4 的直通方案已足够好看）。
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.domElement.className = 't3d-canvas';
}

/** 固定视角：正面俯视，构图居中，不提供任何旋转/缩放交互 */
function createCamera() {
  camera = new THREE.PerspectiveCamera(
    42,
    container.clientWidth / container.clientHeight,
    0.1, 60
  );
  // 桌面半径 5.5（比 v1.3.4 的 5.0 大 10%），相机等比后退保持构图不变；
  // camScale 由牌阵铺开半径驱动（见 placeCards），单张牌阵会适度推近。
  camera.position.set(0, 9.4 * camScale, 10.3 * camScale);
  camera.lookAt(0, 0, 0.2);
}

/**
 * 环境反射（v1.3.7）：程序化 512×256 等距柱状渐变 → PMREM。
 *
 * 没有环境贴图时，金属度再高的金环也只能反射黑背景，看起来像塑料；
 * 这里用 Canvas 画一张"深紫天幕 + 暖金地平光 + 冷色光斑"的简易环境，
 * 让金饰出现方向明确的高光。零下载、只在挂载时预过滤一次。
 */
function createEnvironment() {
  try {
    const w = 512, h = 256;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');

    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#0e0820');
    grad.addColorStop(0.42, '#241543');
    grad.addColorStop(0.60, '#6a4a2c');   // 暖金地平光
    grad.addColorStop(0.72, '#180d2e');
    grad.addColorStop(1, '#06030d');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);

    const blob = (x, y, rx, ry, color, alpha) => {
      g.save();
      g.translate(x, y);
      g.scale(1, ry / rx);
      const rg = g.createRadialGradient(0, 0, 0, 0, 0, rx);
      rg.addColorStop(0, color);
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      g.globalAlpha = alpha;
      g.fillStyle = rg;
      g.beginPath();
      g.arc(0, 0, rx, 0, Math.PI * 2);
      g.fill();
      g.restore();
      g.globalAlpha = 1;
    };
    blob(112, 62, 88, 52, 'rgba(120,90,255,0.95)', 0.85);
    blob(386, 88, 112, 42, 'rgba(255,200,120,0.92)', 0.8);

    const tex = new THREE.CanvasTexture(c);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.colorSpace = THREE.SRGBColorSpace;

    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    envRT = pmrem.fromEquirectangular(tex);
    scene.environment = envRT.texture;

    tex.dispose();
    pmrem.dispose();
  } catch (e) {
    // 预过滤失败（极老内核）时退回纯灯光照明，不影响主流程
    envRT = null;
  }
}

function createLights() {
  // three r155+ 默认物理光照模式（useLegacyLights=false），
  // 光照强度需按 candela 量级给值，否则场景欠曝。
  // v1.3.5 追加了很弱的半球光补齐暗部、一束冷色轮廓光勾边，
  // 但直射主光刻意保持克制 —— 卡面是暖白底（Rider-Waite），
  // 直射光给太强会把牌面冲成一片奶白、丢掉画面细节。
  scene.add(new THREE.AmbientLight(0x3a2a66, 1.2));

  // 半球光：天空紫 / 地面深紫，只为暗部补一点层次
  scene.add(new THREE.HemisphereLight(0x9a7cf0, 0x14082a, 0.18));

  // 主光：从正上方偏前方打下来，形成卡牌与符文的主要高光
  const key = new THREE.SpotLight(0xe8c56b, 205, 0, Math.PI / 5, 0.5);
  key.position.set(0, 12, 2);
  key.target.position.set(0, 0, 0);
  scene.add(key);
  scene.add(key.target);

  // 紫侧光 + 蓝侧光：勾出桌面圆环与卡牌侧边
  const violet = new THREE.PointLight(0x8b6cf0, 68, 26, 1.4);
  violet.position.set(-7, 5, -7);
  scene.add(violet);
  const violet2 = new THREE.PointLight(0x6f8bff, 42, 24, 1.4);
  violet2.position.set(7, 4, 6);
  scene.add(violet2);

  // 背光（轮廓光）：从桌面后方低角度打来，给卡牌顶部描一条冷色边，
  // 让牌从深色桌面里"浮"出来，而不是糊成一片（强度需克制，否则牌面会发灰）
  const rim = new THREE.PointLight(0x9fd8ff, 26, 30, 1.3);
  rim.position.set(0, 3.2, -9);
  scene.add(rim);

  // 暖金前侧轮廓光（v1.3.7）：从右下低角度扫过桌沿与卡牌侧边，
  // 让金环出现"被烛火照亮"的边缘高光，而不是均匀发亮
  const goldRim = new THREE.PointLight(0xffb85c, 22, 22, 1.4);
  goldRim.position.set(6.5, 2.4, 7.2);
  scene.add(goldRim);
}

/** 桌面贴图：中心偏亮的深紫径向渐变 + 细碎金屑 + 极淡放射纹，避免纯色显"塑料" */
function createTableTexture() {
  const size = 1024;   // v1.3.7：512 → 1024，近景不再糊成纯色
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const cx = size / 2, cy = size / 2;

  const grad = g.createRadialGradient(cx, cy, size * 0.04, cx, cy, size * 0.5);
  grad.addColorStop(0, '#2a1550');
  grad.addColorStop(0.55, '#180b30');
  grad.addColorStop(1, '#0a0418');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);

  // 24 道极淡放射纹：像丝绒的织纹方向，只在近景可见
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    g.strokeStyle = 'rgba(150,120,255,0.035)';
    g.lineWidth = size * 0.012;
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * size * 0.08, cy + Math.sin(a) * size * 0.08);
    g.lineTo(cx + Math.cos(a) * size * 0.5, cy + Math.sin(a) * size * 0.5);
    g.stroke();
  }

  // 星屑金屑：随机小点，营造"星尘桌面"
  for (let i = 0; i < 1100; i++) {
    const a = Math.random() * 0.22 + 0.03;
    g.fillStyle = 'rgba(232,197,107,' + a.toFixed(3) + ')';
    g.beginPath();
    g.arc(Math.random() * size, Math.random() * size, Math.random() * 1.8 + 0.3, 0, Math.PI * 2);
    g.fill();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;    // 斜视桌面的近景边缘更清晰
  return tex;
}

/** 桌侧裙边贴图：自上而下加深，底部几乎没入夜色，强化"悬浮祭坛"的体积感 */
function createSkirtTexture() {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0, '#3a2166');
  grad.addColorStop(0.35, '#1d0f38');
  grad.addColorStop(1, '#080312');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  // 稀疏星屑，避免裙边是一整块死板纯色
  for (let i = 0; i < 150; i++) {
    g.fillStyle = 'rgba(232,197,107,' + (Math.random() * 0.15 + 0.03).toFixed(3) + ')';
    g.beginPath();
    g.arc(Math.random() * size, Math.random() * size, Math.random() * 1.2 + 0.3, 0, Math.PI * 2);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createTable() {
  const R = CFG.tableRadius;

  // 台面用正圆：CircleGeometry 的 UV 把贴图按 0~1 径向铺开，径向渐变正好落在圆心；
  // 原来的 CylinderGeometry 顶面 UV 是圆环展开，渐变会被拉成条纹。
  const topGeo = new THREE.CircleGeometry(R, 96);
  const topMat = new THREE.MeshStandardMaterial({
    map: createTableTexture(),
    roughness: 0.76,
    metalness: 0.16,
    envMapIntensity: 0.35   // 只给桌面一点环境光，太强会盖掉丝绒质感
  });
  const top = new THREE.Mesh(topGeo, topMat);
  top.rotation.x = -Math.PI / 2;
  scene.add(top);

  // 裙边：开口圆柱，自上而下收窄（R → 0.93R）并加深，形成厚重台基
  const skirtGeo = new THREE.CylinderGeometry(R, R * 0.93, CFG.tableThickness, 96, 1, true);
  const skirtMat = new THREE.MeshStandardMaterial({
    map: createSkirtTexture(), roughness: 0.92, metalness: 0.05,
    side: THREE.DoubleSide
  });
  const skirt = new THREE.Mesh(skirtGeo, skirtMat);
  skirt.position.y = -CFG.tableThickness / 2;
  scene.add(skirt);

  // 底部封盖：避免俯视以外的角度看穿台基
  const base = new THREE.Mesh(
    new THREE.CircleGeometry(R * 0.93, 96),
    new THREE.MeshStandardMaterial({ color: 0x0a0518, roughness: 1 })
  );
  base.rotation.x = Math.PI / 2;
  base.position.y = -CFG.tableThickness;
  scene.add(base);

  // 口沿金环（加粗）
  tableRimMat = new THREE.MeshStandardMaterial({
    color: 0xe8c56b, emissive: 0x8a5a12, emissiveIntensity: 0.55,
    roughness: 0.28, metalness: 0.9, envMapIntensity: 1.25
  });
  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(R + 0.02, 0.075, 14, 128),
    tableRimMat
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.01;
  scene.add(rim);

  // 内圈细刻环：与口沿形成双描边，桌面更有"法坛"层次
  const innerRing = new THREE.Mesh(
    new THREE.TorusGeometry(R * 0.895, 0.013, 8, 128),
    new THREE.MeshStandardMaterial({
      color: 0xe8c56b, emissive: 0x5a3a08, emissiveIntensity: 0.5,
      roughness: 0.38, metalness: 0.9, envMapIntensity: 1.15
    })
  );
  innerRing.rotation.x = Math.PI / 2;
  innerRing.position.y = 0.004;
  scene.add(innerRing);

  // 底沿金箍（v1.3.7）：让加厚后的侧裙有收口，像一个真正的祭坛而非一块厚饼
  const bottomBand = new THREE.Mesh(
    new THREE.TorusGeometry(R * 0.94, 0.035, 10, 128),
    new THREE.MeshStandardMaterial({
      color: 0xe8c56b, emissive: 0x4a2e06, emissiveIntensity: 0.4,
      roughness: 0.34, metalness: 0.9, envMapIntensity: 1.0
    })
  );
  bottomBand.rotation.x = Math.PI / 2;
  bottomBand.position.y = -CFG.tableThickness + 0.03;
  scene.add(bottomBand);
}

function createStars() {
  const count = CFG.starCount;
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const phases = new Float32Array(count);
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
    phases[i] = Math.random() * Math.PI * 2;   // 每颗星独立的闪烁相位
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setAttribute('phase', new THREE.BufferAttribute(phases, 1));

  // v1.5.3：逐星闪烁 —— 用极轻量的 ShaderMaterial 给每颗星独立的相位，
  // 避免整片星空同步呼吸（那样看起来像一张在闪的贴纸）。
  starMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uSize: { value: 0.145 },
      uPixelRatio: { value: renderer.getPixelRatio() },
      uMap: { value: createStarTexture() }
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      attribute vec3 color;
      attribute float phase;
      varying vec3 vColor;
      varying float vAlpha;
      uniform float uTime;
      uniform float uSize;
      uniform float uPixelRatio;
      void main() {
        vColor = color;
        vAlpha = 0.30 + 0.70 * (0.5 + 0.5 * sin(uTime * 1.9 + phase));
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = uSize * uPixelRatio * (600.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vAlpha;
      uniform sampler2D uMap;
      void main() {
        vec4 tex = texture2D(uMap, gl_PointCoord);
        float a = tex.a * vAlpha;
        if (a < 0.01) discard;
        gl_FragColor = vec4(vColor, a);
      }
    `
  });

  starPoints = new THREE.Points(geo, starMat);
  scene.add(starPoints);
}

/** 星点贴图：中心亮、边缘透明的白色圆点（64²，一次生成） */
function createStarTexture() {
  const size = 64;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.32, 'rgba(255,255,255,0.68)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** 柔光点精灵贴图：中心亮、边缘透明的圆形光点 */
function createMoteTexture() {
  const size = 64;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,246,220,1)');
  grad.addColorStop(0.28, 'rgba(240,205,130,0.8)');
  grad.addColorStop(1, 'rgba(240,205,130,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
}

/**
 * 桌面浮尘：缓慢上升的金色微粒。
 *
 * 牌桌静止时画面是"死"的，加一层浮尘立刻有呼吸感。
 * 用点精灵（Points）+ 单张贴图，按帧只改 position 数组，
 * 130 个点约 390 个 float 写入，开销可忽略；
 * 粒子的角度/半径/相位都预存在 TypedArray 里，避免每帧新建对象。
 */
function createMotes() {
  const n = CFG.moteCount;
  const positions = new Float32Array(n * 3);
  const speed = new Float32Array(n);
  const phase = new Float32Array(n);
  const angle = new Float32Array(n);
  const radius = new Float32Array(n);
  const baseY = new Float32Array(n);

  for (let i = 0; i < n; i++) {
    angle[i] = Math.random() * Math.PI * 2;
    // sqrt 分布：保证在圆面积上均匀，否则粒子会往圆心堆
    radius[i] = Math.sqrt(Math.random()) * CFG.tableRadius * 1.35;
    baseY[i] = Math.random() * CFG.moteTop;
    speed[i] = CFG.moteRise * (0.55 + Math.random() * 0.9);
    phase[i] = Math.random() * Math.PI * 2;
    positions[i * 3] = Math.cos(angle[i]) * radius[i];
    positions[i * 3 + 1] = baseY[i];
    positions[i * 3 + 2] = Math.sin(angle[i]) * radius[i];
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  motePoints = new THREE.Points(geo, new THREE.PointsMaterial({
    map: createMoteTexture(),
    size: 0.17,
    color: 0xf5dfa0,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true
  }));
  motePoints.renderOrder = 3;
  scene.add(motePoints);
  moteData = { positions, speed, phase, angle, radius, baseY };
}

/** 浮尘动画：上升 → 到顶回底；同时叠加微小横向摆动，避免直上直下的机械感 */
function updateMotes(dt) {
  if (!motePoints || !moteData) return;
  const { positions, speed, phase, angle, radius, baseY } = moteData;
  const n = speed.length;
  for (let i = 0; i < n; i++) {
    baseY[i] += speed[i] * dt;
    if (baseY[i] > CFG.moteTop) baseY[i] -= CFG.moteTop;   // 循环，不做对象回收
    const a = angle[i] + elapsed * 0.045;                  // 整体缓慢绕轴公转
    const sway = Math.sin(elapsed * 0.7 + phase[i]) * 0.09;
    positions[i * 3] = Math.cos(a) * radius[i] + sway;
    positions[i * 3 + 1] = baseY[i];
    positions[i * 3 + 2] = Math.sin(a) * radius[i] + sway;
  }
  motePoints.geometry.attributes.position.needsUpdate = true;
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

  // 中心柔光（v1.3.7 大幅压低）：普通混合下这层柔光会把整张桌面提亮成"牛奶紫"，
  // 只保留一点点中心聚光感，让符文与桌面纹理保持清晰。
  const glow = g.createRadialGradient(cx, cy, 0, cx, cy, size * 0.5);
  glow.addColorStop(0, GOLD + '0.06)');
  glow.addColorStop(0.45, GOLD + '0.02)');
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

/** 扩散光环贴图：一圈柔边亮带（用于从阵心向外推的波纹） */
function createRippleTexture() {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const cx = size / 2;
  const grad = g.createRadialGradient(cx, cx, size * 0.30, cx, cx, size * 0.5);
  grad.addColorStop(0, 'rgba(240,205,130,0)');
  grad.addColorStop(0.5, 'rgba(240,205,130,0.45)');
  grad.addColorStop(0.72, 'rgba(255,238,190,0.95)');
  grad.addColorStop(0.88, 'rgba(240,205,130,0.32)');
  grad.addColorStop(1, 'rgba(240,205,130,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(c);
}

function createMagicSymbols() {
  // 光晕圆盘（比桌面略大，形成"祭坛辉光"）
  // v1.3.7：半径 2.6R → 2.2R、透明度 0.9 → 0.42。原参数让整张桌面蒙上一层蓝紫
  // 雾光，卡牌与符文线条都被洗淡；现在只保留一层克制的环境辉光。
  const glowGeo = new THREE.PlaneGeometry(CFG.tableRadius * 2.2, CFG.tableRadius * 2.2);
  const glowMat = new THREE.MeshBasicMaterial({
    map: createGlowTexture(),
    transparent: true,
    opacity: 0.42,
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
  // v1.3.7：改用普通混合 —— 加法混合会把符文线条糊成一片光雾，普通混合保留锐利笔锋。
  const circleGeo = new THREE.PlaneGeometry(CFG.circleRadius * 2, CFG.circleRadius * 2);
  const circleMat = new THREE.MeshBasicMaterial({
    map: createMagicCircleTexture(),
    transparent: true,
    opacity: 0.88,
    depthWrite: false,
    blending: THREE.NormalBlending
  });
  magicCircle = new THREE.Mesh(circleGeo, circleMat);
  magicCircle.rotation.x = -Math.PI / 2;
  magicCircle.position.y = CFG.circleY;
  magicCircle.renderOrder = 2;
  scene.add(magicCircle);

  // 扩散光环：两枚相位错开的波纹，从阵心周期性向外推出后消隐，
  // 让静止的阵盘有"魔力在流动"的动势（阵盘自转 + 呼吸之外的第二层动效）
  const rippleGeo = new THREE.PlaneGeometry(1, 1);
  const rippleTex = createRippleTexture();
  for (let i = 0; i < 2; i++) {
    const mat = new THREE.MeshBasicMaterial({
      map: rippleTex, transparent: true, opacity: 0,
      depthWrite: false, blending: THREE.AdditiveBlending
    });
    const ring = new THREE.Mesh(rippleGeo, mat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = CFG.circleY + 0.004;
    ring.renderOrder = 3;
    ring.userData = { t: i * 0.5 };      // 相位错开半周期
    scene.add(ring);
    rippleRings.push(ring);
  }

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
    // 呼吸区间随普通混合收敛：0.80~0.96，避免旋转时忽明忽暗
    magicCircle.material.opacity = 0.88 + Math.sin(elapsed * 0.9) * 0.08;
  }
  if (glowDisc) {
    glowDisc.material.opacity = 0.38 + Math.sin(elapsed * 0.6) * 0.06;
  }

  // 扩散光环：t 在 0~1 之间循环，t=0.5 时最亮，随半径扩大而淡出
  if (rippleRings.length) {
    const period = 3.2;                       // 每 3.2 秒推出一圈
    for (const r of rippleRings) {
      const u = r.userData;
      u.t += dt / period;
      if (u.t >= 1) u.t -= 1;
      const s = 4.0 + u.t * 10.4;             // 光环半径约 1.4 → 5.2，正好扫过整张牌桌
      r.scale.set(s, s, 1);
      // 加法混合叠加在发光阵盘之上，峰值必须压得很低，否则整张桌子会被冲白
      r.material.opacity = Math.sin(u.t * Math.PI) * 0.14;
    }
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

/** 圆角矩形路径（不依赖 ctx.roundRect，保证老内核也能画） */
function roundRectPath(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/** 卡牌圆角遮罩：白色圆角矩形，作为 alphaMap 把直角平面"切"成圆角牌 */
function createCardAlphaMask() {
  const w = 256;
  const h = Math.round(w * CFG.cardH / CFG.cardW);   // 与牌保持一致的长宽比
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  roundRectPath(g, 1, 1, w - 2, h - 2, Math.round(CFG.cardCorner / CFG.cardW * w));
  g.fill();
  const tex = new THREE.CanvasTexture(c);
  return tex;
}

/** 接触投影贴图：中心浓、边缘柔化的椭圆，垫在牌下方制造"落地感" */
function createShadowTexture() {
  const pw = CFG.cardW * 1.55, ph = CFG.cardH * 1.2;
  const w = 256, h = Math.round(w * ph / pw);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.translate(w / 2, h / 2);
  g.scale(w / h, 1);                    // 横向压扁成椭圆，匹配牌的竖长比例
  const grad = g.createRadialGradient(0, 0, 0, 0, 0, h / 2);
  grad.addColorStop(0, 'rgba(0,0,0,0.62)');
  grad.addColorStop(0.5, 'rgba(0,0,0,0.3)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.beginPath();
  g.arc(0, 0, h / 2, 0, Math.PI * 2);
  g.fill();
  return new THREE.CanvasTexture(c);
}

/** 卡牌辉光贴图：柔和的金色径向光斑（128²，全卡共享） */
function createCardGlowTexture() {
  const size = 128;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,232,170,0.9)');
  grad.addColorStop(0.42, 'rgba(232,197,107,0.32)');
  grad.addColorStop(1, 'rgba(232,197,107,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** 卡背贴图 + 共享几何/材质（跨牌复用，避免重复创建） */
function ensureCardShared() {
  if (planeGeo) return;
  planeGeo = new THREE.PlaneGeometry(CFG.cardW, CFG.cardH, 2, 3);

  // 圆角遮罩与投影都是"每局都不变"的资源，只建一次并由全部卡牌共享
  cardAlphaMask = createCardAlphaMask();
  shadowGeo = new THREE.PlaneGeometry(CFG.cardW * 1.55, CFG.cardH * 1.2);
  shadowMat = new THREE.MeshBasicMaterial({
    map: createShadowTexture(),
    transparent: true,
    opacity: 1,
    depthWrite: false
  });

  // v1.5.3 卡牌辉光：悬停 / 翻牌时在牌下晕开一圈金光（每张牌独立材质才能独立淡入淡出）
  cardGlowGeo = new THREE.PlaneGeometry(CFG.cardW * 2.1, CFG.cardH * 1.45);
  cardGlowBaseMat = new THREE.MeshBasicMaterial({
    map: createCardGlowTexture(),
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide
  });

  // 卡背：分辨率提到 256×448（原 128×224 在近景下边框发虚），
  // 并补一层斜向菱格暗纹 —— 纯渐变在近处看着太空
  const c = document.createElement('canvas');
  c.width = 256; c.height = 448;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, c.width * 0.35, c.height);
  grad.addColorStop(0, '#412c76');
  grad.addColorStop(0.45, '#1d1140');
  grad.addColorStop(1, '#2c1b55');
  g.fillStyle = grad;
  g.fillRect(0, 0, c.width, c.height);

  // 斜向菱格暗纹（两组平行线交叉），只在牌面内部
  g.save();
  g.beginPath(); g.rect(18, 18, c.width - 36, c.height - 36); g.clip();
  g.strokeStyle = 'rgba(180,150,255,0.13)';
  g.lineWidth = 1.4;
  const gap = 22;
  for (let d = -c.height; d < c.width + c.height; d += gap) {
    g.beginPath(); g.moveTo(d, 0); g.lineTo(d + c.height, c.height); g.stroke();
    g.beginPath(); g.moveTo(d, c.height); g.lineTo(d + c.height, 0); g.stroke();
  }
  g.restore();

  // 双线金边
  g.strokeStyle = 'rgba(240,205,130,0.95)';
  g.lineWidth = 8;
  g.strokeRect(4, 4, c.width - 8, c.height - 8);
  g.strokeStyle = 'rgba(240,205,130,0.4)';
  g.lineWidth = 2;
  g.strokeRect(14, 14, c.width - 28, c.height - 28);

  for (let i = 0; i < 70; i++) {
    g.fillStyle = 'rgba(240,228,255,' + (Math.random() * 0.6 + 0.25).toFixed(3) + ')';
    g.beginPath();
    g.arc(Math.random() * c.width, Math.random() * c.height, Math.random() * 1.4 + 0.3, 0, Math.PI * 2);
    g.fill();
  }

  // 卡背中心：同心圆 + 八向光芒 + 星点，呼应桌面魔法阵
  const cx = c.width / 2, cy = c.height / 2;
  g.strokeStyle = 'rgba(232,197,107,0.8)';
  g.lineWidth = 3;
  g.beginPath(); g.arc(cx, cy, 44, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 2;
  g.beginPath(); g.arc(cx, cy, 30, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 1.4;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * 32, cy + Math.sin(a) * 32);
    g.lineTo(cx + Math.cos(a) * 42, cy + Math.sin(a) * 42);
    g.stroke();
  }
  g.fillStyle = 'rgba(250,230,170,0.95)';
  g.beginPath(); g.arc(cx, cy, 8, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(255,245,215,0.9)';
  g.beginPath(); g.arc(cx - 3, cy - 3, 3.4, 0, Math.PI * 2); g.fill();
  // 上/下各一枚符文，与桌面符文环呼应
  g.strokeStyle = 'rgba(232,197,107,0.62)';
  g.lineWidth = 3;
  drawRune(g, 20, cx, c.height * 0.79, 40, 3);   // ᛚ Laguz：水之流，寓意直觉
  drawRune(g, 2, cx, c.height * 0.21, 34, 3);    // ᚦ Thurisaz

  const backTex = new THREE.CanvasTexture(c);
  backTex.colorSpace = THREE.SRGBColorSpace;
  backTex.anisotropy = 4;
  backMat = new THREE.MeshStandardMaterial({
    map: backTex, roughness: 0.66, metalness: 0.12,
    envMapIntensity: 0.6,
    // v1.3.7：自发光 0.28 → 0.40。卡背在主光背面，原亮度下细节几乎看不见
    emissive: 0x241344, emissiveIntensity: 0.4,
    alphaMap: cardAlphaMask, alphaTest: 0.5       // 圆角：alphaMap + alphaTest 裁掉直角
  });
}

/** 牌面贴图（按图名缓存，避免同一张牌重复解码） */
let texLoader = null;
function getFrontTexture(img) {
  let t = frontTexCache.get(img);
  if (t) return t;
  // 复用同一个 loader：原实现每次调用都 new 一个，纯属多余分配
  if (!texLoader) texLoader = new THREE.TextureLoader();
  t = texLoader.load('assets/cards/' + img);
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

  // v1.3.7：按牌阵实际铺开半径收放相机。
  // 单张牌阵仍用全景会让牌在巨大桌面上显得很小；这里只做"距离"缩放，
  // 视角方向完全不变（仍是固定视角，不引入任何拖拽/滚轮交互）。
  let extent = 0;
  for (const s of slots) extent = Math.max(extent, Math.hypot(s.x, s.z));
  const t = Math.min(1, Math.max(0, (extent - 1.0) / 2.9));
  camScaleTarget = 0.88 + 0.12 * t;

  draw.forEach((d, i) => {
    const s = slots[i] || { x: 0, z: 0, y: CFG.cardY, rotY: 0 };
    const group = new THREE.Group();
    // v1.5.1：高密度牌阵（生命之树 / 七脉轮）缩小卡牌，保证同列不重叠
    const cardScale = spread.layout === 'tree' ? 0.68
      : spread.layout === 'chakra' ? 0.60
      : spread.layout === 'celtic' ? 0.95
      : 1;
    group.scale.setScalar(cardScale);
    // flipper：只承载"翻牌"这一个自由度，与外层的落位/倾倒解耦
    const flipper = new THREE.Group();

    // 背面（初始朝上）：normal +y
    const backMesh = new THREE.Mesh(planeGeo, backMat);
    backMesh.position.y = 0.002;
    // 正面（初始朝下）：normal -y；翻转后朝上
    const frontMat = new THREE.MeshStandardMaterial({
      map: getFrontTexture(d.card.img),
      // 牌面按"印刷纸卡"处理：中等粗糙度 + 低金属度，强高光会把画面洗白
      roughness: 0.6,
      metalness: 0.08,
      envMapIntensity: 0.25,   // 环境反射仅作极轻微补光，不影响卡面色彩
      alphaMap: cardAlphaMask, alphaTest: 0.5
    });
    const frontMesh = new THREE.Mesh(planeGeo, frontMat);
    frontMesh.rotation.x = Math.PI;
    frontMesh.position.y = -0.002;
    // 逆位：翻上来后整张 180° 倒置
    if (d.orientation === 'reversed') frontMesh.rotation.z = Math.PI;

    flipper.add(backMesh);
    flipper.add(frontMesh);
    group.add(flipper);

    // 接触投影：挂在 group 上（不随 flipper 翻转，牌翻面时投影不动），
    // 每帧把它的 localZ 校正到「世界高度 = CFG.shadowY」，使其始终贴在桌面而不是跟着浮起
    const shadow = new THREE.Mesh(shadowGeo, shadowMat);
    shadow.visible = false;         // 落牌完成前不显示，避免影子先于牌出现
    // 叠放在其他牌之上的牌（如凯尔特十字的挑战位）不投影，否则两张影子共面会闪烁
    const elevated = (s.y !== undefined ? s.y : CFG.cardY) > CFG.cardY + 0.005;
    if (!elevated) group.add(shadow);

    const card = {
      group,
      flipper,
      frontMesh,                          // 仅用于卸载时释放其独占材质
      shadow,
      hitMeshes: [backMesh, frontMesh],   // 射线拾取用
      index: i,
      slot: { x: s.x, z: s.z, y: s.y !== undefined ? s.y : CFG.cardY, rotY: s.rotY || 0 },
      flipped: false,
      dealt: false,
      animating: false,
      cardScale: cardScale,
      hoverY: 0,
      glow: null,
      glowMat: null,
      glowLevel: 0
    };

    // v1.5.3 卡牌辉光：贴在桌面（不随卡牌抬起），悬停/翻牌时淡入并轻微呼吸
    const glowMat = cardGlowBaseMat.clone();
    glowMat.opacity = 0;
    const glow = new THREE.Mesh(cardGlowGeo, glowMat);
    glow.rotation.x = -Math.PI / 2;
    glow.rotation.z = card.slot.rotY;
    glow.position.set(card.slot.x, 0.0105, card.slot.z);
    glow.scale.setScalar(cardScale);
    glow.renderOrder = 2;
    scene.add(glow);
    card.glow = glow;
    card.glowMat = glowMat;

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
    if (c.glow) scene.remove(c.glow);
    if (c.glowMat) c.glowMat.dispose();   // 克隆材质独占；map 为共享资源，不在此释放
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
    const lift = CFG.flipLift * (c.cardScale || 1);   // 小尺寸牌阵按比例降低抬升
    c.group.position.y = c.slot.y + Math.sin(a.t * Math.PI) * lift + c.hoverY;
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

/** 悬停拾取：把高频 pointermove 合并到每帧一次
 *
 * 高刷屏上 pointermove 可达 120Hz+，每次都对全部卡牌做一次射线求交是纯浪费；
 * 这里只记录最新位置，交由 rAF 统一处理（每帧最多一次）。
 */
function onPointerMove(e) {
  hoverPending = { clientX: e.clientX, clientY: e.clientY };
  if (!hoverRaf) hoverRaf = requestAnimationFrame(applyHover);
}

function applyHover() {
  hoverRaf = 0;
  if (disposed || !hoverPending || !renderer) return;
  const c = pickCard(hoverPending);
  hoverPending = null;
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
  hoverPending = null;               // 丢弃待处理的悬停，避免指针已离开仍被拾取
  cancelAnimationFrame(hoverRaf); hoverRaf = 0;
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

    // 接触投影：始终贴桌面，并随浮起高度略微放大（模拟光斑扩散、影子变淡的观感）
    if (c.shadow) {
      c.shadow.visible = c.dealt;
      if (c.dealt) {
        // 阴影是 group 的子节点，会被 group.scale 缩放；除以卡牌缩放才能保持贴桌面
        c.shadow.position.z = (CFG.shadowY - c.group.position.y) / (c.cardScale || 1);
        c.shadow.scale.setScalar(1 + (c.hoverY / CFG.hoverLift) * 0.16);
      }
    }

    // v1.5.3 卡牌辉光：悬停 / 翻牌时增强，平时保留一层很淡的底光
    if (c.glowMat) {
      const gTarget = (c === hoverCard) ? 0.55 : (c.animating ? 0.5 : 0.10);
      c.glowLevel += (gTarget - c.glowLevel) * 0.14;
      c.glowMat.opacity = c.glowLevel * (0.82 + 0.18 * Math.sin(elapsed * 2.2 + c.index));
    }
  }

  updateMagic(dt);
  updateMotes(dt);
  if (starPoints) starPoints.rotation.y += dt * 0.02;

  // v1.5.3 发光 / 闪烁：逐星时间、金环呼吸、卡背微光
  if (starMat) starMat.uniforms.uTime.value = elapsed;
  if (tableRimMat) tableRimMat.emissiveIntensity = 0.5 + 0.18 * Math.sin(elapsed * 1.2);
  if (backMat) backMat.emissiveIntensity = 0.36 + 0.1 * Math.sin(elapsed * 1.6);

  // 相机距离平滑过渡（只改远近，不改朝向）
  if (Math.abs(camScaleTarget - camScale) > 0.0004) {
    camScale += (camScaleTarget - camScale) * 0.07;
    camera.position.set(0, 9.4 * camScale, 10.3 * camScale);
    camera.lookAt(0, 0, 0.2);
  }

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
  if (starMat) starMat.uniforms.uPixelRatio.value = renderer.getPixelRatio();
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
  createEnvironment();   // v1.3.7：程序化环境反射（金属质感来源，零下载）
  createLights();
  createTable();
  createStars();
  createMotes();
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

  // 环境反射渲染目标不在 scene 图里，必须单独释放（否则每次进出 3D 泄漏一份 PMREM 贴图）
  if (envRT) { envRT.dispose(); envRT = null; }

  // 释放共享卡牌资源
  // （卡组已由 clearCards 移出场景，因此 scene.traverse 走不到它们，这里必须显式释放）
  if (planeGeo) { planeGeo.dispose(); planeGeo = null; }
  if (backMat) { if (backMat.map) backMat.map.dispose(); backMat.dispose(); backMat = null; }
  if (cardAlphaMask) { cardAlphaMask.dispose(); cardAlphaMask = null; }
  if (shadowGeo) { shadowGeo.dispose(); shadowGeo = null; }
  if (shadowMat) { if (shadowMat.map) shadowMat.map.dispose(); shadowMat.dispose(); shadowMat = null; }
  if (cardGlowGeo) { cardGlowGeo.dispose(); cardGlowGeo = null; }
  if (cardGlowBaseMat) {
    if (cardGlowBaseMat.map) cardGlowBaseMat.map.dispose();
    cardGlowBaseMat.dispose();
    cardGlowBaseMat = null;
  }
  for (const [, t] of frontTexCache) t.dispose();
  frontTexCache.clear();

  // 释放魔幻符号资源
  magicCircle = null;
  glowDisc = null;
  runeSprites.length = 0;
  // 扩散光环挂在场景里，geometry/material/map 已由 scene.traverse 释放，这里只清引用
  rippleRings.length = 0;
  for (const [, t] of runeTexCache) t.dispose();
  runeTexCache.clear();

  anims.length = 0;
  hoverCard = null;
  pointerDown = null;
  camScale = 1;            // 复位构图，下次挂载从全景开始
  camScaleTarget = 1;
  // ShaderMaterial 的贴图在 uniforms 里，scene.traverse 的通用释放扫不到，需单独释放
  if (starMat) {
    if (starMat.uniforms.uMap && starMat.uniforms.uMap.value) starMat.uniforms.uMap.value.dispose();
    starMat = null;
  }
  tableRimMat = null;
  cancelAnimationFrame(hoverRaf); hoverRaf = 0; hoverPending = null;
  texLoader = null;

  if (renderer) {
    renderer.dispose();
    if (renderer.domElement.parentNode) {
      renderer.domElement.parentNode.removeChild(renderer.domElement);
    }
    renderer = null;
  }

  camera = null;
  starPoints = null;
  // 浮尘挂在场景里，geometry / material / map 已由上面的 scene.traverse 释放，
  // 这里只需丢掉引用，避免下一局误用旧数据
  motePoints = null;
  moteData = null;
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