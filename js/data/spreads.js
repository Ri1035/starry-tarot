/* ============================================================
 * 星穹塔罗 · 牌阵数据
 *
 * 数据结构说明（新增牌阵只需向 TAROT_SPREADS 追加一项）：
 * {
 *   id:        唯一标识
 *   name:      牌阵名（中文）
 *   desc:      一句话简介
 *   count:     卡牌数量（必须与 positions 长度一致）
 *   layout:    布局类型，决定抽牌区如何排布：
 *                'single'   单张居中
 *                'row'      横向一行（自动换行）
 *                'grid2'    2×2 网格
 *                'triangle' 三角堆叠
 *                'hex'      六芒星网格
 *                'year'     年度 12 宫网格
 *                'celtic'   凯尔特十字（十字 + 柱列）
 *   positions: 卡位标签数组（第 1 张对应 positions[0]，以此类推）
 * }
 * ============================================================ */
const TAROT_SPREADS = [
  {
    id: 'single',
    name: '单张指引',
    desc: '最直接的每日指引，问天问地不如问自己。',
    count: 1,
    layout: 'single',
    positions: [{ label: '今日指引' }]
  },
  {
    id: 'time3',
    name: '三张牌 · 时间流',
    desc: '看清过去、现在与未来之间的因果脉络。',
    count: 3,
    layout: 'row',
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
    layout: 'triangle',
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
    layout: 'grid2',
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
    layout: 'row',
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
    layout: 'hex',
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
    layout: 'row',
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
    layout: 'row',
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
    layout: 'celtic',
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
    layout: 'year',
    positions: [
      { label: '一月' }, { label: '二月' }, { label: '三月' }, { label: '四月' },
      { label: '五月' }, { label: '六月' }, { label: '七月' }, { label: '八月' },
      { label: '九月' }, { label: '十月' }, { label: '十一月' }, { label: '十二月' }
    ]
  }
];

/** 根据牌阵 id 快速取牌阵对象 */
function getSpread(id) {
  for (let i = 0; i < TAROT_SPREADS.length; i++) {
    if (TAROT_SPREADS[i].id === id) return TAROT_SPREADS[i];
  }
  return null;
}
