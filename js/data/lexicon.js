/* ============================================================
 * 星穹塔罗 · 解读词典（离线引擎的知识层）
 *
 * 这里不存"整段解读"，只存「语义零件」：
 *   - 元素 / 数字 / 花色 的基础语义
 *   - 位置角色（role）对应的句式
 *   - 少量真正有信息量的牌对规则
 *
 * 好处：78 张牌 × 正逆位 × 任意牌阵都不需要人工写组合，
 * 由 js/reading/engine.js 在运行时按规则拼装。
 * ============================================================ */
const TAROT_LEXICON = {
  /* ---------- 元素 ---------- */
  elementBySuit: { wands: 'fire', cups: 'water', swords: 'air', pentacles: 'earth' },
  elementLabel: { fire: '火', water: '水', air: '风', earth: '土' },
  elementTheme: {
    fire: '行动、热情与推进力',
    water: '情绪、关系与直觉',
    air: '思考、沟通与判断',
    earth: '现实、资源与落地'
  },
  elementAdvice: {
    fire: '把想法变成一个今天就能执行的动作',
    water: '先把感受说出来，再谈对错',
    air: '把信息摊开、把话说清，再做决定',
    earth: '落实到时间、金钱和具体步骤上'
  },
  suitLabel: { wands: '权杖', cups: '圣杯', swords: '宝剑', pentacles: '星币' },
  suitAdvice: {
    wands: '去行动、去推进',
    cups: '去表达感受、去连接',
    swords: '去厘清、去沟通',
    pentacles: '去落地、去执行'
  },

  /* ---------- 大阿卡纳元素（Golden Dawn 简化体系） ---------- */
  majorElement: {
    'the-fool': 'air', 'the-magician': 'air', 'the-high-priestess': 'water',
    'the-empress': 'earth', 'the-emperor': 'fire', 'the-hierophant': 'earth',
    'the-lovers': 'air', 'the-chariot': 'water', 'strength': 'fire',
    'the-hermit': 'earth', 'wheel-of-fortune': 'fire', 'justice': 'air',
    'the-hanged-man': 'water', 'death': 'water', 'temperance': 'fire',
    'the-devil': 'earth', 'the-tower': 'fire', 'the-star': 'air',
    'the-moon': 'water', 'the-sun': 'fire', 'judgement': 'water', 'the-world': 'earth'
  },

  /* ---------- 数字语义（1-10；11-14 为宫廷牌） ---------- */
  numTheme: {
    1: '起点与种子', 2: '平衡与选择', 3: '表达与成长', 4: '结构与稳定',
    5: '冲突与变动', 6: '和谐与给予', 7: '内省与坚持', 8: '力量与掌控',
    9: '完成与临近', 10: '满溢与收束',
    11: '讯息与试探', 12: '行动与推进', 13: '洞察与滋养', 14: '掌握与责任'
  },

  /* ---------- 大阿卡纳建议（22 张，短祈使句） ---------- */
  majorAdvice: {
    'the-fool': '先迈出一步，别等所有条件都完美',
    'the-magician': '把已有资源列出来，今天就用掉一个',
    'the-high-priestess': '少说多听，答案在安静里',
    'the-empress': '先照顾好身体和情绪，再谈产出',
    'the-emperor': '定规则、划边界，比继续商量更有效',
    'the-hierophant': '找有经验的人请教，别自己硬扛',
    'the-lovers': '做一个真正符合你价值观的选择',
    'the-chariot': '收拢目标，全力推进一件事',
    'strength': '用耐心，而不是用力气',
    'the-hermit': '给自己一段不被打扰的独处时间',
    'wheel-of-fortune': '顺势而为，别和周期对抗',
    'justice': '把账算清，把话说清',
    'the-hanged-man': '换个角度；暂时不行动也是一种行动',
    'death': '允许一件旧事结束',
    'temperance': '调比例，不要走极端',
    'the-devil': '看清你被什么绑住，先松开一格',
    'the-tower': '别抢救已经塌的东西，先保住人',
    'the-star': '保留希望，同时用一个小行动托住它',
    'the-moon': '信息不全，先别下结论',
    'the-sun': '把事情摊在阳光下，直接表达',
    'judgement': '回应那个你一直回避的召唤',
    'the-world': '收尾、庆祝，然后进入下一轮'
  },

  /* ---------- 位置角色 ---------- */
  roleLabel: {
    past: '过去', present: '现状', future: '走向', outcome: '结果',
    obstacle: '阻碍', advice: '建议', self: '你', other: '对方',
    relation: '连接', environment: '环境', hope: '希望', fear: '恐惧',
    goal: '目标', foundation: '根基', support: '助力'
  },
  roleClause: {
    past: [
      '它是这件事的来处：已经发生，但余波仍在参与你现在的判断。',
      '这段能量属于过去；理解它不是追责，而是为了不再重复。'
    ],
    present: [
      '它描述你此刻真实的站位——不是应该怎样，而是现在怎样。',
      '这是当下的主旋律；先承认它，再谈改变。'
    ],
    future: [
      '它指向接下来的走向：不是定局，而是当前惯性推出去的方向。',
      '这是趋势而非判决，你的下一步仍然能改写它。'
    ],
    outcome: [
      '作为结果位，它给出这组牌最可能的落点。',
      '结果位不是终点，而是这一轮能量收束时的样子。'
    ],
    obstacle: [
      '作为阻碍，它不是在否定你，而是指出哪里的力用错了方向。',
      '它提示真正的卡点：看见它，阻力就少了一半。'
    ],
    advice: [
      '作为建议位，这是牌面认为你现在最该做的一件事。',
      '它不是在预测，而是在给方法：把这张牌的特质用出来。'
    ],
    self: [
      '它照见你在这件事里的状态与盲区。',
      '这是你的位置：先看清自己，再谈对方与关系。'
    ],
    other: [
      '它照见对方的状态与动机，不代表对你的评价。',
      '这是对方那一侧的真实处境，理解它有助于放下猜测。'
    ],
    relation: [
      '它描述你们之间的连接质地：是流动的，还是卡住的。',
      '这是关系的现状，不是某一方的对错。'
    ],
    environment: [
      '它描述外部环境，以及你能借到的力。',
      '这是场域的能量，不完全由你控制。'
    ],
    hope: [
      '它代表你心里真正期待的样子。',
      '希望位往往藏着最诚实的渴望。'
    ],
    fear: [
      '它代表你担心发生的版本——恐惧常常比事实更早到达。',
      '恐惧位提醒你：真正消耗你的，可能只是想象。'
    ],
    goal: [
      '它指向你正在追求的目标，以及它的真实代价。',
      '目标位不只看"想要什么"，也看"愿意付出什么"。'
    ],
    foundation: [
      '它是这件事的底层结构，决定上层能走多远。',
      '根基位不稳时，越努力越容易偏航。'
    ],
    support: [
      '它是你可以借力的资源，别只盯着阻力看。',
      '助力位提示：这件事并不是只能靠你一个人。'
    ]
  },
  /** 位置标签 → role 的兜底解析（有显式 role 时优先用显式值） */
  rolePatterns: [
    ['other', /^(TA|ta|对方)|对方对|TA对/],
    ['self', /^你|你的|你对|自我|自己|内心/],
    ['outcome', /结果|结局|答案|终局|落点/],
    ['future', /未来|下周|明天|之后|发展|趋势|周一|周二|周三|周四|周五|周六|周日|春|夏|秋|冬/],
    ['past', /过去|从前|起因|根源|来时/],
    ['obstacle', /阻碍|挑战|阻力|问题|困难|考验|卡点/],
    ['advice', /建议|指引|提醒|行动|对策|方法|忠告|成长/],
    ['relation', /关系|连接|互动|默契|相处/],
    ['environment', /环境|外界|外部|影响/],
    ['hope', /希望|期待|渴望/],
    ['fear', /恐惧|担忧|害怕|不安/],
    ['goal', /目标|理想|愿景/],
    ['foundation', /根基|基础|底层/],
    ['support', /助力|支持|资源/],
    ['present', /现状|现在|当下|目前|此刻/]
  ],

  /* ---------- 牌对规则（真正有信息量的组合） ---------- */
  pairRules: [
    { ids: ['death', 'the-sun'], text: '死神与太阳同时出现：一次结束之后紧跟着重生，别在旧事上多停留。' },
    { ids: ['the-tower', 'the-star'], text: '高塔与星星同场：崩塌之后是疗愈与希望，先止损，再重建。' },
    { ids: ['the-devil', 'strength'], text: '恶魔与力量同场：束缚与解缚同时存在，关键在耐心而不是蛮力。' },
    { ids: ['the-lovers', 'two-of-cups'], text: '恋人叠加圣杯二：关系议题被明显强化，选择与连接是同一件事。' },
    { ids: ['three-of-swords', 'three-of-cups'], text: '宝剑三与圣杯三同场：心碎与修复并存，疗愈已经在路上。' },
    { ids: ['the-moon', 'the-sun'], text: '月亮与太阳同场：迷雾与澄清交替出现，先别急着定论。' },
    { ids: ['wheel-of-fortune', 'justice'], text: '命运之轮与正义同场：周期与因果同时在场，该来的账会来。' },
    { ids: ['the-hanged-man', 'the-world'], text: '倒吊人与世界同场：停顿是为了完成，不是停滞。' },
    { ids: ['the-hermit', 'the-star'], text: '隐士与星星同场：独处之后会看见方向，别害怕这段安静。' },
    { ids: ['ace-of-wands', 'the-magician'], text: '权杖首牌与魔术师同场：新机会加上执行力，是启动的好时机。' },
    { ids: ['ten-of-swords', 'the-star'], text: '宝剑十与星星同场：已经到谷底，接下来是恢复期。' },
    { ids: ['the-emperor', 'the-empress'], text: '皇帝与皇后同场：结构与被滋养需要同时满足，别只顾一头。' },
    { ids: ['the-high-priestess', 'the-moon'], text: '女祭司与月亮同场：直觉很强，但信息仍不完整，别急着摊牌。' },
    { ids: ['five-of-pentacles', 'six-of-pentacles'], text: '星币五与星币六同场：匮乏与援助同时出现，开口求助是解法之一。' },
    { ids: ['eight-of-swords', 'the-fool'], text: '宝剑八与愚者同场：束缚感正在松动，迈出一步就能验证。' },
    { ids: ['the-chariot', 'two-of-swords'], text: '战车与宝剑二同场：想推进却仍在犹豫，先做一个不可逆的小决定。' },
    { ids: ['ace-of-cups', 'the-lovers'], text: '圣杯首牌与恋人同场：情感出现新的起点，值得认真对待。' },
    { ids: ['the-sun', 'the-world'], text: '太阳与世界同场：完成度与喜悦感都很高，可以放心收尾。' }
  ]
};
