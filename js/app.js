/* ============================================================
 * 星穹塔罗 · 主逻辑
 * 模块划分：
 *   1. 常量与全局状态
 *   2. 工具函数
 *   3. 星空粒子背景
 *   4. 视图切换 / 弹窗 / Toast
 *   5. 牌阵选择与预览
 *   6. 抽牌流程（洗牌动画 / 翻牌）
 *   7. 解读结果（渲染 / 复制 / 保存）
 *   8. 历史记录
 *   9. 事件绑定与启动
 * ============================================================ */
'use strict';

/* ---------- 1. 常量与全局状态 ---------- */
const APP_VERSION = '1.3.5';
const STORAGE_KEY = 'starry-tarot-readings-v1';
const STORAGE_MAX = 30;   // 本地最多保留的解读条数
// 魔力源声明：按用户要求注明「魔力来自互联网」，并声明开发者不受反噬与诅咒
const MAGIC_NOTE = '✦ 本站魔力源来自互联网的星辰之力，虔诚即可得到回应 ✦';
const DISCLAIMER = '免责声明：塔罗仅为趣味娱乐，不构成人生、投资、重大决策建议。本站魔力不与开发者及合作者联通，开发者不受任何反噬与诅咒。';

const state = {
  spread: null,          // 当前牌阵对象
  draw: [],              // 当前抽牌结果 [{ card, orientation }]
  shuffled: false,       // 是否已完成洗牌
  flippedCount: 0,       // 已翻开张数
  readingDone: false     // 是否已生成完整解读
};

let spreadFilter = 'all'; // 牌阵列表当前筛选分类
let currentView = 'home'; // 当前所在视图（3D 流程判断用）

/* ---------- 2. 工具函数 ---------- */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

/** [min, max) 区间随机整数 */
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min)) + min;
}

/** 复制文本到剪贴板（含旧浏览器降级方案） */
function copyText(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text);
  }
  return new Promise((resolve, reject) => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); resolve(); }
    catch (e) { reject(e); }
    document.body.removeChild(ta);
  });
}

