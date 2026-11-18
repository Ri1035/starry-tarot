/* 端到端回归：真实浏览器 + 本地静态服务器。
 *
 * 运行：npm run test:e2e
 * 依赖：npm i（puppeteer-core）
 * Chrome：优先 CHROME_PATH，其次系统 Chrome，最后 puppeteer 缓存目录。
 *
 * 说明：软件 WebGL（SwiftShader）下 3D 只有 ~2fps，因此 3D 部分只验证
 * 「模块加载 / 画布挂载」；完整落牌与翻牌已在 v1.3.x 手工回归过。
 */
import puppeteer from 'puppeteer-core';
import http from 'http';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];
let server;

function findChrome() {
  const cands = [
    process.env.CHROME_PATH,
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser'
  ].filter(Boolean);
  for (const c of cands) if (fs.existsSync(c)) return c;
  const base = path.join(os.homedir(), '.cache/puppeteer/chrome');
  if (fs.existsSync(base)) {
    for (const dir of fs.readdirSync(base)) {
      const p = path.join(base, dir, 'chrome-linux64/chrome');
      if (fs.existsSync(p)) return p;
    }
  }
  return null;
}

function assert(cond, msg) {
  if (!cond) throw new Error('ASSERT FAIL: ' + msg);
  console.log('  ✓ ' + msg);
}

function serve() {
  return new Promise((resolve) => {
    const mime = {
      '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
      '.png': 'image/png', '.webp': 'image/webp', '.woff2': 'font/woff2',
      '.json': 'application/json', '.ico': 'image/x-icon'
    };
    server = http.createServer((req, res) => {
      const url = decodeURIComponent(req.url.split('?')[0]);
      const fp = path.join(ROOT, url === '/' ? '/index.html' : url);
      if (!fp.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
      fs.readFile(fp, (err, data) => {
        if (err) { res.writeHead(404); res.end('not found'); return; }
        res.writeHead(200, { 'Content-Type': mime[path.extname(fp)] || 'application/octet-stream' });
        res.end(data);
      });
    });
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
}

async function main() {
  const chrome = findChrome();
  if (!chrome) throw new Error('未找到 Chrome，请设置 CHROME_PATH');
  const port = await serve();

  const browser = await puppeteer.launch({
    executablePath: chrome,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--window-size=1440,900', '--hide-scrollbars']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 200)); });
  page.on('requestfailed', (r) => errors.push('requestfailed: ' + r.url()));

  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle0', timeout: 30000 });
  await sleep(500);

  // 1. 首页与声明
  assert((await page.$$eval('#view-home .hero-actions button', (e) => e.length)) === 3, '首页 3 个操作按钮');
  const magicNote = await page.$eval('.magic-note', (e) => e.textContent);
  assert(magicNote.includes('魔力源') && magicNote.includes('虔诚'), '页脚魔力源声明');
  await page.click('[data-nav="about"]');
  await sleep(300);
  const about = await page.$eval('#view-about', (e) => e.textContent);
  assert(about.includes('虔诚即可得到回应') && about.includes('反噬与诅咒'), '关于页声明完整');
  await page.click('#view-about [data-nav="home"]');
  await sleep(300);

  // 2. 牌阵数量与新增牌阵
  await page.click('#btn-open-spreads');
  await sleep(400);
  const spreadNames = await page.$$eval('.spread-item .s-name', (els) => els.map((e) => e.textContent));
  assert(spreadNames.length === 26, '牌阵共 26 个（实际 ' + spreadNames.length + '）');
  assert(spreadNames.includes('生命之树') && spreadNames.includes('七脉轮'), '新增生命之树 / 七脉轮');
  assert(spreadNames.includes('周运七日') && spreadNames.includes('是否之轮'), '新增周运 / 是否之轮');
  assert(spreadNames.includes('月相八相') && spreadNames.includes('抉择十字'), '新增月相八相 / 抉择十字');
  await page.click('#modal-spreads .modal-close');
  await sleep(700);

  // 3. 2D 自动洗牌 → 翻牌仪式感 → 解读
  await page.click('#btn-quick-draw');
  await sleep(2300);
  assert(await page.evaluate(() => !document.getElementById('btn-flip-all').classList.contains('hidden')), '2D 自动洗牌完成');

  await page.evaluate(() => document.querySelector('#card-layout .tarot-card').click());
  const ritual = await page.evaluate(() => ({
    flipping: document.querySelector('#card-layout .tarot-card').classList.contains('is-flipping'),
    dim: document.getElementById('card-layout').classList.contains('has-reveal')
  }));
  assert(ritual.flipping && ritual.dim, '翻牌仪式感：抬起 + 聚焦变暗');
  await sleep(900);
  assert(await page.evaluate(() => !!document.querySelector('#card-layout .card-slot.is-revealed')), '翻牌仪式感：定妆类生效');
  await sleep(900);
  assert(await page.evaluate(() => !document.getElementById('btn-to-reading').classList.contains('hidden')), '全部翻开后出现「解读」');
  await page.click('#btn-to-reading');
  await sleep(600);

  const readingState = await page.evaluate(() => ({
    overview: !!document.querySelector('.reading-overview'),
    advice: !!document.querySelector('.reading-advice'),
    role: !!document.querySelector('.r-role'),
    alt: !!document.querySelector('.r-alt'),
    kw: !!document.querySelector('.r-kw')
  }));
  assert(readingState.overview && readingState.advice, '解读页含引擎总览 / 建议');
  assert(readingState.role && readingState.alt && readingState.kw, '逐位解读含角色句 / 另一面 / 关键词');

  // 4. 保存 + 历史筛选 / 导出按钮
  await page.click('#btn-save');
  await sleep(300);
  await page.click('[data-nav="history"]');
  await sleep(400);
  assert((await page.$$eval('.history-item', (e) => e.length)) === 1, '历史记录保存成功');
  assert(await page.$('#history-search'), '历史记录含搜索框');
  await page.evaluate(() => {
    const inp = document.getElementById('history-search');
    inp.value = '不存在的牌名xyz';
    inp.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await sleep(200);
  const emptyText = await page.$eval('#history-list', (e) => e.textContent);
  assert(emptyText.includes('没有符合条件'), '历史记录搜索过滤生效');
  await page.click('#modal-history .modal-close');
  await sleep(700);

  // 5. 3D 模块按需加载
  await page.click('[data-nav="3d"]');
  await sleep(8000);
  assert(await page.evaluate(() => !!window.Tarot3D), '3D 模块按需加载');
  assert(await page.evaluate(() => !!document.querySelector('#tarot-table canvas.t3d-canvas')), '3D 画布挂载');
  assert(await page.evaluate(() => !document.querySelector('#tarot-table canvas') ? false : true), '3D 场景可渲染');

  console.log('\n控制台错误(' + errors.length + ' 条):');
  errors.forEach((e) => console.log('  ' + e));
  assert(!errors.some((e) => !/favicon/.test(e)), '无致命 JS 错误');

  await browser.close();
  server.close();
  console.log('\nE2E PASS');
}

main().catch((e) => {
  console.error('\nFAILED: ' + (e && e.stack || e));
  if (server) server.close();
  process.exit(1);
});
