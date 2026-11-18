/* 离线解读引擎单测：不需要浏览器，直接用 Node + vm 加载经典脚本。
 * 覆盖：全部牌阵 × 随机抽牌 × 正逆位，校验总览/逐位/建议/文本完整性。 */
import fs from 'fs';
import vm from 'vm';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILES = [
  'js/data/cards.js',
  'js/data/spreads.js',
  'js/data/lexicon.js',
  'js/reading/engine.js'
];

let code = FILES.map((f) => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');

code += `
  const out = { ok: 0, bad: [] };
  const orient = ['upright', 'reversed'];
  for (let round = 0; round < 300; round++) {
    for (const sp of TAROT_SPREADS) {
      const pool = TAROT_CARDS.slice();
      const draw = [];
      for (let i = 0; i < sp.count; i++) {
        const idx = Math.floor(Math.random() * pool.length);
        draw.push({ card: pool.splice(idx, 1)[0], orientation: orient[Math.floor(Math.random() * 2)] });
      }
      try {
        const r = window.TarotReading.compose(sp, draw);
        const bad = [];
        if (!r.overview || r.overview.length < 15) bad.push('overview');
        if (!r.advice || r.advice.length < 8) bad.push('advice');
        if (r.sections.length !== sp.count) bad.push('sections=' + r.sections.length + '/' + sp.count);
        if (r.text.indexOf(sp.name) === -1) bad.push('text-name');
        for (const s of r.sections) {
          if (!s.current || !s.roleLine) bad.push('empty-section:' + s.name);
          if (r.text.indexOf(s.name) === -1) bad.push('text-card:' + s.name);
        }
        if (bad.length) out.bad.push(sp.id + ':' + bad.join(','));
        else out.ok++;
      } catch (e) {
        out.bad.push(sp.id + ':EX ' + e.message);
      }
    }
  }
  out.spreads = TAROT_SPREADS.length;
  window.__RESULT = out;
`;

const ctx = { window: {}, Math, console };
vm.runInNewContext(code, ctx);
const r = ctx.window.__RESULT;

console.log('spreads: ' + r.spreads + ' | ok: ' + r.ok + ' | bad: ' + r.bad.length);
if (r.bad.length) {
  console.error(r.bad.slice(0, 10).join('\n'));
  process.exit(1);
}

// 打印一条样例，便于人工抽检文案质量
const ctx2 = { window: {}, Math, console };
vm.runInNewContext(code + `
  const sp = TAROT_SPREADS.find((s) => s.id === 'time3');
  const d = [TAROT_CARDS[5], TAROT_CARDS[30], TAROT_CARDS[60]]
    .map((c, i) => ({ card: c, orientation: i === 1 ? 'reversed' : 'upright' }));
  window.__SAMPLE = window.TarotReading.compose(sp, d).text;
`, ctx2);
console.log('\n--- SAMPLE ---\n' + ctx2.window.__SAMPLE);
console.log('\nENGINE PASS');