/** 格式化日期时间 */
function formatNow() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/* ---------- 3. 星空粒子背景 ---------- */
function initStarfield() {
  const canvas = $('#starfield');
  const ctx = canvas.getContext('2d');
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  // 系统开启「减少动效」时只渲染一帧静态星空：
  // 原有的 rAF 循环不受 CSS 的 prefers-reduced-motion 影响，会一直跑下去
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 三层星：由远及近 依次变大、变亮、漂移更快，拉开纵深。
  // 原实现 180 颗星半径/亮度全随机，看起来是一张"平贴纸"，没有空间感。
  const LAYERS = [
    { share: 0.55, rMin: 0.30, rMax: 0.80, alpha: 0.38, drift: 1.8 },
    { share: 0.31, rMin: 0.70, rMax: 1.30, alpha: 0.66, drift: 3.6 },
    { share: 0.14, rMin: 1.15, rMax: 2.00, alpha: 1.00, drift: 6.4 }
  ];
  const METEOR_MAX = 2;          // 同屏最多几颗流星
  const METEOR_RATE = 0.30;      // 每秒生成概率

  let cool = [];                 // 冷色星（按颜色分组，绘制时只需切换两次 fillStyle）
  let warm = [];                 // 暖金星
  let meteors = [];
  let w = 0, h = 0;
  let resizeTimer = null;
  let parX = 0, parY = 0;        // 指针视差当前偏移
  let parTX = 0, parTY = 0;      // 指针视差目标偏移

  /** 按视口尺寸重建星群（密度自适应，避免移动端过密） */
  function build() {
    canvas.width = w * DPR;
    canvas.height = h * DPR;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

    // 密度比 v1.3.4 提高（/9000 → /6000）：原先是 128 颗，现在 1280×900 下约 192 颗，
    // 配合三层视差才有"星海"的观感；上限 320 防止超宽屏过密
    const total = Math.min(320, Math.floor((w * h) / 6000));
    cool = [];
    warm = [];
    meteors.length = 0;

    for (const layer of LAYERS) {
      const n = Math.round(total * layer.share);
      for (let i = 0; i < n; i++) {
        const star = {
          x: Math.random() * w,
          y: Math.random() * h,
          r: layer.rMin + Math.random() * (layer.rMax - layer.rMin),
          base: layer.alpha * (0.55 + Math.random() * 0.45),
          speed: 0.004 + Math.random() * 0.016,          // 闪烁频率
          phase: Math.random() * Math.PI * 2,
          drift: layer.drift * (0.6 + Math.random() * 0.8)
        };
        (Math.random() < 0.16 ? warm : cool).push(star);
      }
    }
  }

  /** 生成一颗流星：从屏幕一侧斜穿到另一侧 */
  function spawnMeteor() {
    const dir = Math.random() < 0.5 ? 1 : -1;             // 1: 左上→右下；-1: 右上→左下
    const speed = 420 + Math.random() * 380;
    const angle = 0.30 + Math.random() * 0.22;            // 与水平线的夹角
    meteors.push({
      x: dir === 1 ? -w * 0.08 : w * 1.08,
      y: h * (0.03 + Math.random() * 0.4),
      vx: Math.cos(angle) * speed * dir,
      vy: Math.sin(angle) * speed,
      life: 1
    });
  }

  // 注意：这里刻意写成"显式两趟"而不是 for (const g of [cool, warm])，
  // 后者每帧都会新建一个临时数组——星空是常驻 rAF，这种小分配要避免
  function drawStarGroup(group, color, t) {
    ctx.fillStyle = color;
    for (let i = 0; i < group.length; i++) {
      const s = group[i];
      const tw = reduceMotion ? 1 : Math.sin(t * s.speed + s.phase) * 0.3 + 0.7;
      ctx.globalAlpha = Math.max(0.05, Math.min(1, s.base * tw));
      ctx.beginPath();
      ctx.arc(s.x + parX, s.y + parY, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawStars(t) {
    drawStarGroup(cool, '#e6dcff', t);
    drawStarGroup(warm, '#f5dfa0', t);
    ctx.globalAlpha = 1;
  }

  /** 星点缓慢下落，出屏后从顶部回收（对象的 x/y 复用，不新建） */
  function advanceStarGroup(group, dt) {
    for (let i = 0; i < group.length; i++) {
      const s = group[i];
      s.y += s.drift * dt;
      if (s.y > h + 4) { s.y = -4; s.x = Math.random() * w; }
    }
  }

  function drawMeteors(dt) {
    ctx.lineCap = 'round';
    for (let i = meteors.length - 1; i >= 0; i--) {
      const m = meteors[i];
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      m.life -= dt / 1.15;                                 // 约 1.15 秒生命
      if (m.life <= 0 || m.y > h + 120 || m.x < -260 || m.x > w + 260) {
        meteors.splice(i, 1);
        continue;
      }
      const len = 110 * Math.min(1, m.life);               // 拖尾随生命衰减
      const inv = 1 / Math.sqrt(m.vx * m.vx + m.vy * m.vy);
      const nx = m.vx * inv, ny = m.vy * inv;
      const a = m.life * 0.85;
      const g = ctx.createLinearGradient(m.x, m.y, m.x - nx * len, m.y - ny * len);
      g.addColorStop(0, 'rgba(255,246,220,' + a.toFixed(2) + ')');
      g.addColorStop(1, 'rgba(255,246,220,0)');
      ctx.strokeStyle = g;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(m.x, m.y);
      ctx.lineTo(m.x - nx * len, m.y - ny * len);
      ctx.stroke();
    }
  }

  /** 每帧推进：星点下落 → 出屏回顶；指针视差做惯性跟随 */
  function frame(t) {
    const dt = Math.min((t - (frame.last || t)) / 1000, 0.05);   // 秒；限幅避免切后台跳变
    frame.last = t;

    if (!reduceMotion) {
      advanceStarGroup(cool, dt);
      advanceStarGroup(warm, dt);
      parX += (parTX - parX) * 0.05;
      parY += (parTY - parY) * 0.05;
    }

    ctx.clearRect(0, 0, w, h);
    drawStars(t);
    if (!reduceMotion) {
      if (meteors.length < METEOR_MAX && Math.random() < METEOR_RATE * dt) spawnMeteor();
      drawMeteors(dt);
    }
    requestAnimationFrame(frame);
  }

  function onResize() {
    w = window.innerWidth;
    h = window.innerHeight;
    build();
    if (reduceMotion) { ctx.clearRect(0, 0, w, h); drawStars(0); }   // 静态模式下重绘一帧
  }

  // resize 会连续触发（拖拽窗口时每秒数十次），每次重建星群纯属浪费，防抖 150ms
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(onResize, 150);
  });

  // 指针视差：背景随鼠标轻微反向位移，静止画面也有层次。
  // 幅度刻意压得很小（±10px），避免影响文字阅读。
  if (!reduceMotion) {
    window.addEventListener('pointermove', (e) => {
      parTX = (e.clientX / w - 0.5) * -20;
      parTY = (e.clientY / h - 0.5) * -20;
    }, { passive: true });
  }

  onResize();
  if (!reduceMotion) requestAnimationFrame(frame);
}

/* ---------- 4. 视图切换 / 弹窗 / Toast ---------- */
const VIEWS = ['view-home', 'view-gallery', 'view-about', 'view-draw', 'view-reading', 'view-3d'];

/* ---------- 4.1 3D 模块按需加载 ---------- */
// v1.3.4 起 table3d.js 及其依赖的 Three.js 不再随首屏加载：
// 首屏省下约 1.28MB（Three.js 1.24MB + table3d 33KB + spreads3d 4KB），
// 代价是首次进入 3D 牌桌时多一次网络往返（模块已 gzip 至 166KB，且带一年 immutable 缓存）。
// 用 Promise 缓存保证并发调用只触发一次加载；失败时清空缓存以便下次重试。
let tarot3dPromise = null;
function ensureTarot3D() {
  if (!tarot3dPromise) {
    // 注意：动态 import() 在「经典脚本」中是以 **本脚本自身的 URL** 为基准解析相对路径的
    // （app.js 位于 /js/，若写 './js/3d/table3d.js' 会解析成 /js/js/3d/… 而 404）。
    // 这里显式用 document.baseURI 解析，语义清晰，也兼容把站点部署到子路径的情况。
    const url = new URL('js/3d/table3d.js?v=' + APP_VERSION, document.baseURI).href;
    tarot3dPromise = import(url)
      .then(() => true)
      .catch((err) => {
        console.warn('[3D] 模块加载失败：', err);
        tarot3dPromise = null;
        return false;
      });
  }
  return tarot3dPromise;
}

function showView(name) {
  const leaving3d = !document.getElementById('view-3d').classList.contains('hidden');
  const leavingDraw = !document.getElementById('view-draw').classList.contains('hidden');
  for (const v of VIEWS) {
    document.getElementById(v).classList.toggle('hidden', v !== 'view-' + name);
  }
  currentView = name;
  // 离开抽牌视图时清掉未完成的洗牌计时器，避免残留状态影响下一次占卜
  if (leavingDraw && name !== 'draw') clearDrawTimers();
  // 离开 3D 牌桌时释放 GPU 资源
  if (leaving3d && window.Tarot3D) window.Tarot3D.unmount();
  // 进入 3D 牌桌：按需加载 3D 模块后再挂载（WebGL 画布需要真实尺寸）
  if (name === '3d') {
    // 每次进入都先收起「全部翻开」：等落牌全部就位（tarot:alldealt）才重新露出
    $('#btn-3d-flip-all').classList.add('hidden');
    requestAnimationFrame(() => {
      ensureTarot3D().then((ok) => {
        if (currentView !== '3d') return;   // 加载期间用户已切走，不再挂载
        if (!ok || !window.Tarot3D) {
          showToast('当前浏览器不支持 3D 牌桌，已为你切换到 2D 占卜');
          setTimeout(() => { renderSpreadList(spreadFilter); openModal('modal-spreads'); }, 400);
          return;
        }
        window.Tarot3D.mount($('#tarot-table'));
      });
    });
  }
  if (name === 'gallery') renderGallery(); // 每次进入重渲染，重放入场动画
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

let toastTimer = null;
function showToast(msg, ms = 2200) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

/* ---------- 5. 牌阵选择与预览 ---------- */

/** 渲染牌阵列表（支持按主题分类筛选） */
function renderSpreadList(filter) {
  const list = $('#spread-list');
  list.innerHTML = '';
  const items = filter && filter !== 'all'
    ? TAROT_SPREADS.filter((s) => s.category === filter)
    : TAROT_SPREADS;
  for (const spread of items) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'spread-item';
    btn.innerHTML =
      `<span class="s-badge">${SPREAD_CATEGORIES[spread.category].label}</span>
       <span class="s-name">${spread.name}</span>
       <span class="s-count">${spread.count} 张</span>`;
    btn.addEventListener('click', () => openSpreadPreview(spread));
    list.appendChild(btn);
  }
}

/** 打开牌阵预览弹窗（含迷你布局图与牌阵信息） */
function openSpreadPreview(spread) {
  $('#preview-name').textContent = spread.name;
  $('#preview-desc').textContent = spread.desc;
  $('#preview-meta').innerHTML =
    `<span class="p-badge">${SPREAD_CATEGORIES[spread.category].label}</span>
     <span class="p-count">${spread.count} 张</span>`;
  $('#preview-info').innerHTML =
    `<div class="p-info-item"><span class="p-info-lbl">适用场景</span><p>${spread.info.scene}</p></div>
     <div class="p-info-item"><span class="p-info-lbl">解读要点</span><p>${spread.info.tip}</p></div>`;
  const box = $('#preview-layout');
  box.innerHTML = '';
  box.className = 'preview-layout layout-' + spread.layout;
  box.appendChild(buildPreviewSlots(spread));
  $('#btn-start-draw').onclick = () => {
    closeModal('modal-preview');
    if (currentView === '3d') start3dReading(spread); // 3D 视图内走 3D 落牌
    else startDraw(spread);
  };
  closeModal('modal-spreads');
  openModal('modal-preview');
}

/** 生成预览迷你布局 */
function buildPreviewSlots(spread) {
  const flexWrap = () => {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:12px;justify-content:center;';
    spread.positions.forEach((p) => wrap.appendChild(previewSlot(p.label)));
    return wrap;
  };
  if (spread.layout === 'row' || spread.layout === 'grid2' || spread.layout === 'hex' || spread.layout === 'year' || spread.layout === 'zodiac') {
    return flexWrap();
  }
  if (spread.layout === 'columns') {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:12px;';
    let start = 0;
    if (spread.positions.length % 2 === 1) {
      const top = document.createElement('div');
      top.style.cssText = 'display:flex;';
      top.appendChild(previewSlot(spread.positions[0].label));
      wrap.appendChild(top);
      start = 1;
    }
    const cols = document.createElement('div');
    cols.style.cssText = 'display:flex;gap:18px;';
    const left = document.createElement('div');
    left.style.cssText = 'display:flex;flex-direction:column;gap:12px;';
    const right = document.createElement('div');
    right.style.cssText = 'display:flex;flex-direction:column;gap:12px;';
    const rest = spread.positions.length - start;
    const half = Math.ceil(rest / 2);
    for (let i = start; i < start + half; i++) left.appendChild(previewSlot(spread.positions[i].label));
    for (let i = start + half; i < spread.positions.length; i++) right.appendChild(previewSlot(spread.positions[i].label));
    cols.appendChild(left);
    cols.appendChild(right);
    wrap.appendChild(cols);
    return wrap;
  }
  if (spread.layout === 'pyramid') {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:12px;';
    let idx = 0;
    let level = 1;
    while (idx < spread.positions.length) {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:12px;';
      for (let k = 0; k < level && idx < spread.positions.length; k++, idx++) {
        row.appendChild(previewSlot(spread.positions[idx].label));
      }
      wrap.appendChild(row);
      level++;
    }
    return wrap;
  }
  if (spread.layout === 'cross5') {
    return previewAreaGrid(spread, { center: 0, right: 1, left: 2, bottom: 3, top: 4 },
      "'. top .' 'left center right' '. bottom .'");
  }
  if (spread.layout === 'horseshoe') {
    return previewAreaGrid(spread, { a: 0, b: 1, c: 2, d: 3, e: 4, f: 5, g: 6 },
      "'a . g' 'b . f' 'c d e'");
  }
  if (spread.layout === 'triangle') {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:12px;';
    const row1 = document.createElement('div');
    row1.style.cssText = 'display:flex;gap:12px;';
    const row2 = document.createElement('div');
    row2.style.cssText = 'display:flex;gap:12px;';
    [0].forEach(() => { row1.appendChild(previewSlot(spread.positions[2].label)); });
    [0, 1].forEach((k) => { row2.appendChild(previewSlot(spread.positions[k].label)); });
    wrap.appendChild(row1);
    wrap.appendChild(row2);
    return wrap;
  }
  if (spread.layout === 'celtic') {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;gap:24px;align-items:center;flex-wrap:wrap;justify-content:center;';
    const cross = document.createElement('div');
    cross.style.cssText = 'position:relative;display:grid;grid-template-columns:repeat(3,auto);grid-template-rows:repeat(3,auto);gap:10px;align-items:center;justify-items:center;padding:20px;';
    const areas = { 4: 'top', 3: 'left', 0: 'center', 5: 'right', 2: 'base' };
    for (const k in areas) {
      const slot = document.createElement('div');
      slot.style.cssText = 'grid-area:' + areas[k] + ';';
      slot.appendChild(previewSlot(spread.positions[k].label));
      cross.appendChild(slot);
    }
    // 覆盖层（第 2 张·挑战）旋转 90° 置于中心
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);';
    const ovCard = document.createElement('div');
    ovCard.className = 'preview-card';
    ovCard.style.transform = 'rotate(90deg)';
    overlay.appendChild(ovCard);
    const ovLabel = document.createElement('span');
    ovLabel.className = 'pv-label';
    ovLabel.textContent = spread.positions[1].label;
    overlay.appendChild(ovLabel);
    cross.appendChild(overlay);
    const staff = document.createElement('div');
    staff.style.cssText = 'display:grid;grid-template-columns:repeat(2,auto);gap:10px;';
    for (let k = 6; k <= 9; k++) staff.appendChild(previewSlot(spread.positions[k].label));
    wrap.appendChild(cross);
    wrap.appendChild(staff);
    return wrap;
  }
  // single
  return previewSlot(spread.positions[0].label);
}

