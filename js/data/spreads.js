/* ============================================================
 * 星穹塔罗 · 牌阵数据
 *
 * 数据结构说明（新增牌阵只需向 TAROT_SPREADS 追加一项）：
 * {
 *   id:        唯一标识
 *   name:      牌阵名（中文）
 *   desc:      一句话简介
 *   count:     卡牌数量（必须与 positions 长度一致）
 *   category:  主题分类：love 爱情 / career 事业 / growth 成长 / time 时间 / life 综合
 *   layout:    布局类型，决定抽牌区如何排布（见 app.js LAYOUTS 注册表）：
 *                'single'    单张居中
 *                'row'       横向一行（自动换行）
 *                'grid2'     2×2 网格
 *                'triangle'  三角堆叠
 *                'hex'       六芒星网格
 *                'year'      年度 12 宫网格
 *                'celtic'    凯尔特十字（十字 + 柱列）
 *                'columns'   双栏（奇数张时首张置顶）
 *                'pyramid'   金字塔（1-2-1…逐层堆叠）
 *                'cross5'    十字形（中心 + 上下左右）
 *                'horseshoe' 马蹄铁弧形（7 张 U 形）
 *                'zodiac'    十二宫网格（4×3）
 *   info:      牌阵详情 { scene: 适用场景, tip: 解读要点 }
 *   positions: 卡位标签数组（第 1 张对应 positions[0]，以此类推）
 * }
 * ============================================================ */
