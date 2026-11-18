/* ============================================================
 * 星穹塔罗 · 离线解读引擎
 *
 * 思路（老式塔罗软件的做法，不依赖大模型）：
 *   牌义词典（cards.js）
 *   + 元素/数字/花色语义（lexicon.js）
 *   + 位置角色句式（lexicon.js）
 *   + 规则层（大阿卡纳密度、逆位密度、花色失衡、元素冲突、牌对……）
 *   → 拼装成「总览 / 逐位 / 建议」三段式解读
 *
 * 纯函数，不碰 DOM；由 app.js 调用并负责渲染。
 * 输出：
 *   { overview, sections[], advice, text }
 * ============================================================ */
(function () {
  'use strict';

  const L = typeof TAROT_LEXICON !== 'undefined' ? TAROT_LEXICON : null;
  if (!L) return;

  /* ---------- 小工具 ---------- */
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  // 同一 role 的句式不要连续重复
  const recentRoleLine = new Map();
  function roleLine(role) {
    const arr = L.roleClause[role] || L.roleClause.present;
    if (arr.length === 1) return arr[0];
    let i = Math.floor(Math.random() * arr.length);
    if (recentRoleLine.get(role) === i) i = (i + 1) % arr.length;
    recentRoleLine.set(role, i);
    return arr[i];
  }

  const openers = ['先看整体：', '把牌面放在一起看：', '这组牌的整体质地是：', ''];
  let lastOpener = -1;
  function opener() {
    let i = Math.floor(Math.random() * openers.length);
    if (i === lastOpener) i = (i + 1) % openers.length;
    lastOpener = i;
    return openers[i];
  }

  /* ---------- 牌性推导 ---------- */
  function traits(card) {
    const isMajor = card.arcana === 'major';
    return {
      isMajor: isMajor,
      element: isMajor ? (L.majorElement[card.id] || 'air') : (L.elementBySuit[card.suit] || 'earth'),
      numTheme: L.numTheme[card.num] || '',
      suitLabel: L.suitLabel[card.suit] || ''
    };
  }

  /** 位置角色：优先显式 role，其次按标签关键词兜底 */
  function resolveRole(position) {
    if (!position) return 'present';
    if (position.role) return position.role;
    const label = position.label || '';
    for (const [role, re] of L.rolePatterns) {
      if (re.test(label)) return role;
    }
    return 'present';
  }

  /* ---------- 上下文 ---------- */
  function buildContext(spread, draw) {
    const items = draw.map(function (d, i) {
      const t = traits(d.card);
      return {
        card: d.card,
        orientation: d.orientation,
        reversed: d.orientation === 'reversed',
        role: resolveRole(spread.positions[i]),
        element: t.element,
        isMajor: t.isMajor,
        index: i
      };
    });

    const total = items.length;
    const majorCount = items.filter((x) => x.isMajor).length;
    const revCount = items.filter((x) => x.reversed).length;
    const minorCount = total - majorCount;

    const suitCount = { wands: 0, cups: 0, swords: 0, pentacles: 0 };
    const elemCount = { fire: 0, water: 0, air: 0, earth: 0 };
    items.forEach((x) => {
      if (!x.isMajor) suitCount[x.card.suit]++;
      elemCount[x.element]++;
    });

    return {
      spread: spread,
      items: items,
      total: total,
      majorCount: majorCount,
      minorCount: minorCount,
      revCount: revCount,
      majorRatio: total ? majorCount / total : 0,
      revRatio: total ? revCount / total : 0,
      suitCount: suitCount,
      elemCount: elemCount
    };
  }

  /* ---------- 规则层 ---------- */
  function findPairRule(ctx) {
    const ids = ctx.items.map((x) => x.card.id);
    for (const p of L.pairRules) {
      if (ids.indexOf(p.ids[0]) !== -1 && ids.indexOf(p.ids[1]) !== -1) {
        return { id: 'pair', weight: 95, text: p.text };
      }
    }
    return null;
  }

  function findOutcomeStrong(ctx) {
    const oc = ctx.items.find((x) => x.role === 'outcome');
    if (oc && oc.isMajor && !oc.reversed) {
      return {
        id: 'outcome',
        weight: 88,
        text: '结果位是正位大阿卡纳「' + oc.card.name + '」，方向感较强，事情大概率会朝这个质地收束。'
      };
    }
    return null;
  }

  function dominantSuit(ctx) {
    if (ctx.minorCount < 3) return null;
    let best = null, n = 0;
    for (const s in ctx.suitCount) {
      if (ctx.suitCount[s] > n) { best = s; n = ctx.suitCount[s]; }
    }
    return n >= Math.ceil(ctx.minorCount * 0.5) ? { suit: best, n: n } : null;
  }

  function dominantElement(ctx) {
    let best = null, n = 0;
    for (const e in ctx.elemCount) {
      if (ctx.elemCount[e] > n) { best = e; n = ctx.elemCount[e]; }
    }
    // 至少要有两张、且占比不低于 40% 才算"重心"
    return n >= 2 && n / ctx.total >= 0.4 ? best : null;
  }

  function collectRules(ctx) {
    const rules = [];
    const push = (r) => { if (r) rules.push(r); };

    push(findPairRule(ctx));

    if (ctx.total >= 3 && ctx.majorRatio >= 0.5) {
      rules.push({
        id: 'major',
        weight: 90,
        text: ctx.majorCount + ' 张大阿卡纳出现在 ' + ctx.total + ' 张牌里，这次议题更接近阶段性的方向，而不是日常琐事。'
      });
    }

    push(findOutcomeStrong(ctx));

    if (ctx.total >= 3 && ctx.revRatio >= 0.6) {
      rules.push({
        id: 'reverse',
        weight: 85,
        text: '逆位占 ' + ctx.revCount + '/' + ctx.total + '，能量偏内耗或延迟，事情不会按表面的节奏推进。'
      });
    }

    const ds = dominantSuit(ctx);
    if (ds) {
      const el = L.elementBySuit[ds.suit];
      rules.push({
        id: 'suit',
        weight: 80,
        text: L.suitLabel[ds.suit] + '牌占主导（' + ds.n + ' 张），' + (L.elementTheme[el] || '') + '是这条线的主轴。'
      });
    }

    const hasFireWater = ctx.elemCount.fire > 0 && ctx.elemCount.water > 0;
    const hasAirEarth = ctx.elemCount.air > 0 && ctx.elemCount.earth > 0;
    if (hasFireWater || hasAirEarth) {
      rules.push({
        id: 'conflict',
        weight: 75,
        text: hasFireWater
          ? '火与水同时在场：冲动和情绪在互相拉扯，先安顿情绪，再采取行动。'
          : '风与土同时在场：想法很多但落地偏慢，先把一件事做实。'
      });
    }

    const adv = ctx.items.find((x) => x.role === 'advice');
    const contemplative = ['the-hermit', 'the-high-priestess', 'the-hanged-man', 'the-moon'];
    if (adv && contemplative.indexOf(adv.card.id) !== -1) {
      rules.push({
        id: 'advice-quiet',
        weight: 72,
        text: '建议位出现「' + adv.card.name + '」：这次不要向外求解，安静下来比继续行动更有用。'
      });
    }

    if (ctx.total >= 3) {
      const first = ctx.items[0], last = ctx.items[ctx.items.length - 1];
      if (first.element === last.element) {
        rules.push({
          id: 'bookend',
          weight: 60,
          text: '起点与落点同属' + (L.elementLabel[first.element] || '') + '元素，' +
            (L.elementTheme[first.element] || '') + '贯穿全程。'
        });
      }
    }

    if (ctx.total >= 5 && ctx.minorCount >= 4) {
      const missing = Object.keys(ctx.suitCount).filter((s) => ctx.suitCount[s] === 0);
      if (missing.length === 1) {
        const el2 = L.elementBySuit[missing[0]];
        rules.push({
          id: 'missing',
          weight: 50,
          text: '整组牌里没有' + L.suitLabel[missing[0]] + '：' + (L.elementTheme[el2] || '') + '这一维被忽略，可能是盲区。'
        });
      }
    }

    const numMap = {};
    for (const x of ctx.items) {
      if (!x.isMajor && x.card.num <= 10) {
        numMap[x.card.num] = (numMap[x.card.num] || 0) + 1;
      }
    }
    for (const k in numMap) {
      if (numMap[k] >= 2) {
        rules.push({
          id: 'dup-num',
          weight: 58,
          text: '两张 ' + k + ' 号牌重复出现：「' + (L.numTheme[k] || '') + '」的议题被反复强调。'
        });
        break;
      }
    }

    return rules.sort((a, b) => b.weight - a.weight);
  }

  /* ---------- 建议 ---------- */
  function cardAdvice(item) {
    const c = item.card;
    if (c.arcana === 'major' && L.majorAdvice[c.id]) return L.majorAdvice[c.id];
    const act = L.suitAdvice[c.suit] || '去行动';
    const num = L.numTheme[c.num];
    return act + (num ? '，并把重点放在「' + num + '」上' : '');
  }

  function buildAdvice(ctx) {
    const dom = dominantElement(ctx);
    const adv = ctx.items.find((x) => x.role === 'advice');
    let text;

    if (adv) {
      text = cardAdvice(adv) + '。';
      if (adv.reversed) text += '逆位提示先做减法：停掉不必要的消耗，再谈推进。';
    } else {
      const base = dom ? L.elementAdvice[dom] : '把注意力放回你能控制的部分';
      const oc = ctx.items.find((x) => x.role === 'outcome') || ctx.items[ctx.items.length - 1];
      const kw = oc.card.keywords && oc.card.keywords[0] ? oc.card.keywords[0] : '下一步';
      text = base + '。围绕「' + kw + '」先做一件今天能完成的小事。';
    }
    return text;
  }

  /* ---------- 逐位 ---------- */
  function buildSections(ctx) {
    return ctx.items.map(function (x) {
      const c = x.card;
      const current = x.reversed ? c.reversed : c.upright;
      let line = roleLine(x.role);

      if (x.reversed) {
        if (x.role === 'outcome') line += ' 结果位逆位：先别把话说死，事情还有一次转向。';
        else if (x.role === 'advice') line += ' 逆位建议偏「减法」：先停掉不必要的消耗。';
        else if (x.role === 'obstacle') line += ' 逆位反而说明阻力正在松动。';
      }

      return {
        index: x.index,
        label: ctx.spread.positions[x.index].label,
        role: x.role,
        name: c.name,
        nameEn: c.nameEn,
        img: c.img,
        orientation: x.orientation,
        orientationLabel: x.reversed ? '逆位' : '正位',
        meaning: c.meaning,
        current: current,
        roleLine: line,
        keywords: c.keywords || [],
        other: x.reversed ? c.upright : c.reversed,
        otherLabel: x.reversed ? '正位' : '逆位'
      };
    });
  }

  /* ---------- 总装 ---------- */
  function compose(spread, draw) {
    const ctx = buildContext(spread, draw);
    const rules = collectRules(ctx).slice(0, 2);
    const dom = dominantElement(ctx);

    let overview = opener();
    if (dom) {
      overview += '牌面重心偏向' + L.elementLabel[dom] + '元素——' + L.elementTheme[dom] + '。';
    } else {
      overview += '牌面元素比较均衡，没有单一主导，需要几股力量一起配合。';
    }
    rules.forEach((r) => { overview += r.text; });

    const sections = buildSections(ctx);
    const advice = buildAdvice(ctx);

    // 可直接复制的纯文本（不含免责声明，由 app.js 统一追加）
    const lines = ['【星穹塔罗 · ' + spread.name + '】', ''];
    lines.push('总览：' + overview);
    lines.push('');
    sections.forEach(function (s, i) {
      lines.push((i + 1) + '. ' + s.label + ' · ' + s.name + '（' + s.orientationLabel + '）');
      lines.push('   ' + s.current);
      lines.push('   ' + s.roleLine);
    });
    lines.push('');
    lines.push('建议：' + advice);

    return {
      overview: overview,
      sections: sections,
      advice: advice,
      rules: rules.map((r) => r.text),
      text: lines.join('\n')
    };
  }

  window.TarotReading = {
    compose: compose,
    resolveRole: resolveRole,
    traits: traits
  };
})();