/** 用 grid-template-areas 生成预览（十字 / 马蹄铁等） */
function previewAreaGrid(spread, areaMap, template) {
  const grid = document.createElement('div');
  grid.style.cssText = 'display:grid;gap:12px;justify-items:center;align-items:center;';
  grid.style.gridTemplateAreas = template;
  for (const key in areaMap) {
    const slot = previewSlot(spread.positions[areaMap[key]].label);
    slot.style.gridArea = key;
    grid.appendChild(slot);
  }
  return grid;
}

function previewSlot(label) {
  const slot = document.createElement('div');
  slot.className = 'preview-slot';
  slot.innerHTML = '<div class="preview-card"></div><span class="pv-label">' + label + '</span>';
  return slot;
}

/* ---------- 5.5 塔罗画廊 ---------- */

const GALLERY_FILTERS = {
  all: { label: '全部', match: () => true },
  major: { label: '大阿卡纳', match: (c) => c.suit === 'major' },
  wands: { label: '权杖', match: (c) => c.suit === 'wands' },
  cups: { label: '圣杯', match: (c) => c.suit === 'cups' },
  swords: { label: '宝剑', match: (c) => c.suit === 'swords' },
  pentacles: { label: '星币', match: (c) => c.suit === 'pentacles' }
};

let galleryFilter = 'all';

