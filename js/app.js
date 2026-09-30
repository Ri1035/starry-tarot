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
const APP_VERSION = '1.3.2';
const STORAGE_KEY = 'starry-tarot-readings-v1';
const STORAGE_MAX = 30;   // 本地最多保留的解读条数
const DISCLAIMER = '免责声明：塔罗仅为趣味娱乐，不构成人生、投资、重大决策建议。';

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
  let stars = [];
  let w = 0, h = 0;

  function resize() {
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = w * DPR;
    canvas.height = h * DPR;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    // 按面积重建星群（密度自适应，避免移动端过密）
    const count = Math.min(180, Math.floor((w * h) / 9000));
    stars = [];
    for (let i = 0; i < count; i++) {
      stars.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.4 + 0.3,
        base: Math.random() * 0.5 + 0.25,
        speed: Math.random() * 0.02 + 0.004,
        phase: Math.random() * Math.PI * 2
      });
    }
  }

  function frame(t) {
    ctx.clearRect(0, 0, w, h);
    for (let i = 0; i < stars.length; i++) {
      const s = stars[i];
      const alpha = s.base + Math.sin(t * s.speed + s.phase) * 0.25;
      ctx.globalAlpha = Math.max(0.08, Math.min(1, alpha));
      ctx.fillStyle = i % 7 === 0 ? '#f5dfa0' : '#e6dcff';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(frame);
  }

  window.addEventListener('resize', resize);
  resize();
  requestAnimationFrame(frame);
}

/* ---------- 4. 视图切换 / 弹窗 / Toast ---------- */
const VIEWS = ['view-home', 'view-gallery', 'view-about', 'view-draw', 'view-reading', 'view-3d'];

function showView(name) {
  const leaving3d = !document.getElementById('view-3d').classList.contains('hidden');
  for (const v of VIEWS) {
    document.getElementById(v).classList.toggle('hidden', v !== 'view-' + name);
  }
  currentView = name;
  // 离开 3D 牌桌时释放 GPU 资源
  if (leaving3d && window.Tarot3D) window.Tarot3D.unmount();
  // 进入 3D 牌桌：等布局完成后再挂载（WebGL 画布需要真实尺寸）
  if (name === '3d') {
    requestAnimationFrame(() => {
      if (!window.Tarot3D) {
        showToast('当前浏览器不支持 3D 牌桌，已为你切换到 2D 占卜');
        setTimeout(() => { renderSpreadList(spreadFilter); openModal('modal-spreads'); }, 400);
        return;
      }
      window.Tarot3D.mount($('#tarot-table'));
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

/** 渲染画廊网格（按当前筛选） */
function renderGallery() {
  const grid = $('#gallery-grid');
  grid.innerHTML = '';
  const cards = TAROT_CARDS.filter(GALLERY_FILTERS[galleryFilter].match);
  cards.forEach((card, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'g-card';
    btn.setAttribute('aria-label', card.name);
    btn.style.setProperty('--i', i);
    btn.innerHTML =
      `<span class="g-card-inner">
         <img src="assets/cards/${card.img}" alt="${card.name}" loading="lazy" />
         <span class="g-card-name">${card.name}</span>
         <span class="g-card-en">${card.nameEn}</span>
       </span>`;
    btn.addEventListener('click', () => openCardDetail(card));
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

/** 从 78 张中随机抽取 count 张（不重复），随机正/逆位 */
function drawCards(spread) {
  const pool = TAROT_CARDS.slice(); // 浅拷贝一份索引，避免修改原始数据
  for (let i = pool.length - 1; i > 0; i--) {
    const j = randInt(0, i + 1);
    const t = pool[i]; pool[i] = pool[j]; pool[j] = t; // Fisher-Yates 洗牌
  }
  return pool.slice(0, spread.count).map((card) => ({
    card,
    orientation: Math.random() < 0.5 ? 'upright' : 'reversed' // 50% 正位 / 50% 逆位
  }));
}

/** 开始占卜：进入抽牌视图并摆放卡牌 */
function startDraw(spread) {
  state.spread = spread;
  state.draw = drawCards(spread);
  state.shuffled = false;
  state.flippedCount = 0;
  state.readingDone = false;

  $('#draw-title').textContent = spread.name;
  $('#draw-desc').textContent = spread.desc;
  $('#btn-flip-all').classList.add('hidden');
  $('#btn-shuffle').disabled = false;

  renderDrawLayout();
  showView('draw');
}

/** 开始 3D 占卜：沿用抽牌/解读逻辑，仅把落牌交给 table3d */
function start3dReading(spread) {
  state.spread = spread;
  state.draw = drawCards(spread);
  state.shuffled = true;   // 3D 落牌即视为洗牌完成
  state.flippedCount = 0;
  state.readingDone = false;

  $('#btn-3d-flip-all').classList.remove('hidden');
  if (window.Tarot3D) {
    window.Tarot3D.startReading(spread, state.draw);
    showToast('卡牌已落桌，点击翻牌 ✨');
  }
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

/** 洗牌动画：让所有卡牌跳动旋转约 1.4 秒后落定 */
function doShuffle() {
  if (state.shuffled) return;
  const layout = $('#card-layout');
  layout.classList.add('shuffling');
  $('#btn-shuffle').disabled = true;
  setTimeout(() => {
    layout.classList.remove('shuffling');
    state.shuffled = true;
    $('#btn-flip-all').classList.remove('hidden');
    showToast('牌已洗好，点击卡牌翻开 ✨');
  }, 1400);
}

/** 翻开单张卡牌 */
function flipCard(cardEl) {
  if (!state.shuffled || cardEl.classList.contains('flipped')) return;
  const index = Number(cardEl.dataset.drawIndex);
  const d = state.draw[index];
  if (d === undefined) return;

  // 用带牌面的完整卡位替换原卡位，并立即触发 3D 翻牌动画
  const slot = cardEl.closest('.card-slot');
  const fresh = makeSlot(state.spread, d, index, false);
  const newCard = fresh.querySelector('.tarot-card');
  newCard.dataset.drawIndex = index;
  // 保留原卡位的倾斜角度与网格区类名（slot-* / area-* 等）
  newCard.style.setProperty('--tilt', cardEl.style.getPropertyValue('--tilt'));
  for (const cls of slot.classList) fresh.classList.add(cls);
  newCard.classList.remove('flipped');
  slot.parentNode.replaceChild(fresh, slot);

  // 双 rAF 确保浏览器先绘制背面，再翻面
  requestAnimationFrame(() => requestAnimationFrame(() => newCard.classList.add('flipped')));

  state.flippedCount += 1;
  checkAllFlipped();
}

/** 全部翻开（逐张交错延迟） */
function flipAll() {
  if (!state.shuffled) return;
  const cards = $$('#card-layout .tarot-card:not(.flipped)');
  cards.forEach((card, i) => {
    setTimeout(() => flipCard(card), i * 130);
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

  // 抽牌视图
  $('#btn-shuffle').addEventListener('click', doShuffle);
  $('#btn-flip-all').addEventListener('click', flipAll);
  $('#card-layout').addEventListener('click', (e) => {
    const card = e.target.closest('.tarot-card');
    if (card) flipCard(card);
  });
  $('#btn-back-home').addEventListener('click', () => showView('home'));

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