const TAROT_SPREADS = [
  {
    id: 'single',
    name: '单张指引',
    desc: '最直接的每日指引，问天问地不如问自己。',
    count: 1,
    category: 'life',
    layout: 'single',
    info: { scene: '适合每日一问、状态检测、快速得到一个小提醒。', tip: '不纠结对错，让牌意与当下的感受对话，越放松越准。' },
    positions: [{ label: '今日指引' }]
  },
  {
    id: 'time3',
    name: '三张牌 · 时间流',
    desc: '看清过去、现在与未来之间的因果脉络。',
    count: 3,
    category: 'time',
    layout: 'row',
    info: { scene: '适合任何需要看时间走向的问题，如一段感情的阶段、一件事情的进展。', tip: '重点是"变化"：从过去到未来，牌面能量的转变就是答案的核心。' },
    positions: [
      { label: '过去' },
      { label: '现在' },
      { label: '未来' }
    ]
  },
  {
    id: 'trinity',
    name: '圣三角',
    desc: '以三角形之力，照见现状、挑战与最终结果。',
    count: 3,
    category: 'life',
    layout: 'triangle',
    info: { scene: '经典入门牌阵，适合对具体问题做三层剖析。', tip: '看"挑战"如何影响"结果"，现状是根因，结果会随行动改变。' },
    positions: [
      { label: '现状' },
      { label: '挑战' },
      { label: '结果' }
    ]
  },
  {
    id: 'elements',
    name: '四元素',
    desc: '从行动、情感、思维与物质四个维度全面审视。',
    count: 4,
    category: 'growth',
    layout: 'grid2',
    info: { scene: '适合自我盘点、身心健康、能量平衡类问题。', tip: '火是行动、水是情感、风是思维、土是物质，看哪一维最弱，就是当下要补的功课。' },
    positions: [
      { label: '行动 · 火' },
      { label: '情感 · 水' },
      { label: '思维 · 风' },
      { label: '物质 · 土' }
    ]
  },
  {
    id: 'heart5',
    name: '五张牌 · 心路',
    desc: '从现状到结果的心灵地图，看见阻碍与助力。',
    count: 5,
    category: 'growth',
    layout: 'row',
    info: { scene: '适合内心困扰、迷茫期、需要梳理心路历程的问题。', tip: '"潜意识"往往藏着真正的阻碍，留意它与其他位置的呼应。' },
    positions: [
      { label: '现状' },
      { label: '阻碍' },
      { label: '助力' },
      { label: '潜意识' },
      { label: '结果' }
    ]
  },
  {
    id: 'hexagram',
    name: '六芒星',
    desc: '上下三角的交汇，调和理想与现实的能量。',
    count: 6,
    category: 'life',
    layout: 'hex',
    info: { scene: '适合中长期规划、理想与现实的差距、重大决策前的全景审视。', tip: '观察"理想"与"现实"的落差，落差越大，越需要调整"行动"。' },
    positions: [
      { label: '现状' },
      { label: '挑战' },
      { label: '理想' },
      { label: '现实' },
      { label: '行动' },
      { label: '结果' }
    ]
  },
  {
    id: 'relation',
    name: '关系之镜',
    desc: '照见一段关系中的彼此、现状与建议。',
    count: 5,
    category: 'love',
    layout: 'row',
    info: { scene: '适合恋爱、婚姻、亲友、合作等一切双向关系的梳理。', tip: '重点对比"自己"与"对方"两张牌的能量差异，差异处即是需要沟通的地方。' },
    positions: [
      { label: '自己' },
      { label: '对方' },
      { label: '关系现状' },
      { label: '关系挑战' },
      { label: '发展建议' }
    ]
  },
  {
    id: 'career',
    name: '事业航道',
    desc: '梳理职场现状、优势阻力与前进方向。',
    count: 5,
    category: 'career',
    layout: 'row',
    info: { scene: '适合求职、晋升、转行、创业等与事业相关的抉择。', tip: '"优势"与"阻力"并读：扬长避短是推进事业最快的路径。' },
    positions: [
      { label: '现状' },
      { label: '优势' },
      { label: '阻力' },
      { label: '机遇' },
      { label: '建议' }
    ]
  },
  {
    id: 'celtic',
    name: '凯尔特十字',
    desc: '经典全息牌阵，十张牌织就完整的人生图景。',
    count: 10,
    category: 'life',
    layout: 'celtic',
    info: { scene: '塔罗最经典的深度牌阵，适合重大课题、人生转折、需要全局视角的问题。', tip: '不要逐张孤立解牌：先看十字中心的"现状+挑战"，再用柱列验证长期走向。' },
    positions: [
      { label: '现状' },
      { label: '挑战' },
      { label: '根基' },
      { label: '过去' },
      { label: '最佳目标' },
      { label: '近期未来' },
      { label: '自我态度' },
      { label: '环境' },
      { label: '希望与恐惧' },
      { label: '最终结果' }
    ]
  },
  {
    id: 'year',
    name: '年度运势',
    desc: '十二张牌对应未来十二个月的能量走向。',
    count: 12,
    category: 'time',
    layout: 'year',
    info: { scene: '适合年初/生日做全年展望，也适合给一段长期计划做节奏参考。', tip: '重点看能量最强的两个月和最低谷的月份，提前布局。' },
    positions: [
      { label: '一月' }, { label: '二月' }, { label: '三月' }, { label: '四月' },
      { label: '五月' }, { label: '六月' }, { label: '七月' }, { label: '八月' },
      { label: '九月' }, { label: '十月' }, { label: '十一月' }, { label: '十二月' }
    ]
  },
  {
    id: 'decision',
    name: '二选一',
    desc: '两个选项并排摊开，看清利弊与内心真实需求。',
    count: 5,
    category: 'life',
    layout: 'columns',
    info: { scene: '适合 A/B 抉择：跳槽、分手与否、两个城市、两种方案等。', tip: '先看顶部"真实需求"，再对比两边结果牌的能量强弱，哪个更贴近需求就选哪个。' },
    positions: [
      { label: '真实需求' },
      { label: '选项A · 现状' },
      { label: '选项A · 结果' },
      { label: '选项B · 现状' },
      { label: '选项B · 结果' }
    ]
  },
  {
    id: 'lovers-pyramid',
    name: '恋人金字塔',
    desc: '四张牌叠成金字塔，透视感情中的彼此与走向。',
    count: 4,
    category: 'love',
    layout: 'pyramid',
    info: { scene: '感情发展专用：复合、暧昧、冷战、暗恋等一切感情走向问题。', tip: '塔顶的"发展"是塔基三张牌共同作用的结果，逆位牌是主要变量。' },
    positions: [
      { label: '自己' },
      { label: '对方' },
      { label: '双方现状' },
      { label: '未来发展' }
    ]
  },
  {
    id: 'gypsy-cross',
    name: '吉普赛十字',
    desc: '经典爱情十字，五张牌剖析两人心态与阻碍。',
    count: 5,
    category: 'love',
    layout: 'cross5',
    info: { scene: '恋爱中人专用，适合剖析相处模式、预判感情发展。', tip: '对比"自己心态"与"对方心态"，"阻碍"牌往往是关系最需要破局的点。' },
    positions: [
      { label: '自己心态' },
      { label: '对方心态' },
      { label: '现状' },
      { label: '阻碍' },
      { label: '发展' }
    ]
  },
  {
    id: 'horseshoe',
    name: '马蹄铁',
    desc: '七张牌排成马蹄形，追踪一件事的前因后果。',
    count: 7,
    category: 'life',
    layout: 'horseshoe',
    info: { scene: '针对单一具体事件做完整复盘与预判：求职结果、项目成败、官司走向等。', tip: '按 U 形顺序读：左侧是轨迹，底部是核心，右侧是应对与结果。' },
    positions: [
      { label: '过去' },
      { label: '现在' },
      { label: '近未来' },
      { label: '阻碍 · 核心' },
      { label: '最佳策略' },
      { label: '外界影响' },
      { label: '最终结果' }
    ]
  },
  {
    id: 'zodiac',
    name: '十二宫',
    desc: '十二张牌对应十二宫位，一览人生的各个领域。',
    count: 12,
    category: 'life',
    layout: 'zodiac',
    info: { scene: '适合人生全景体检：想知道某段时间十二个生活领域的能量走向。', tip: '不必十二宫全读，先锁定你最关心的 2~3 个宫位，其余作背景参考。' },
    positions: [
      { label: '一宫 · 自我' }, { label: '二宫 · 财富' }, { label: '三宫 · 沟通' }, { label: '四宫 · 家庭' },
      { label: '五宫 · 爱情' }, { label: '六宫 · 健康' }, { label: '七宫 · 关系' }, { label: '八宫 · 转变' },
      { label: '九宫 · 远行' }, { label: '十宫 · 事业' }, { label: '十一宫 · 朋友' }, { label: '十二宫 · 潜意识' }
    ]
  },
  {
    id: 'inspiration',
    name: '灵感对应',
    desc: '六张牌两两相对，照见彼此眼中的对方与期望。',
    count: 6,
    category: 'love',
    layout: 'columns',
    info: { scene: '适合暧昧期、异地恋、关系不对等时，看清彼此的真实态度。', tip: '左列是"你"，右列是"TA"，上中下分别对应看法、现状、期望，落差即信号。' },
    positions: [
      { label: '你对TA的看法' },
      { label: 'TA对你的看法' },
      { label: '你的现状' },
      { label: 'TA的现状' },
      { label: '你的期望' },
      { label: 'TA的期望' }
    ]
  },

  /* ---------------- v1.4.1 新增（复用现有布局） ---------------- */
  {
    id: 'weekly7',
    name: '周运七日',
    desc: '一周七天逐日指引，提前看见节奏与起伏。',
    count: 7,
    category: 'time',
    layout: 'row',
    info: { scene: '适合周一早晨做一周规划，或想知道某件持续一周的事情会如何演变。', tip: '不要逐日死记，先看哪两天的牌性相反，那往往是节奏转折点。' },
    positions: [
      { label: '周一', role: 'future' },
      { label: '周二', role: 'future' },
      { label: '周三', role: 'future' },
      { label: '周四', role: 'future' },
      { label: '周五', role: 'future' },
      { label: '周六', role: 'future' },
      { label: '周日', role: 'future' }
    ]
  },
  {
    id: 'seasons4',
    name: '四季运势',
    desc: '春夏秋冬四张牌，看一年的能量如何轮转。',
    count: 4,
    category: 'time',
    layout: 'grid2',
    info: { scene: '适合年度规划、想看未来一年整体节奏的人。', tip: '四季不是平均用力：能量最强的那个季节，就是你该押注的窗口。' },
    positions: [
      { label: '春 · 萌发', role: 'future' },
      { label: '夏 · 盛放', role: 'future' },
      { label: '秋 · 收成', role: 'future' },
      { label: '冬 · 沉潜', role: 'future' }
    ]
  },
  {
    id: 'soulmate6',
    name: '灵魂伴侣',
    desc: '从两个人到一段关系，六张牌看清连接与走向。',
    count: 6,
    category: 'love',
    layout: 'columns',
    info: { scene: '适合稳定关系、想确认彼此位置与未来走向的人。', tip: '重点看"连接"与"阻碍"两张是否同色系：同色是助力，冲突色是功课。' },
    positions: [
      { label: '你', role: 'self' },
      { label: '对方', role: 'other' },
      { label: '你们的连接', role: 'relation' },
      { label: '阻碍', role: 'obstacle' },
      { label: '共同成长', role: 'advice' },
      { label: '关系结果', role: 'outcome' }
    ]
  },
  {
    id: 'yesno3',
    name: '是否之轮',
    desc: '三张牌给出一个倾向明确的答案，而不是含糊其辞。',
    count: 3,
    category: 'life',
    layout: 'row',
    info: { scene: '适合需要快速决断的小问题：要不要发这条消息、要不要赴约。', tip: '这是一个"倾向"而非"保证"：答案位越强，倾向越明确；阻力位强则先解决阻力。' },
    positions: [
      { label: '现状', role: 'present' },
      { label: '阻力', role: 'obstacle' },
      { label: '答案', role: 'outcome' }
    ]
  },

  /* ---------------- v1.5.1 新增（独立布局） ---------------- */
  {
    id: 'tree10',
    name: '生命之树',
    desc: '十张牌对应生命之树的十个质点，从王冠到王国。',
    count: 10,
    category: 'growth',
    layout: 'tree',
    info: { scene: '适合想系统梳理一个长期议题：从最高意图一路看到现实落地。', tip: '从上往下读是"意图如何落地"，从下往上读是"现实如何生长"，两种顺序都成立。' },
    positions: [
      { label: '王冠 · 最高意图', role: 'goal' },
      { label: '智慧 · 洞察', role: 'self' },
      { label: '理解 · 结构', role: 'self' },
      { label: '慈悲 · 资源', role: 'support' },
      { label: '严厉 · 约束', role: 'obstacle' },
      { label: '光辉 · 核心', role: 'present' },
      { label: '胜利 · 情绪', role: 'support' },
      { label: '荣耀 · 思维', role: 'environment' },
      { label: '基础 · 根基', role: 'foundation' },
      { label: '王国 · 现实', role: 'outcome' }
    ]
  },
  {
    id: 'chakra7',
    name: '七脉轮',
    desc: '七个脉轮自下而上，照见身体与能量的通畅程度。',
    count: 7,
    category: 'growth',
    layout: 'chakra',
    info: { scene: '适合身心状态盘点、长期疲惫、想找回内在秩序的时候。', tip: '从下往上读：越靠下的脉轮越基础；某一层逆位，先补它下面的那一层。' },
    positions: [
      { label: '海底轮 · 安全感', role: 'foundation' },
      { label: '本我轮 · 感受', role: 'self' },
      { label: '太阳轮 · 意志', role: 'self' },
      { label: '心轮 · 连接', role: 'relation' },
      { label: '喉轮 · 表达', role: 'advice' },
      { label: '眉心轮 · 洞察', role: 'advice' },
      { label: '顶轮 · 意义', role: 'goal' }
    ]
  },

  /* ---------------- v1.5.4 新增（复用布局，0 新 CSS） ---------------- */
  {
    id: 'moon8',
    name: '月相八相',
    desc: '从新月到残月，八张牌串起一件事的完整周期。',
    count: 8,
    category: 'time',
    layout: 'year',
    info: { scene: '适合看一件需要经历完整周期的事：项目、关系、习惯养成。', tip: '满月位是能量峰值，残月位是收尾方式；两头都看，才知道该何时启动、何时放手。' },
    positions: [
      { label: '新月 · 起点', role: 'present' },
      { label: '娥眉月 · 萌芽', role: 'future' },
      { label: '上弦月 · 推进', role: 'future' },
      { label: '盈凸月 · 扩张', role: 'future' },
      { label: '满月 · 显化', role: 'outcome' },
      { label: '亏凸月 · 分享', role: 'future' },
      { label: '下弦月 · 释放', role: 'advice' },
      { label: '残月 · 收束', role: 'future' }
    ]
  },
  {
    id: 'clover4',
    name: '四叶草',
    desc: '四片叶子四个面向，快速盘点当下的整体状态。',
    count: 4,
    category: 'life',
    layout: 'grid2',
    info: { scene: '适合每周复盘、生日或新年时做一次全面盘点。', tip: '四张牌不需要都"好"：有一片叶子逆位，就先补那一片，别同时修四个方向。' },
    positions: [
      { label: '爱情', role: 'relation' },
      { label: '事业', role: 'goal' },
      { label: '健康', role: 'foundation' },
      { label: '财运', role: 'support' }
    ]
  },
  {
    id: 'choice5',
    name: '抉择十字',
    desc: '两个选项摊开对比，把代价和结果一起看见。',
    count: 5,
    category: 'life',
    layout: 'cross5',
    info: { scene: '适合两个 offer、两条路线、去或留这类真实两难。', tip: '重点不是"哪个更好"，而是两张结果牌里，你更能接受哪一种代价。' },
    positions: [
      { label: '现状', role: 'present' },
      { label: '选项 A', role: 'goal' },
      { label: '选项 B', role: 'goal' },
      { label: 'A 的结果', role: 'outcome' },
      { label: 'B 的结果', role: 'outcome' }
    ]
  },
  {
    id: 'relation5',
    name: '关系十字',
    desc: '五个位置看清两个人、连接本身与下一步。',
    count: 5,
    category: 'love',
    layout: 'cross5',
    info: { scene: '适合暧昧、冷战、复合前的关系梳理。', tip: '先看"关系"再看"建议"：连接本身的状态，决定了建议该是推进还是退出。' },
    positions: [
      { label: '你', role: 'self' },
      { label: '对方', role: 'other' },
      { label: '关系', role: 'relation' },
      { label: '阻碍', role: 'obstacle' },
      { label: '建议', role: 'advice' }
    ]
  }
];

/** 牌阵主题分类元信息（用于筛选与徽标） */
const SPREAD_CATEGORIES = {
  all: { label: '全部' },
  love: { label: '爱情' },
  career: { label: '事业' },
  growth: { label: '成长' },
  time: { label: '时间' },
  life: { label: '综合' }
};

/** 根据牌阵 id 快速取牌阵对象 */
function getSpread(id) {
  for (let i = 0; i < TAROT_SPREADS.length; i++) {
    if (TAROT_SPREADS[i].id === id) return TAROT_SPREADS[i];
  }
  return null;
}