/** 渲染画廊网格（按当前筛选）
 *
 * 点击不用「每张卡各绑一个监听」（78 个监听随每次重渲染反复创建/销毁），
 * 改为在 #gallery-grid 上用一次事件委托，靠 data-card-id 查表（见 initEvents）。
 * 查表复用 cards.js 已建好的 CARD_BY_ID（id → 卡牌对象），不再重复建索引。
 */
function renderGallery() {
  const grid = $('#gallery-grid');
  grid.innerHTML = '';
  const cards = TAROT_CARDS.filter(GALLERY_FILTERS[galleryFilter].match);
  cards.forEach((card, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'g-card';
    btn.dataset.cardId = card.id;
    btn.setAttribute('aria-label', card.name);
    btn.style.setProperty('--i', i);
    btn.innerHTML =
      `<span class="g-card-inner">
         <img src="assets/cards/${card.img}" alt="${card.name}" loading="lazy" decoding="async" />
         <span class="g-card-name">${card.name}</span>
         <span class="g-card-en">${card.nameEn}</span>
       </span>`;
    grid.appendChild(btn);
  });
}

/** 切换画廊筛选 */
function setGalleryFilter(filter) {
  galleryFilter = filter;
  $$('#gallery-filters .filter-chip').forEach((chip) => {
    const active = chip.dataset.filter === filter;
    chip.classList.toggle('active', active);
    chip.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  renderGallery();
}

/** 打开卡牌详情弹窗 */
function openCardDetail(card) {
  const box = $('#card-detail');
  box.innerHTML =
    `<img class="card-detail-img" src="assets/cards/${card.img}" alt="${card.name}" />
     <div>
       <div class="card-detail-head">
         <div class="card-detail-name">${card.name}</div>
         <span class="card-detail-en">${card.nameEn}</span>
       </div>
       <div class="card-detail-tags">
         <span class="card-tag">${GALLERY_FILTERS[card.suit].label}</span>
         ${card.arcana === 'minor' ? '<span class="card-tag">小阿卡纳</span>' : ''}
         ${card.keywords.map((k) => `<span class="card-tag">${k}</span>`).join('')}
       </div>
       <div class="card-detail-section">
         <h4>牌意</h4>
         <p>${card.meaning}</p>
       </div>
       <div class="card-detail-section card-detail-upright">
         <h4>正位</h4>
         <p>${card.upright}</p>
       </div>
       <div class="card-detail-section card-detail-reversed">
         <h4>逆位</h4>
         <p>${card.reversed}</p>
       </div>
     </div>`;
  openModal('modal-card');
}

/* ---------- 6. 抽牌流程 ---------- */

/** 从 78 张中随机抽取 count 张（不重复），随机正/逆位
 *
 * 只需抽 count 张，因此对副本做「部分 Fisher-Yates」——只洗前 count 个位置：
 * 相比原实现（全量洗 77 次 + slice 再 map），省掉两次数组分配和大量无用交换。
 * 副本仍是必需的：绝不能就地打乱 TAROT_CARDS，否则会污染画廊等其他视图。
 */
function drawCards(spread) {
  const pool = TAROT_CARDS.slice();
  const n = Math.min(spread.count, pool.length);
  const out = new Array(n);
  for (let i = 0; i < n; i++) {
    const j = i + randInt(0, pool.length - i);   // 在 [i, len) 中随机取一张
    const t = pool[i]; pool[i] = pool[j]; pool[j] = t;
    out[i] = {
      card: pool[i],
      orientation: Math.random() < 0.5 ? 'upright' : 'reversed' // 50% 正位 / 50% 逆位
    };
  }
  return out;
}

/** 开始占卜：进入抽牌视图并摆放卡牌（默认自动洗牌，无需手动点击） */
function startDraw(spread) {
  clearDrawTimers();          // 重开一局：先清掉上一局可能残留的洗牌计时器
  state.spread = spread;
  state.draw = drawCards(spread);
  state.shuffled = false;
  state.flippedCount = 0;
  state.readingDone = false;

  $('#draw-title').textContent = spread.name;
  $('#draw-desc').textContent = spread.desc;
  $('#btn-flip-all').classList.add('hidden');
  $('#btn-redeal').disabled = true;   // 洗牌未完成前禁止重开

  renderDrawLayout();
  showView('draw');
  autoShuffle();
}

/** 开始 3D 占卜：沿用抽牌/解读逻辑，仅把落牌交给 table3d */
function start3dReading(spread) {
  state.spread = spread;
  state.draw = drawCards(spread);
  state.shuffled = true;   // 3D 落牌即视为洗牌完成
  state.flippedCount = 0;
  state.readingDone = false;

  // 落牌依赖按需加载的 3D 模块：等待就绪后再落牌
  // （正常路径下进入 3D 视图时已加载完成，此处是并发点击时的兜底）
  ensureTarot3D().then((ok) => {
    if (currentView !== '3d' || !ok || !window.Tarot3D) return;
    window.Tarot3D.startReading(spread, state.draw);
    showToast('卡牌已落桌，点击翻牌 ✨');
  });
  // 「全部翻开」不在此时显示：未落位的牌会被 flipAllCards 跳过，
  // 过早露出按钮会让人"点了没反应"。改由 table3d 在全部牌落位后派发
  // tarot:alldealt 事件、在 initEvents 中统一露出（时序完全由真实动画驱动）。
}

/** 渲染抽牌区的卡牌（背面朝上） */
function renderDrawLayout() {
  const spread = state.spread;
  const container = $('#card-layout');
  container.className = 'card-layout layout-' + spread.layout;
  container.innerHTML = '';
  container.appendChild(buildCardsDom(spread, state.draw, true));
}

/** 布局注册表：每种布局对应一个渲染函数（数据驱动，新增布局只需在此登记） */
const LAYOUTS = {
  single(spread, draw, faceDown) {
    const wrap = document.createElement('div');
    wrap.className = 'layout-single';
    wrap.appendChild(makeSlot(spread, draw[0], 0, faceDown));
    return wrap;
  },
  row(spread, draw, faceDown) {
    const wrap = document.createElement('div');
    wrap.className = 'layout-row';
    draw.forEach((d, i) => wrap.appendChild(makeSlot(spread, d, i, faceDown)));
    return wrap;
  },
  grid2(spread, draw, faceDown) {
    const wrap = document.createElement('div');
    wrap.className = 'layout-grid2';
    draw.forEach((d, i) => wrap.appendChild(makeSlot(spread, d, i, faceDown)));
    return wrap;
  },
  triangle(spread, draw, faceDown) {
    const wrap = document.createElement('div');
    wrap.className = 'layout-triangle';
    const r1 = document.createElement('div');
    r1.className = 'row';
    r1.appendChild(makeSlot(spread, draw[2], 2, faceDown));
    const r2 = document.createElement('div');
    r2.className = 'row';
    r2.appendChild(makeSlot(spread, draw[0], 0, faceDown));
    r2.appendChild(makeSlot(spread, draw[1], 1, faceDown));
    wrap.appendChild(r1);
    wrap.appendChild(r2);
    return wrap;
  },
  hex(spread, draw, faceDown) {
    const wrap = document.createElement('div');
    wrap.className = 'layout-hex';
    draw.forEach((d, i) => wrap.appendChild(makeSlot(spread, d, i, faceDown)));
    return wrap;
  },
  year(spread, draw, faceDown) {
    const wrap = document.createElement('div');
    wrap.className = 'layout-year';
    draw.forEach((d, i) => wrap.appendChild(makeSlot(spread, d, i, faceDown)));
    return wrap;
  },
  celtic(spread, draw, faceDown) {
    return buildCeltic(spread, draw, faceDown);
  },
  /* ---- v1.2.0 新增布局 ---- */
  columns(spread, draw, faceDown) {
    const wrap = document.createElement('div');
    wrap.className = 'layout-columns';
    const cols = document.createElement('div');
    cols.className = 'cols';
    const left = document.createElement('div');
    left.className = 'col';
    const right = document.createElement('div');
    right.className = 'col';
    let start = 0;
    if (draw.length % 2 === 1) {
      // 奇数张：首张居中置顶（如二选一的"真实需求"）
      const top = document.createElement('div');
      top.className = 'row';
      top.appendChild(makeSlot(spread, draw[0], 0, faceDown));
      wrap.appendChild(top);
      start = 1;
    }
    const rest = draw.length - start;
    const half = Math.ceil(rest / 2);
    for (let i = start; i < start + half; i++) left.appendChild(makeSlot(spread, draw[i], i, faceDown));
    for (let i = start + half; i < draw.length; i++) right.appendChild(makeSlot(spread, draw[i], i, faceDown));
    cols.appendChild(left);
    cols.appendChild(right);
    wrap.appendChild(cols);
    return wrap;
  },
  pyramid(spread, draw, faceDown) {
    // 逐层堆叠：1-2-1 / 1-2-3-1 等，自适应张数
    const wrap = document.createElement('div');
    wrap.className = 'layout-pyramid';
    let idx = 0;
    let level = 1;
    while (idx < draw.length) {
      const row = document.createElement('div');
      row.className = 'row';
      for (let k = 0; k < level && idx < draw.length; k++, idx++) {
        row.appendChild(makeSlot(spread, draw[idx], idx, faceDown));
      }
      wrap.appendChild(row);
      level++;
    }
    return wrap;
  },
  cross5(spread, draw, faceDown) {
    // 十字形：中心 + 上 / 右 / 左 / 下
    const areas = { 0: 'center', 1: 'right', 2: 'left', 3: 'bottom', 4: 'top' };
    const grid = document.createElement('div');
    grid.className = 'cross5-grid';
    for (let i = 0; i < draw.length; i++) {
      const slot = makeSlot(spread, draw[i], i, faceDown);
      slot.classList.add('area-' + areas[i]);
      grid.appendChild(slot);
    }
    const wrap = document.createElement('div');
    wrap.className = 'layout-cross5';
    wrap.appendChild(grid);
    return wrap;
  },
  horseshoe(spread, draw, faceDown) {
    // 马蹄铁：U 形（左列向下 → 底部 → 右列向上）
    const areas = { 0: 'a', 1: 'b', 2: 'c', 3: 'd', 4: 'e', 5: 'f', 6: 'g' };
    const grid = document.createElement('div');
    grid.className = 'horseshoe-grid';
    for (let i = 0; i < draw.length; i++) {
      const slot = makeSlot(spread, draw[i], i, faceDown);
      slot.classList.add('area-' + areas[i]);
      grid.appendChild(slot);
    }
    const wrap = document.createElement('div');
    wrap.className = 'layout-horseshoe';
    wrap.appendChild(grid);
    return wrap;
  },
  zodiac(spread, draw, faceDown) {
    const wrap = document.createElement('div');
    wrap.className = 'layout-zodiac';
    draw.forEach((d, i) => wrap.appendChild(makeSlot(spread, d, i, faceDown)));
    return wrap;
  }
};

/** 构建卡牌 DOM。faceDown=true 时展示背面；否则展示正/逆位牌面 */
function buildCardsDom(spread, draw, faceDown) {
  const render = LAYOUTS[spread.layout];
  if (!render) {
    // 未知布局回退为单行
    const wrap = document.createElement('div');
    wrap.className = 'layout-row';
    draw.forEach((d, i) => wrap.appendChild(makeSlot(spread, d, i, faceDown)));
    return wrap;
  }
  return render(spread, draw, faceDown);
}

/** 凯尔特十字：十字（前 6 张）+ 柱列（后 4 张） */
function buildCeltic(spread, draw, faceDown) {
  const wrap = document.createElement('div');
  wrap.className = 'layout-celtic';

  const cross = document.createElement('div');
  cross.className = 'celtic-cross';
  // 网格区：0 现状=center，2 根基=base，3 过去=left，4 最佳目标=top，5 近期未来=right；1 挑战=覆盖层
  const areas = { 0: 'center', 2: 'base', 3: 'left', 4: 'top', 5: 'right' };
  [0, 2, 3, 4, 5].forEach((i) => {
    const slot = makeSlot(spread, draw[i], i, faceDown);
    slot.classList.add('slot-area-' + areas[i]);
    cross.appendChild(slot);
  });
  // 第 2 张（挑战）旋转 90° 覆盖在中心之上
  const overlay = makeSlot(spread, draw[1], 1, faceDown);
  overlay.classList.add('slot-overlay');
  cross.appendChild(overlay);

  const staff = document.createElement('div');
  staff.className = 'celtic-staff';
  for (let i = 6; i <= 9; i++) staff.appendChild(makeSlot(spread, draw[i], i, faceDown));

  wrap.appendChild(cross);
  wrap.appendChild(staff);
  return wrap;
}

/** 生成单个卡位：序号 + 卡牌(背/面) + 位置标签 */
function makeSlot(spread, d, index, faceDown) {
  const slot = document.createElement('div');
  slot.className = 'card-slot';

  const posIndex = document.createElement('span');
  posIndex.className = 'pos-index';
  posIndex.textContent = index + 1;

  const card = document.createElement('div');
  card.className = 'tarot-card';
  // 轻微随机倾斜，模拟手洗后的错落感
  const tilt = randInt(-6, 7);
  card.style.setProperty('--tilt', tilt + 'deg');

  const inner = document.createElement('div');
  inner.className = 'tarot-card-inner';

  const back = document.createElement('div');
  back.className = 'tarot-card-face tarot-card-back';
  back.setAttribute('aria-hidden', 'true');

  const front = document.createElement('div');
  front.className = 'tarot-card-face tarot-card-front';

  if (!faceDown) {
    // 展示牌面：逆位时图片旋转 180°
    const img = document.createElement('img');
    img.src = 'assets/cards/' + d.card.img;
    img.alt = d.card.name;
    if (d.orientation === 'reversed') img.classList.add('is-reversed');
    front.appendChild(img);

    const badge = document.createElement('span');
    badge.className = 'orient-badge' + (d.orientation === 'reversed' ? ' reversed' : '');
    badge.textContent = d.orientation === 'reversed' ? '逆位' : '正位';
    front.appendChild(badge);
  } else {
    front.style.background = '#140b2c';
  }

  inner.appendChild(back);
  inner.appendChild(front);
  card.appendChild(inner);

  if (!faceDown) card.classList.add('flipped');
  else card.dataset.drawIndex = index; // 翻牌时定位到对应卡位

  const label = document.createElement('div');
  label.className = 'pos-label';
  label.textContent = spread.positions[index].label;

  slot.appendChild(posIndex);
  slot.appendChild(card);
  slot.appendChild(label);
  return slot;
}

/* ---------- 6.1 洗牌（默认自动） ---------- */
// 计时器分开管理，避免「自动洗牌延迟」「洗牌抖动时长」「交错翻牌」互相干扰
let autoShuffleTimer = null;   // 进入抽牌视图 → 开始洗牌的延迟
let shuffleJumpTimer = null;   // 洗牌抖动动画时长
let flipAllRaf = 0;            // 「全部翻开」的交错翻牌循环句柄

/** 自动洗牌：稍作延迟，等卡牌落位动画（dealIn 0.5s）走完再抖动，观感更连贯 */
function autoShuffle() {
  clearTimeout(autoShuffleTimer);
  autoShuffleTimer = setTimeout(doShuffle, 420);
}

/** 洗牌动画：让所有卡牌跳动旋转约 1.2 秒后落定 */
function doShuffle() {
  autoShuffleTimer = null;
  if (state.shuffled || state.readingDone) return;
  const layout = $('#card-layout');
  if (!layout) return;
  const btnRedeal = $('#btn-redeal');
  layout.classList.add('shuffling');
  if (btnRedeal) btnRedeal.disabled = true;
  clearTimeout(shuffleJumpTimer);
  shuffleJumpTimer = setTimeout(() => {
    shuffleJumpTimer = null;
    layout.classList.remove('shuffling');
    if (state.readingDone) return;      // 洗牌期间已完成解读，不再改动界面
    state.shuffled = true;
    if (btnRedeal) btnRedeal.disabled = false;
    $('#btn-flip-all').classList.remove('hidden');
    showToast('牌已洗好，点击卡牌翻开 ✨');
  }, 1200);
}

/** 清理抽牌视图的计时器 / 交错翻牌循环 / 抖动状态（离开视图、重开一局时调用） */
function clearDrawTimers() {
  clearTimeout(autoShuffleTimer); autoShuffleTimer = null;
  clearTimeout(shuffleJumpTimer); shuffleJumpTimer = null;
  cancelAnimationFrame(flipAllRaf); flipAllRaf = 0;   // 中止未翻完的「全部翻开」
  const layout = $('#card-layout');
  if (layout) layout.classList.remove('shuffling');
}

/** 离开抽牌视图：清掉未完成的洗牌计时器，避免残留状态污染下一次占卜 */
function leaveDraw() {
  clearDrawTimers();
  showView('home');
}

/** 翻开单张卡牌
 *
 * 原地把牌面填进既有的正面层即可：卡位 DOM 本来就完整（背面 + 空的正面），
 * 原实现却 new 一个整卡位再 replaceChild —— 会丢弃并重建 5 个节点、触发重排，
 * 还得手动把 --tilt 和 slot-* 类名搬到新节点上。这里改为只补正面内容。
 */
function flipCard(cardEl) {
  if (!state.shuffled || cardEl.classList.contains('flipped')) return;
  const index = Number(cardEl.dataset.drawIndex);
  const d = state.draw[index];
  if (d === undefined) return;

  const front = cardEl.querySelector('.tarot-card-front');
  if (front && !front.firstChild) {
    const img = document.createElement('img');
    img.src = 'assets/cards/' + d.card.img;
    img.alt = d.card.name;
    img.decoding = 'async';
    if (d.orientation === 'reversed') img.classList.add('is-reversed');
    front.style.background = '';   // 去掉盖住正面的临时深色底，交回 CSS 的 --bg-card
    front.appendChild(img);

    const badge = document.createElement('span');
    badge.className = 'orient-badge' + (d.orientation === 'reversed' ? ' reversed' : '');
    badge.textContent = d.orientation === 'reversed' ? '逆位' : '正位';
    front.appendChild(badge);
  }

  // 双 rAF 确保浏览器先绘制背面，再翻面
  requestAnimationFrame(() => requestAnimationFrame(() => cardEl.classList.add('flipped')));

  state.flippedCount += 1;
  checkAllFlipped();
}

/** 全部翻开（逐张交错延迟）
 *
 * 用单个 rAF 循环做交错，替代 N 个 setTimeout：
 * 既省掉一批定时器，也能在「中途离开抽牌视图」时被 clearDrawTimers 整批中止。
 * （原实现下，离开视图后尚未触发的定时器仍会翻牌并累加 flippedCount，
 *   一旦凑满就会把用户从首页硬拽进解读视图。）
 */
function flipAll() {
  if (!state.shuffled) return;
  const cards = $$('#card-layout .tarot-card:not(.flipped)');
  if (!cards.length) return;
  const STEP = 130;
  let i = 0, t0 = 0;
  cancelAnimationFrame(flipAllRaf);
  flipAllRaf = requestAnimationFrame(function run(now) {
    if (!state.shuffled) { flipAllRaf = 0; return; }
    if (now - t0 >= STEP) {
      t0 = now;
      flipCard(cards[i++]);
    }
    flipAllRaf = i < cards.length ? requestAnimationFrame(run) : 0;
  });
}

/** 全部翻完后自动进入解读视图 */
function checkAllFlipped() {
  if (state.flippedCount >= state.spread.count && !state.readingDone) {
    state.readingDone = true;
    setTimeout(() => {
      renderReading();
      showView('reading');
    }, 700);
  }
}

/* ---------- 7. 解读结果 ---------- */

/** 渲染完整解读 */
function renderReading() {
  const spread = state.spread;
  $('#reading-title').textContent = '占卜结果 · ' + spread.name;
  $('#reading-date').textContent = formatNow();

  const box = $('#reading-cards');
  box.innerHTML = '';
  state.draw.forEach((d, i) => {
    const card = d.card;
    const item = document.createElement('article');
    item.className = 'reading-item';
    const img = document.createElement('img');
    img.src = 'assets/cards/' + card.img;
    img.alt = card.name;
    if (d.orientation === 'reversed') img.classList.add('is-reversed');

    const body = document.createElement('div');
    body.className = 'reading-body';

    const head = document.createElement('div');
    head.className = 'reading-head';
    head.innerHTML =
      `<span class="r-pos">${spread.positions[i].label}</span>
       <span class="r-name">${card.name}</span>
       <span class="r-en">${card.nameEn}</span>
       <span class="r-orient ${d.orientation}">${d.orientation === 'upright' ? '正位' : '逆位'}</span>`;

    const m = document.createElement('p');
    m.className = 'r-meaning';
    m.innerHTML = `<span class="lbl">含义：</span>${card.meaning}`;
    const u = document.createElement('p');
    u.className = 'r-upright';
    u.innerHTML = `<span class="lbl">${d.orientation === 'upright' ? '正位解读：' : '正位（未显现）：'}</span>${card.upright}`;
    const r = document.createElement('p');
    r.className = 'r-reversed';
    r.innerHTML = `<span class="lbl">${d.orientation === 'reversed' ? '逆位解读：' : '逆位（潜在影响）：'}</span>${card.reversed}`;

    body.appendChild(head);
    body.appendChild(m);
    body.appendChild(u);
    body.appendChild(r);
    item.appendChild(img);
    item.appendChild(body);
    box.appendChild(item);
  });
}

/** 生成可复制的解读文本 */
function buildReadingText(spread, draw, dateStr) {
  const lines = [`【星穹塔罗 · ${spread.name}】`, dateStr, ''];
  draw.forEach((d, i) => {
    const ori = d.orientation === 'upright' ? '正位' : '逆位';
    const txt = d.orientation === 'upright' ? d.card.upright : d.card.reversed;
    lines.push(`${i + 1}. ${spread.positions[i].label} · ${d.card.name}（${ori}）`);
    lines.push(`   ${txt}`);
  });
  lines.push('');
  lines.push(MAGIC_NOTE);
  lines.push(DISCLAIMER);
  return lines.join('\n');
}

/** 一键复制解读 */
function copyReading() {
  const text = buildReadingText(state.spread, state.draw, formatNow());
  copyText(text)
    .then(() => showToast('解读已复制到剪贴板 ⧉'))
    .catch(() => showToast('复制失败，请手动长按选择复制'));
}

/* ---------- 8. 历史记录（本地保存） ---------- */

function loadReadings() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch (e) { return []; }
}

function persistReadings(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, STORAGE_MAX)));
}

/** 保存当前解读到本地 */
function saveCurrentReading() {
  const list = loadReadings();
  const record = {
    id: Date.now().toString(36) + randInt(1000, 9999),
    date: formatNow(),
    spreadId: state.spread.id,
    spreadName: state.spread.name,
    count: state.draw.length,
    cards: state.draw.map((d, i) => ({
      position: state.spread.positions[i].label,
      orientation: d.orientation,
      name: d.card.name,
      nameEn: d.card.nameEn,
      img: d.card.img,
      meaning: d.card.meaning,
      upright: d.card.upright,
      reversed: d.card.reversed
    }))
  };
  list.unshift(record);
  persistReadings(list);
  showToast('解读已保存到本地 ⌁');
}

/** 渲染历史列表 */
function renderHistory() {
  const list = loadReadings();
  const box = $('#history-list');
  box.innerHTML = '';
  if (!list.length) {
    box.innerHTML = '<p class="history-empty">暂无记录，先去占卜一局吧 ☾</p>';
    return;
  }
  for (const rec of list) {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'history-item';
    item.innerHTML =
      `<span class="h-main">
         <span class="h-title">${rec.spreadName}</span>
         <span class="h-meta">${rec.date} · ${rec.count} 张</span>
       </span>
       <span class="h-del" title="删除">✕</span>`;
    item.querySelector('.h-del').addEventListener('click', (e) => {
      e.stopPropagation();
      removeReading(rec.id);
    });
    item.addEventListener('click', () => openDetail(rec));
    box.appendChild(item);
  }
}

function removeReading(id) {
  persistReadings(loadReadings().filter((r) => r.id !== id));
  renderHistory();
  showToast('已删除该记录');
}

function clearReadings() {
  if (!loadReadings().length) { showToast('暂无记录'); return; }
  localStorage.removeItem(STORAGE_KEY);
  renderHistory();
  showToast('已清空全部记录');
}

/** 打开历史解读详情 */
function openDetail(rec) {
  const box = $('#detail-content');
  box.innerHTML =
    `<div class="detail-head">
       <div class="d-title">${rec.spreadName}</div>
       <div class="d-date">${rec.date}</div>
     </div>`;
  rec.cards.forEach((c, i) => {
    const item = document.createElement('article');
    item.className = 'reading-item';
    const img = document.createElement('img');
    img.src = 'assets/cards/' + c.img;
    img.alt = c.name;
    if (c.orientation === 'reversed') img.classList.add('is-reversed');
    const body = document.createElement('div');
    body.className = 'reading-body';
    const head = document.createElement('div');
    head.className = 'reading-head';
    head.innerHTML =
      `<span class="r-pos">${c.position}</span>
       <span class="r-name">${c.name}</span>
       <span class="r-en">${c.nameEn}</span>
       <span class="r-orient ${c.orientation}">${c.orientation === 'upright' ? '正位' : '逆位'}</span>`;
    const m = document.createElement('p');
    m.className = 'r-meaning';
    m.innerHTML = `<span class="lbl">含义：</span>${c.meaning}`;
    const t = document.createElement('p');
    t.innerHTML = c.orientation === 'upright' ? c.upright : c.reversed;
    body.appendChild(head);
    body.appendChild(m);
    body.appendChild(t);
    item.appendChild(img);
    item.appendChild(body);
    box.appendChild(item);
  });

  $('#btn-detail-copy').onclick = () => {
    const text = buildDetailText(rec);
    copyText(text).then(() => showToast('已复制该解读 ⧉')).catch(() => showToast('复制失败'));
  };
  openModal('modal-detail');
}

/** 生成历史解读的复制文本 */
function buildDetailText(rec) {
  const lines = [`【星穹塔罗 · ${rec.spreadName}】`, rec.date, ''];
  rec.cards.forEach((c, i) => {
    const ori = c.orientation === 'upright' ? '正位' : '逆位';
    const txt = c.orientation === 'upright' ? c.upright : c.reversed;
    lines.push(`${i + 1}. ${c.position} · ${c.name}（${ori}）`);
    lines.push(`   ${txt}`);
  });
  lines.push('');
  lines.push(MAGIC_NOTE);
  lines.push(DISCLAIMER);
  return lines.join('\n');
}

/* ---------- 9. 事件绑定与启动 ---------- */
function initEvents() {
  // 首页按钮（画廊/关于/历史已有顶部导航入口，首页不重复放置）
  $('#btn-open-spreads').addEventListener('click', () => { renderSpreadList(spreadFilter); openModal('modal-spreads'); });
  $('#btn-quick-draw').addEventListener('click', () => startDraw(getSpread('single')));
  $('#btn-3d').addEventListener('click', () => showView('3d'));

  // 导航
  $$('[data-nav]').forEach((el) => {
    el.addEventListener('click', () => {
      const target = el.dataset.nav;
      if (target === 'spreads') { renderSpreadList(spreadFilter); openModal('modal-spreads'); }
      else if (target === 'history') { renderHistory(); openModal('modal-history'); }
      else if (target === '3d') { showView('3d'); }
      else if (target === 'gallery') { showView('gallery'); }
      else if (target === 'about') { showView('about'); }
      else if (target === 'home') { showView('home'); }
    });
  });

  // 3D 牌桌：WebGL 降级时引导回到 2D
  window.addEventListener('tarot:use2d', () => { renderSpreadList(spreadFilter); openModal('modal-spreads'); });
  $('#btn-3d-back').addEventListener('click', () => showView('home'));
  $('#btn-3d-spreads').addEventListener('click', () => { renderSpreadList(spreadFilter); openModal('modal-spreads'); });
  $('#btn-3d-flip-all').addEventListener('click', () => { if (window.Tarot3D) window.Tarot3D.flipAll(); });
  // 3D 全部卡牌落位：此刻「全部翻开」才真正可用（flipAllCards 会跳过未落位的牌）
  window.addEventListener('tarot:alldealt', () => {
    if (currentView === '3d' && !state.readingDone && !state.flippedCount) {
      $('#btn-3d-flip-all').classList.remove('hidden');
    }
  });
  // 3D 每翻开一张：计数，全部翻开后复用解读逻辑
  window.addEventListener('tarot:flip3d', () => {
    state.flippedCount += 1;
    if (state.flippedCount >= state.spread.count && !state.readingDone) {
      state.readingDone = true;
      $('#btn-3d-flip-all').classList.add('hidden');
      setTimeout(() => {
        renderReading();
        showView('reading');
      }, 700);
    }
  });

  // 牌阵分类筛选
  $$('#spread-filters .filter-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      spreadFilter = chip.dataset.filter;
      $$('#spread-filters .filter-chip').forEach((c) => {
        const active = c === chip;
        c.classList.toggle('active', active);
        c.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      renderSpreadList(spreadFilter);
    });
  });

  // 画廊筛选
  $$('#gallery-filters .filter-chip').forEach((chip) => {
    chip.addEventListener('click', () => setGalleryFilter(chip.dataset.filter));
  });
  // 画廊卡片点击：一次委托覆盖全部 78 张（重渲染后依然有效，无需重新绑定）
  // CARD_BY_ID 定义在 cards.js（该文件先于 app.js 加载）
  $('#gallery-grid').addEventListener('click', (e) => {
    const btn = e.target.closest('.g-card');
    if (!btn) return;
    const card = CARD_BY_ID[btn.dataset.cardId];
    if (card) openCardDetail(card);
  });

  // 抽牌视图
  // 「重新占卜」= 重新抽牌（startDraw 内部会自动洗牌），不需要再单独点一次洗牌
  $('#btn-redeal').addEventListener('click', () => { if (state.spread) startDraw(state.spread); });
  $('#btn-flip-all').addEventListener('click', flipAll);
  $('#card-layout').addEventListener('click', (e) => {
    const card = e.target.closest('.tarot-card');
    if (card) flipCard(card);
  });
  $('#btn-back-home').addEventListener('click', leaveDraw);

  // 解读视图
  $('#btn-copy').addEventListener('click', copyReading);
  $('#btn-save').addEventListener('click', saveCurrentReading);
  $('#btn-redraw').addEventListener('click', () => startDraw(state.spread));
  $('#btn-reading-home').addEventListener('click', () => showView('home'));

  // 弹窗关闭
  $$('.modal-close').forEach((btn) => {
    btn.addEventListener('click', () => closeModal(btn.dataset.close));
  });
  $$('.modal').forEach((modal) => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal(modal.id);
    });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') $$('.modal.open').forEach((m) => closeModal(m.id));
  });

  // 历史操作
  $('#btn-history-clear').addEventListener('click', clearReadings);

  // 页脚版本与页头徽标
  $('#footer-version').textContent = `星穹塔罗 v${APP_VERSION} · 纯前端 · 卡图素材来自公版 Rider-Waite（1909）`;
  $('#version-badge').textContent = `v${APP_VERSION}`;
}

function init() {
  initStarfield();
  initEvents();
  showView('home');
}

document.addEventListener('DOMContentLoaded', init);
