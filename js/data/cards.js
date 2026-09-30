/* ============================================================
 * 星穹塔罗 · 卡牌数据（78 张）
 * 数据结构说明（新增/修改卡牌时按此格式维护）：
 * {
 *   id:     唯一标识（英文连字符，与图片文件名映射无关，仅用于检索）
 *   name:   中文牌名
 *   nameEn: 英文牌名
 *   img:    卡面图片文件名（assets/cards/ 下）
 *   arcana: 'major' 大阿卡纳 | 'minor' 小阿卡纳
 *   suit:   牌组：major / wands / cups / swords / pentacles
 *   num:    牌号（大阿卡纳 0-21；小阿卡纳 1-14，1=Ace ... 11=Page 12=Knight 13=Queen 14=King）
 *   keywords: 关键词数组
 *   meaning: 基础含义（一句话）
 *   upright:  正位解读
 *   reversed: 逆位解读
 * }
 * 图片来源：公版 Rider-Waite（1909，Pamela Colman Smith），经 WebP 压缩。
 * ============================================================ */
const TAROT_CARDS = [
  /* ---------------- 大阿卡纳 Major Arcana ---------------- */
  { id: 'the-fool', name: '愚者', nameEn: 'The Fool', img: '00-TheFool.webp', arcana: 'major', suit: 'major', num: 0,
    keywords: ['新的开始', '冒险', '纯真'],
    meaning: '愚者象征纯真、自由与全新的旅程，代表踏出舒适区、拥抱未知。',
    upright: '新的开始、冒险精神、跟随直觉。适合大胆尝试新事物，保持开放心态，轻装上阵。',
    reversed: '鲁莽行事、犹豫不决、害怕未知。提醒你三思而后行，避免因冲动或逃避现实而延误。' },

  { id: 'the-magician', name: '魔术师', nameEn: 'The Magician', img: '01-TheMagician.webp', arcana: 'major', suit: 'major', num: 1,
    keywords: ['创造', '资源', '意志力'],
    meaning: '魔术师代表掌握资源与工具，将想法化为现实的创造力。',
    upright: '创造力旺盛、目标明确、善用资源。现在是行动与显化愿望的绝佳时机。',
    reversed: '才能被浪费、计划不周、操纵或欺瞒。警惕空想与误用能力，先脚踏实地。' },

  { id: 'the-high-priestess', name: '女祭司', nameEn: 'The High Priestess', img: '02-TheHighPriestess.webp', arcana: 'major', suit: 'major', num: 2,
    keywords: ['直觉', '潜意识', '神秘'],
    meaning: '女祭司连接直觉与潜意识，代表静默观察与内在智慧。',
    upright: '相信直觉、倾听内心、静待时机。答案藏于内在，暂不急于行动。',
    reversed: '忽略直觉、秘密浮现、流于表面。警惕被表象迷惑，需要正视内心真正的声音。' },

  { id: 'the-empress', name: '皇后', nameEn: 'The Empress', img: '03-TheEmpress.webp', arcana: 'major', suit: 'major', num: 3,
    keywords: ['丰饶', '孕育', '滋养'],
    meaning: '皇后象征丰盛、成长与滋养，代表创造力、母性与富足。',
    upright: '丰盛与滋养、感情升温、创作成果显现。请善待自己，接纳爱与关怀。',
    reversed: '过度付出、停滞不前、创造受阻。注意自我关怀与边界，避免能量透支。' },

  { id: 'the-emperor', name: '皇帝', nameEn: 'The Emperor', img: '04-TheEmperor.webp', arcana: 'major', suit: 'major', num: 4,
    keywords: ['权威', '秩序', '稳定'],
    meaning: '皇帝代表结构、规则与权威，强调自律与务实的掌控力。',
    upright: '自律与权威、建立秩序、目标达成。承担领导责任，以理性掌控局面。',
    reversed: '固执专横、失去控制、依赖他人。警惕僵化与过度控制，学会放权与变通。' },

  { id: 'the-hierophant', name: '教皇', nameEn: 'The Hierophant', img: '05-TheHierophant.webp', arcana: 'major', suit: 'major', num: 5,
    keywords: ['传统', '信仰', '导师'],
    meaning: '教皇象征传统价值、精神指引与学习传承，代表系统内的智慧。',
    upright: '遵循传统、寻求指引、学习深造。向可靠的长辈或体系请教，会有所得。',
    reversed: '打破常规、质疑权威、墨守成规。独立思考，重新定义属于自己的信念。' },

  { id: 'the-lovers', name: '恋人', nameEn: 'The Lovers', img: '06-TheLovers.webp', arcana: 'major', suit: 'major', num: 6,
    keywords: ['爱情', '结合', '选择'],
    meaning: '恋人象征爱与关系的结合，也代表面临重要选择与价值观调和。',
    upright: '甜蜜爱情、心意相通、重大选择。忠于内心与价值观做出决定。',
    reversed: '关系失衡、选择纠结、价值观冲突。诚实沟通，避免在摇摆中消耗彼此。' },

  { id: 'the-chariot', name: '战车', nameEn: 'The Chariot', img: '07-TheChariot.webp', arcana: 'major', suit: 'major', num: 7,
    keywords: ['意志', '前进', '胜利'],
    meaning: '战车代表以坚定意志驾驭内外力量，冲向目标并赢得胜利。',
    upright: '目标明确、全速前进、克服障碍。以自律与决心赢得胜利。',
    reversed: '方向失控、动力不足、冲突内耗。重新校准方向，先稳住内心再出发。' },

  { id: 'strength', name: '力量', nameEn: 'Strength', img: '08-Strength.webp', arcana: 'major', suit: 'major', num: 8,
    keywords: ['勇气', '内在力量', '温柔'],
    meaning: '力量象征以温柔驯服本能的内在勇气，代表耐心与韧性的胜利。',
    upright: '内心强大、以柔克刚、耐心坚持。用慈悲与勇气面对挑战。',
    reversed: '自我怀疑、情绪失控、缺乏信心。先接纳脆弱，才能找回内在力量。' },

  { id: 'the-hermit', name: '隐士', nameEn: 'The Hermit', img: '09-TheHermit.webp', arcana: 'major', suit: 'major', num: 9,
    keywords: ['内省', '独处', '智慧'],
    meaning: '隐士手持明灯向内行走，代表沉淀、独处与寻找内在真理。',
    upright: '自我沉淀、静心思考、寻求答案。独处并非孤独，是智慧的必经之路。',
    reversed: '过度封闭、逃避人群、拒绝指引。适当打开心门，接受他人的光。' },

  { id: 'wheel-of-fortune', name: '命运之轮', nameEn: 'Wheel of Fortune', img: '10-WheelOfFortune.webp', arcana: 'major', suit: 'major', num: 10,
    keywords: ['转折', '机遇', '命运'],
    meaning: '命运之轮象征生命周期的流转，代表转折、机遇与顺势而为。',
    upright: '时来运转、新机遇出现、命运转折。顺应变化，抓住上升期。',
    reversed: '运势反复、意外阻碍、抗拒改变。接受无常，转机往往在坚持之后。' },

  { id: 'justice', name: '正义', nameEn: 'Justice', img: '11-Justice.webp', arcana: 'major', suit: 'major', num: 11,
    keywords: ['公正', '因果', '平衡'],
    meaning: '正义代表公平裁决与因果平衡，强调理性判断与承担责任。',
    upright: '公正裁决、因果报偿、理性抉择。以事实为准绳，坦然接受结果。',
    reversed: '失衡不公、回避责任、判断失误。审视立场，纠正偏差与偏见。' },

  { id: 'the-hanged-man', name: '倒吊人', nameEn: 'The Hanged Man', img: '12-TheHangedMan.webp', arcana: 'major', suit: 'major', num: 12,
    keywords: ['臣服', '换位', '等待'],
    meaning: '倒吊人以全新视角看待世界，代表暂停、牺牲与灵性领悟。',
    upright: '暂停等待、换位思考、自愿牺牲。放下执念，以退为进。',
    reversed: '无谓牺牲、拖延困顿、拒绝放下。及时抽身，别让付出成为执念。' },

  { id: 'death', name: '死神', nameEn: 'Death', img: '13-Death.webp', arcana: 'major', suit: 'major', num: 13,
    keywords: ['结束', '蜕变', '放手'],
    meaning: '死神象征阶段性的结束与彻底的蜕变，代表放下旧我迎接新生。',
    upright: '结束与新生、果断放手、深层蜕变。告别旧阶段，为新生腾出空间。',
    reversed: '抗拒结束、滞留过去、恐惧改变。越抗拒越痛苦，放手才能前进。' },

  { id: 'temperance', name: '节制', nameEn: 'Temperance', img: '14-Temperance.webp', arcana: 'major', suit: 'major', num: 14,
    keywords: ['平衡', '调和', '耐心'],
    meaning: '节制代表融合与平衡的艺术，强调耐心、调和与恰到好处。',
    upright: '平衡调和、循序渐进、疗愈融合。以耐心调和各方，水到渠成。',
    reversed: '失衡过度、缺乏耐心、急于求成。检视失衡之处，回到中道。' },

  { id: 'the-devil', name: '恶魔', nameEn: 'The Devil', img: '15-TheDevil.webp', arcana: 'major', suit: 'major', num: 15,
    keywords: ['束缚', '欲望', '执念'],
    meaning: '恶魔象征欲望、执念与自我束缚，提醒你看见枷锁其实源自内心。',
    upright: '欲望膨胀、深陷执念、被束缚感。看清是什么在掌控你，枷锁可以解开。',
    reversed: '挣脱束缚、戒除依赖、重获自由。告别消耗关系与坏习惯。' },

  { id: 'the-tower', name: '高塔', nameEn: 'The Tower', img: '16-TheTower.webp', arcana: 'major', suit: 'major', num: 16,
    keywords: ['突变', '崩塌', '真相'],
    meaning: '高塔代表突如其来的震荡，摧毁虚假根基，让真相得以显露。',
    upright: '突发变动、旧序崩塌、真相显现。崩塌是为重建更稳固的根基。',
    reversed: '延迟的冲击、恐惧爆发、拒绝改变。主动调整，避免更大的震荡。' },

  { id: 'the-star', name: '星星', nameEn: 'The Star', img: '17-TheStar.webp', arcana: 'major', suit: 'major', num: 17,
    keywords: ['希望', '疗愈', '信心'],
    meaning: '星星象征风暴后的宁静与希望，代表疗愈、灵感和对未来重拾信心。',
    upright: '希望重燃、疗愈恢复、灵感涌现。相信未来，梦想正被照亮。',
    reversed: '信心受挫、理想与现实落差、迷茫。找回信念，希望从未消失。' },

  { id: 'the-moon', name: '月亮', nameEn: 'The Moon', img: '18-TheMoon.webp', arcana: 'major', suit: 'major', num: 18,
    keywords: ['幻象', '潜意识', '不安'],
    meaning: '月亮映照潜意识中的迷雾与幻象，代表不确定、直觉与梦境。',
    upright: '迷雾笼罩、直觉强烈、不安感浮现。静观其变，警惕以假乱真。',
    reversed: '迷雾渐散、真相浮现、疑虑消解。不安消散，看清真正的问题。' },

  { id: 'the-sun', name: '太阳', nameEn: 'The Sun', img: '19-TheSun.webp', arcana: 'major', suit: 'major', num: 19,
    keywords: ['喜悦', '成功', '活力'],
    meaning: '太阳是纯粹的光明与喜悦，代表成功、活力、清晰的自我表达。',
    upright: '成功喜悦、能量充沛、心想事成。尽情发光，世界为你喝彩。',
    reversed: '短暂低潮、自信不足、乐观受阻。调整心态，光明依旧存在。' },

  { id: 'judgement', name: '审判', nameEn: 'Judgement', img: '20-Judgement.webp', arcana: 'major', suit: 'major', num: 20,
    keywords: ['觉醒', '复盘', '新生'],
    meaning: '审判象征内心的觉醒与召唤，代表复盘过去、宽恕与重生。',
    upright: '觉醒召唤、复盘过去、获得新生。听从内心的召唤，勇敢回应。',
    reversed: '自我否定、逃避审判、悔恨纠缠。放下过去，给自己重新来过的机会。' },

  { id: 'the-world', name: '世界', nameEn: 'The World', img: '21-TheWorld.webp', arcana: 'major', suit: 'major', num: 21,
    keywords: ['圆满', '完成', '整合'],
    meaning: '世界代表一个周期的圆满完成，象征整合、成就与新的起点。',
    upright: '圆满达成、目标实现、整合升华。庆祝成果，新的循环即将开始。',
    reversed: '差一步完成、目标停滞、整合未成。补上最后的拼图，莫半途而废。' },

  /* ---------------- 权杖 Wands（火 · 行动） ---------------- */
  { id: 'ace-of-wands', name: '权杖一', nameEn: 'Ace of Wands', img: 'Wands01.webp', arcana: 'minor', suit: 'wands', num: 1,
    keywords: ['灵感', '新机会', '行动'],
    meaning: '一束新生的火苗，代表灵感、热情的起点与行动的召唤。',
    upright: '新机会降临、灵感迸发、热情点燃。抓住最初的冲动，立刻行动。',
    reversed: '动力不足、计划延迟、灵感枯竭。找回热情，别让火种熄灭。' },

  { id: 'two-of-wands', name: '权杖二', nameEn: 'Two of Wands', img: 'Wands02.webp', arcana: 'minor', suit: 'wands', num: 2,
    keywords: ['规划', '选择', '视野'],
    meaning: '手握权杖望向远方，代表格局、规划与下一步的选择。',
    upright: '视野开阔、规划未来、准备启程。大胆设想，世界在你手中。',
    reversed: '犹豫不决、安于现状、计划受阻。放下恐惧，勇敢迈出舒适区。' },

  { id: 'three-of-wands', name: '权杖三', nameEn: 'Three of Wands', img: 'Wands03.webp', arcana: 'minor', suit: 'wands', num: 3,
    keywords: ['进展', '远航', '等待'],
    meaning: '眺望出海的船只，代表初步成果的显现与更远大的布局。',
    upright: '项目推进、成果初现、合作扩张。耐心等待，远方的回报正在靠近。',
    reversed: '进展缓慢、合作受阻、期望落空。调整策略，别在原地空等。' },

  { id: 'four-of-wands', name: '权杖四', nameEn: 'Four of Wands', img: 'Wands04.webp', arcana: 'minor', suit: 'wands', num: 4,
    keywords: ['庆祝', '安稳', '家庭'],
    meaning: '高举的花环与庆典，代表阶段性安稳、家庭与庆祝。',
    upright: '喜事临门、家庭和睦、阶段达成。享受安稳，与所爱之人同庆。',
    reversed: '根基不稳、庆祝延期、缺乏归属。先修补关系与基础，再谈欢庆。' },

  { id: 'five-of-wands', name: '权杖五', nameEn: 'Five of Wands', img: 'Wands05.webp', arcana: 'minor', suit: 'wands', num: 5,
    keywords: ['竞争', '冲突', '磨合'],
    meaning: '交错挥舞的权杖，代表竞争、摩擦与意见碰撞。',
    upright: '良性竞争、意见交锋、活力四射。冲突是磨合，别让意气蒙蔽目标。',
    reversed: '冲突平息、内斗消耗、回避竞争。放下无谓纷争，回归合作。' },

  { id: 'six-of-wands', name: '权杖六', nameEn: 'Six of Wands', img: 'Wands06.webp', arcana: 'minor', suit: 'wands', num: 6,
    keywords: ['胜利', '认可', '凯旋'],
    meaning: '骑着白马凯旋，代表胜利、公开认可与自信回归。',
    upright: '赢得认可、旗开得胜、自信回归。享受掌声，也记得保持谦逊。',
    reversed: '缺乏认可、骄傲受挫、胜利延迟。守住本心，别被名利左右。' },

  { id: 'seven-of-wands', name: '权杖七', nameEn: 'Seven of Wands', img: 'Wands07.webp', arcana: 'minor', suit: 'wands', num: 7,
    keywords: ['捍卫', '坚持', '立场'],
    meaning: '在制高点上抵御挑战，代表坚守立场与为信念而战。',
    upright: '坚守立场、顶住压力、勇敢应战。你的位置值得捍卫，坚持到底。',
    reversed: '力不从心、防线失守、过度防御。适时示弱或换位，保存实力。' },

  { id: 'eight-of-wands', name: '权杖八', nameEn: 'Eight of Wands', img: 'Wands08.webp', arcana: 'minor', suit: 'wands', num: 8,
    keywords: ['快速', '消息', '进展'],
    meaning: '八根权杖划过天空，代表迅捷的消息、加速与事态明朗。',
    upright: '消息传来、进度飞快、水到渠成。顺势加速，好结果即将抵达。',
    reversed: '延迟误事、节奏混乱、沟通受阻。稳住节奏，耐心等风来。' },

  { id: 'nine-of-wands', name: '权杖九', nameEn: 'Nine of Wands', img: 'Wands09.webp', arcana: 'minor', suit: 'wands', num: 9,
    keywords: ['坚韧', '防御', '底线'],
    meaning: '疲惫却仍坚守的守卫，代表韧性、警觉与最后的坚持。',
    upright: '坚持到底、经验护体、防线稳固。已到关键一程，再撑一下。',
    reversed: '过度戒备、身心俱疲、准备放弃。允许自己休息，别把世界当敌。' },

  { id: 'ten-of-wands', name: '权杖十', nameEn: 'Ten of Wands', img: 'Wands10.webp', arcana: 'minor', suit: 'wands', num: 10,
    keywords: ['重负', '责任', '压力'],
    meaning: '扛着沉重权杖前行，代表责任过载、压力与承担。',
    upright: '责任繁重、压力山大、咬牙坚持。学会分担，别让负重拖垮热情。',
    reversed: '卸下重担、拒绝扛责、力竭释放。放下不属于你的责任，轻装前进。' },

  { id: 'page-of-wands', name: '权杖侍从', nameEn: 'Page of Wands', img: 'Wands11.webp', arcana: 'minor', suit: 'wands', num: 11,
    keywords: ['探索', '热情', '新消息'],
    meaning: '好奇地注视火焰，代表探索欲、热情与新鲜消息。',
    upright: '探索新事物、热情洋溢、好消息将至。保持好奇，大胆尝试。',
    reversed: '三分钟热度、鲁莽冲动、消息延迟。把热情转化为持续的行动。' },

  { id: 'knight-of-wands', name: '权杖骑士', nameEn: 'Knight of Wands', img: 'Wands12.webp', arcana: 'minor', suit: 'wands', num: 12,
    keywords: ['冒险', '冲动', '行动'],
    meaning: '策马疾驰的冒险家，代表果敢的行动力与燃烧的热情。',
    upright: '行动力爆棚、说走就走、魅力四射。冲吧，但记得系好安全带。',
    reversed: '冲动莽撞、三心二意、半途而废。稳一稳马蹄，善始善终。' },

  { id: 'queen-of-wands', name: '权杖王后', nameEn: 'Queen of Wands', img: 'Wands13.webp', arcana: 'minor', suit: 'wands', num: 13,
    keywords: ['自信', '魅力', '热情'],
    meaning: '自信果决的领袖气质，代表魅力、热情与自主的力量。',
    upright: '自信迷人、热情感染、独立自主。发光发热，你本身就是气场。',
    reversed: '嫉妒不安、外强中干、热情耗损。修炼内功，别只活在他人的眼光里。' },

  { id: 'king-of-wands', name: '权杖国王', nameEn: 'King of Wands', img: 'Wands14.webp', arcana: 'minor', suit: 'wands', num: 14,
    keywords: ['远见', '领导', '开创'],
    meaning: '成熟果敢的开拓者，代表远见、领导力与开创精神。',
    upright: '领导力强、目标远大、开创局面。大胆决策，带团队向前冲。',
    reversed: '独断专行、愿景模糊、下属离心。多倾听，好领导懂得借力。' },

  /* ---------------- 圣杯 Cups（水 · 情感） ---------------- */
  { id: 'ace-of-cups', name: '圣杯一', nameEn: 'Ace of Cups', img: 'Cups01.webp', arcana: 'minor', suit: 'cups', num: 1,
    keywords: ['情感新始', '爱', '灵感'],
    meaning: '溢出的圣杯，象征情感与爱的源泉，代表新关系的开始或内心涌出的爱。',
    upright: '新的情感开始、爱意流动、灵感涌现。敞开心扉，接受美好。',
    reversed: '情感压抑、内心空虚、爱意堵塞。先疗愈自己，再谈付出与接受。' },

  { id: 'two-of-cups', name: '圣杯二', nameEn: 'Two of Cups', img: 'Cups02.webp', arcana: 'minor', suit: 'cups', num: 2,
    keywords: ['联结', '平等', '和解'],
    meaning: '双杯相碰、心意相通，代表平等联结、友谊爱情或和解。',
    upright: '心有灵犀、关系升温、握手言和。珍惜双向奔赴的关系。',
    reversed: '关系失衡、沟通断裂、误会滋生。坦诚沟通，修补裂痕。' },

  { id: 'three-of-cups', name: '圣杯三', nameEn: 'Three of Cups', img: 'Cups03.webp', arcana: 'minor', suit: 'cups', num: 3,
    keywords: ['欢庆', '友谊', '分享'],
    meaning: '三杯高举的欢庆场景，代表友谊、庆祝与共同喜悦。',
    upright: '朋友相聚、庆祝分享、团队和谐。与伙伴共享喜悦，快乐加倍。',
    reversed: '过度放纵、关系疏离、三人成局。检视社交，避免表面热闹。' },

  { id: 'four-of-cups', name: '圣杯四', nameEn: 'Four of Cups', img: 'Cups04.webp', arcana: 'minor', suit: 'cups', num: 4,
    keywords: ['倦怠', '反思', '新机遇'],
    meaning: '对眼前圣杯视而不见，代表倦怠、内省与对新机会的视而不见。',
    upright: '意兴阑珊、内心反思、错失良机。抬头看看，机会就在眼前。',
    reversed: '走出倦怠、重燃热情、抓住机会。打破麻木，主动出击。' },

  { id: 'five-of-cups', name: '圣杯五', nameEn: 'Five of Cups', img: 'Cups05.webp', arcana: 'minor', suit: 'cups', num: 5,
    keywords: ['失落', '遗憾', '哀伤'],
    meaning: '凝视倾倒的圣杯，代表失落、遗憾与对已失去之物的执念。',
    upright: '感到失落、遗憾难消、沉浸在悲伤。回头看看，还有两杯满水。',
    reversed: '走出阴霾、接纳现实、重拾希望。哀伤会过去，生活继续。' },

  { id: 'six-of-cups', name: '圣杯六', nameEn: 'Six of Cups', img: 'Cups06.webp', arcana: 'minor', suit: 'cups', num: 6,
    keywords: ['怀旧', '纯真', '旧人旧事'],
    meaning: '童趣与馈赠的场景，代表怀旧、纯真记忆与旧人旧事的重现。',
    upright: '旧友重逢、回忆温暖、纯真流露。善待回忆，也活在当下。',
    reversed: '沉溺过去、不愿成长、被旧事牵绊。告别往事，未来更值得期待。' },

  { id: 'seven-of-cups', name: '圣杯七', nameEn: 'Seven of Cups', img: 'Cups07.webp', arcana: 'minor', suit: 'cups', num: 7,
    keywords: ['幻象', '选择', '想象力'],
    meaning: '云端漂浮的众多圣杯，代表幻象、多选与想象力过剩。',
    upright: '选择众多、幻想纷繁、真假难辨。分清梦想与幻觉，务实做选择。',
    reversed: '迷雾散去、做出选择、脚踏实地。回归现实，认准一个方向。' },

  { id: 'eight-of-cups', name: '圣杯八', nameEn: 'Eight of Cups', img: 'Cups08.webp', arcana: 'minor', suit: 'cups', num: 8,
    keywords: ['放下', '追寻', '离开'],
    meaning: '转身离开满溢的圣杯堆，代表放下安逸、追寻更高的意义。',
    upright: '主动离开、追寻意义、告别安逸。追随内心，哪怕前路未知。',
    reversed: '犹豫徘徊、不敢离开、困在原地。问自己，是什么让你不敢走。' },

  { id: 'nine-of-cups', name: '圣杯九', nameEn: 'Nine of Cups', img: 'Cups09.webp', arcana: 'minor', suit: 'cups', num: 9,
    keywords: ['满足', '愿望', '得意'],
    meaning: '心满意足的达成场景，代表愿望成真、满足与自得其乐。',
    upright: '愿望达成、心满意足、生活安逸。享受成果，心怀感恩。',
    reversed: '表面满足、贪心不足、幸福空壳。真正的满足来自内在而非外在。' },

  { id: 'ten-of-cups', name: '圣杯十', nameEn: 'Ten of Cups', img: 'Cups10.webp', arcana: 'minor', suit: 'cups', num: 10,
    keywords: ['圆满', '家庭', '和谐'],
    meaning: '彩虹下的美满家庭，代表圆满和谐、情感归宿与家庭幸福。',
    upright: '家庭美满、关系和谐、梦想成真。珍惜身边的幸福与归属。',
    reversed: '理想与现实的落差、家庭矛盾、情感幻灭。接纳不完美，经营真实。' },

  { id: 'page-of-cups', name: '圣杯侍从', nameEn: 'Page of Cups', img: 'Cups11.webp', arcana: 'minor', suit: 'cups', num: 11,
    keywords: ['灵感', '温柔', '新消息'],
    meaning: '好奇凝视杯中鱼，代表灵感、温柔情感与充满想象的消息。',
    upright: '灵感闪现、温柔感性、好消息将至。保持开放，捕捉心动的信号。',
    reversed: '情绪化、逃避现实、消息落空。稳住情绪，别被想象牵着走。' },

  { id: 'knight-of-cups', name: '圣杯骑士', nameEn: 'Knight of Cups', img: 'Cups12.webp', arcana: 'minor', suit: 'cups', num: 12,
    keywords: ['浪漫', '追求', '理想'],
    meaning: '款款而来的浪漫骑士，代表追求、情感表达与理想主义。',
    upright: '浪漫示好、魅力攻势、为爱行动。勇敢表达心意，但别只停留在幻想。',
    reversed: '虚情假意、情感过度、逃避承诺。看清糖衣，别为表象买单。' },

  { id: 'queen-of-cups', name: '圣杯王后', nameEn: 'Queen of Cups', img: 'Cups13.webp', arcana: 'minor', suit: 'cups', num: 13,
    keywords: ['共情', '直觉', '疗愈'],
    meaning: '沉静如水的情感容器，代表共情力、直觉与温柔的疗愈力量。',
    upright: '共情细腻、直觉敏锐、温暖疗愈。温柔是你最强大的力量。',
    reversed: '情绪泛滥、过度付出、内心干涸。先照顾好自己，再照顾他人。' },

  { id: 'king-of-cups', name: '圣杯国王', nameEn: 'King of Cups', img: 'Cups14.webp', arcana: 'minor', suit: 'cups', num: 14,
    keywords: ['稳定', '智慧', '慈悲'],
    meaning: '端坐水中的沉稳王者，代表情绪智慧、平衡与慈悲的领导。',
    upright: '情绪稳定、处事成熟、以柔御刚。在动荡中保持内心的平静。',
    reversed: '情绪失控、压抑爆发、表里不一。别把情绪锁进柜子，学会疏导。' },

  /* ---------------- 宝剑 Swords（风 · 思维） ---------------- */
  { id: 'ace-of-swords', name: '宝剑一', nameEn: 'Ace of Swords', img: 'Swords01.webp', arcana: 'minor', suit: 'swords', num: 1,
    keywords: ['真相', '突破', '新想法'],
    meaning: '直指云霄的宝剑，代表清晰的真相、突破与新思维。',
    upright: '真相大白、思路清晰、一针见血。用理性切开迷雾，果断行动。',
    reversed: '混乱误解、判断失衡、言语伤人。退一步，厘清事实再说话。' },

  { id: 'two-of-swords', name: '宝剑二', nameEn: 'Two of Swords', img: 'Swords02.webp', arcana: 'minor', suit: 'swords', num: 2,
    keywords: ['两难', '回避', '平衡'],
    meaning: '蒙眼持双剑，代表两难抉择、回避与自我保护的平衡。',
    upright: '陷入两难、拒绝面对、自我封锁。放下防备，才有答案。',
    reversed: '破局时刻、揭开真相、做出抉择。蒙眼布可以摘下，是时候决定了。' },

  { id: 'three-of-swords', name: '宝剑三', nameEn: 'Three of Swords', img: 'Swords03.webp', arcana: 'minor', suit: 'swords', num: 3,
    keywords: ['心碎', '伤痛', '真相'],
    meaning: '三剑穿心，代表心碎、伤痛与被现实刺破的真相。',
    upright: '心碎难过、言语伤害、真相刺痛。允许自己悲伤，愈合需要时间。',
    reversed: '走出伤痛、原谅释怀、疗愈开始。伤口正在结痂，别反复撕开。' },

  { id: 'four-of-swords', name: '宝剑四', nameEn: 'Four of Swords', img: 'Swords04.webp', arcana: 'minor', suit: 'swords', num: 4,
    keywords: ['休息', '疗愈', '暂停'],
    meaning: '安静躺卧的骑士，代表休息、疗愈与主动的暂停。',
    upright: '休养生息、沉淀充电、暂停思考。休息不是逃避，是必要的蓄力。',
    reversed: '休息不足、焦虑苏醒、急于复工。身体在抗议，请认真对待。' },

  { id: 'five-of-swords', name: '宝剑五', nameEn: 'Five of Swords', img: 'Swords05.webp', arcana: 'minor', suit: 'swords', num: 5,
    keywords: ['冲突', '得失', '代价'],
    meaning: '胜利却孤独的场景，代表冲突、得失与赢了却失去更多。',
    upright: '冲突升级、赢了表面、失了人心。问问自己，这局值不值得。',
    reversed: '冲突平息、放下输赢、和解止损。放下执念，退一步海阔天空。' },

  { id: 'six-of-swords', name: '宝剑六', nameEn: 'Six of Swords', img: 'Swords06.webp', arcana: 'minor', suit: 'swords', num: 6,
    keywords: ['过渡', '离开', '疗愈之旅'],
    meaning: '渡船驶向平静水面，代表过渡期、离开困境与疗愈之旅。',
    upright: '走出阴霾、平稳过渡、渐入佳境。旅途虽慢，方向正确。',
    reversed: '停滞不前、旧困重现、不愿离开。卡住的地方，需要你主动破局。' },

  { id: 'seven-of-swords', name: '宝剑七', nameEn: 'Seven of Swords', img: 'Swords07.webp', arcana: 'minor', suit: 'swords', num: 7,
    keywords: ['策略', '隐瞒', '独行'],
    meaning: '偷偷带走宝剑，代表策略、隐瞒与独自行动。',
    upright: '智取巧思、有所隐瞒、独自行动。聪明要用在正途上。',
    reversed: '谎言败露、反省悔改、回归正途。诚实才是最好的策略。' },

  { id: 'eight-of-swords', name: '宝剑八', nameEn: 'Eight of Swords', img: 'Swords08.webp', arcana: 'minor', suit: 'swords', num: 8,
    keywords: ['束缚', '自我设限', '迷茫'],
    meaning: '蒙眼被围困，代表自我束缚、思维困局与无力感。',
    upright: '自我设限、感觉被困、思维僵化。束缚大多来自你的想象，剑未封口。',
    reversed: '挣脱束缚、看清出路、重获自由。你一直都有选择的权利。' },

  { id: 'nine-of-swords', name: '宝剑九', nameEn: 'Nine of Swords', img: 'Swords09.webp', arcana: 'minor', suit: 'swords', num: 9,
    keywords: ['焦虑', '失眠', '恐惧'],
    meaning: '深夜惊醒的梦魇，代表焦虑、失眠与放大化的恐惧。',
    upright: '焦虑难眠、担忧过度、负面循环。担忧是放大镜，别让黑夜吞噬你。',
    reversed: '焦虑缓解、放下心结、找回平静。最糟的并未发生，你撑过来了。' },

  { id: 'ten-of-swords', name: '宝剑十', nameEn: 'Ten of Swords', img: 'Swords10.webp', arcana: 'minor', suit: 'swords', num: 10,
    keywords: ['结束', '低谷', '重生'],
    meaning: '背上十剑的终结画面，代表彻底结束、谷底与绝处逢生的契机。',
    upright: '阶段终结、跌至谷底、痛过则通。黎明前最暗，谷底之后便是上坡。',
    reversed: '触底反弹、绝处逢生、放下重担。最坏已过，允许自己慢慢起来。' },

  { id: 'page-of-swords', name: '宝剑侍从', nameEn: 'Page of Swords', img: 'Swords11.webp', arcana: 'minor', suit: 'swords', num: 11,
    keywords: ['好奇', '警觉', '新信息'],
    meaning: '持剑戒备的观察者，代表好奇、警觉与新鲜信息。',
    upright: '好奇求知、口才机敏、新消息到来。多听多看，信息就是武器。',
    reversed: '口无遮拦、道听途说、警惕过度。先核实再传播，慎言慎行。' },

  { id: 'knight-of-swords', name: '宝剑骑士', nameEn: 'Knight of Swords', img: 'Swords12.webp', arcana: 'minor', suit: 'swords', num: 12,
    keywords: ['冲刺', '果断', '冲动'],
    meaning: '全速冲锋的骑士，代表果断行动、雷厉风行与言语的锋利。',
    upright: '果断出击、雷厉风行、直指目标。行动要快，方向也要准。',
    reversed: '鲁莽急躁、口舌之争、横冲直撞。刹一下车，别伤人也伤己。' },

  { id: 'queen-of-swords', name: '宝剑王后', nameEn: 'Queen of Swords', img: 'Swords13.webp', arcana: 'minor', suit: 'swords', num: 13,
    keywords: ['清醒', '独立', '界限'],
    meaning: '高举宝剑的冷静女王，代表清醒理性、独立与清晰的界限。',
    upright: '思维清醒、独立果断、界限分明。用智慧守护自己，温柔而坚定。',
    reversed: '冷漠尖刻、过度防备、评判他人。理性之外，别忘了温度。' },

  { id: 'king-of-swords', name: '宝剑国王', nameEn: 'King of Swords', img: 'Swords14.webp', arcana: 'minor', suit: 'swords', num: 14,
    keywords: ['权威', '公正', '逻辑'],
    meaning: '执掌宝剑的裁决者，代表逻辑、公正与权威的判断力。',
    upright: '逻辑严密、公正裁决、领导有道。以事实为依据，以理性服人。',
    reversed: '武断专横、滥用权力、逻辑偏差。警惕权力蒙眼，保持谦逊。' },

  /* ---------------- 星币 Pentacles（土 · 物质） ---------------- */
  { id: 'ace-of-pentacles', name: '星币一', nameEn: 'Ace of Pentacles', img: 'Pentacles01.webp', arcana: 'minor', suit: 'pentacles', num: 1,
    keywords: ['机遇', '富足', '开始'],
    meaning: '捧起闪耀的金币，代表物质机遇、财富起点与实际的回报。',
    upright: '新的机会、财源开启、根基建立。务实行动，让机会落地生根。',
    reversed: '机会流失、财务不稳、错失良机。检视基础，别让到手的飞了。' },

  { id: 'two-of-pentacles', name: '星币二', nameEn: 'Two of Pentacles', img: 'Pentacles02.webp', arcana: 'minor', suit: 'pentacles', num: 2,
    keywords: ['平衡', '多任务', '灵活'],
    meaning: '灵巧把玩两枚金币，代表多任务平衡、灵活与资源调配。',
    upright: '多线并行、游刃有余、动态平衡。稳住节奏，灵活应对变化。',
    reversed: '顾此失彼、压力失衡、透支过度。学会取舍，一次专注一件事。' },

  { id: 'three-of-pentacles', name: '星币三', nameEn: 'Three of Pentacles', img: 'Pentacles03.webp', arcana: 'minor', suit: 'pentacles', num: 3,
    keywords: ['协作', '技能', '认可'],
    meaning: '三人共商建造，代表团队协作、专业技能与认可。',
    upright: '团队合作、技能精进、作品获赞。专业赢得尊重，协作创造奇迹。',
    reversed: '协作不畅、被忽视、标准降低。反思配合问题，别单打独斗。' },

  { id: 'four-of-pentacles', name: '星币四', nameEn: 'Four of Pentacles', img: 'Pentacles04.webp', arcana: 'minor', suit: 'pentacles', num: 4,
    keywords: ['守财', '稳固', '执念'],
    meaning: '紧抱金币不放手，代表守成、稳固与对拥有的执念。',
    upright: '财务稳固、守住成果、谨慎务实。守住底线，但别让安全感成牢笼。',
    reversed: '过度囤积、恐惧失去、松手放下。财富是流动的，松开才有空间。' },

  { id: 'five-of-pentacles', name: '星币五', nameEn: 'Five of Pentacles', img: 'Pentacles05.webp', arcana: 'minor', suit: 'pentacles', num: 5,
    keywords: ['匮乏', '困境', '求助'],
    meaning: '风雪中蹒跚的两人，代表匮乏、困境与被忽略的帮助。',
    upright: '经济紧张、孤立无援、身心受寒。困难会过去，记得接受伸手的帮助。',
    reversed: '走出困境、转机出现、重获资源。低谷已过，重新积蓄力量。' },

  { id: 'six-of-pentacles', name: '星币六', nameEn: 'Six of Pentacles', img: 'Pentacles06.webp', arcana: 'minor', suit: 'pentacles', num: 6,
    keywords: ['给予', '收获', '平衡'],
    meaning: '公平分发的场景，代表给予与收获、施与受的平衡。',
    upright: '收支平衡、慷慨助人、善因善果。分享你的丰盛，也坦然接受馈赠。',
    reversed: '收支失衡、受恩失衡、不均不公。看清关系中的天平，别被索取耗尽。' },

  { id: 'seven-of-pentacles', name: '星币七', nameEn: 'Seven of Pentacles', img: 'Pentacles07.webp', arcana: 'minor', suit: 'pentacles', num: 7,
    keywords: ['耕耘', '等待', '评估'],
    meaning: '倚锄审视作物，代表耕耘后的等待、评估与耐心。',
    upright: '付出有回报、静待成果、复盘调整。耐心等待，收成需要时间。',
    reversed: '投入无回报、急于求成、想放弃。先看方向对不对，再谈收成。' },

  { id: 'eight-of-pentacles', name: '星币八', nameEn: 'Eight of Pentacles', img: 'Pentacles08.webp', arcana: 'minor', suit: 'pentacles', num: 8,
    keywords: ['精进', '匠艺', '专注'],
    meaning: '专注敲打金币的工匠，代表精进、专注与熟能生巧。',
    upright: '专注打磨、技能提升、勤能补拙。沉下心，把一件事做到极致。',
    reversed: '敷衍了事、标准下滑、心不在焉。找回初心，重拾匠心。' },

  { id: 'nine-of-pentacles', name: '星币九', nameEn: 'Nine of Pentacles', img: 'Pentacles09.webp', arcana: 'minor', suit: 'pentacles', num: 9,
    keywords: ['独立', '富足', '优雅'],
    meaning: '花园中自在的女主人，代表独立、富足与自给自足的优雅。',
    upright: '独立富足、享受成果、精致自律。你值得这一切，保持优雅与自信。',
    reversed: '依赖他人、过度挥霍、内心空虚。独立不是孤立，先自足再外求。' },

  { id: 'ten-of-pentacles', name: '星币十', nameEn: 'Ten of Pentacles', img: 'Pentacles10.webp', arcana: 'minor', suit: 'pentacles', num: 10,
    keywords: ['传承', '家族', '长久'],
    meaning: '家族拱门下的丰饶，代表传承、家族根基与长久的富足。',
    upright: '家族繁荣、传承延续、根基稳固。感恩来处，也为后代栽树。',
    reversed: '家族矛盾、传承断裂、根基动摇。先安内，再谈攘外。' },

  { id: 'page-of-pentacles', name: '星币侍从', nameEn: 'Page of Pentacles', img: 'Pentacles11.webp', arcana: 'minor', suit: 'pentacles', num: 11,
    keywords: ['学习', '务实', '新机会'],
    meaning: '凝视金币的学子，代表学习、务实探索与新的学习机会。',
    upright: '学习新技能、务实规划、机会萌芽。脚踏实地，从一小步开始。',
    reversed: '拖延怠惰、眼高手低、机会溜走。别只想不做，行动才有结果。' },

  { id: 'knight-of-pentacles', name: '星币骑士', nameEn: 'Knight of Pentacles', img: 'Pentacles12.webp', arcana: 'minor', suit: 'pentacles', num: 12,
    keywords: ['稳健', '勤奋', '耐心'],
    meaning: '停驻审视的可靠骑士，代表稳健、勤奋与按部就班的推进。',
    upright: '踏实可靠、按部就班、稳步前进。慢就是快，坚持就是胜利。',
    reversed: '停滞僵化、过于保守、原地打转。别让稳妥变成不敢前进的借口。' },

  { id: 'queen-of-pentacles', name: '星币王后', nameEn: 'Queen of Pentacles', img: 'Pentacles13.webp', arcana: 'minor', suit: 'pentacles', num: 13,
    keywords: ['务实', '滋养', '富足'],
    meaning: '怀抱金币的自然女王，代表务实、滋养与富足的生活艺术。',
    upright: '务实可靠、滋养他人、生活富足。把日子过成踏实的幸福。',
    reversed: '忽略自我、家务繁重、价值怀疑。别忘了你也值得被好好照料。' },

  { id: 'king-of-pentacles', name: '星币国王', nameEn: 'King of Pentacles', img: 'Pentacles14.webp', arcana: 'minor', suit: 'pentacles', num: 14,
    keywords: ['成功', '稳定', '丰盛'],
    meaning: '坐拥丰饶的王者，代表成功、稳定与成熟的物质掌控力。',
    upright: '事业有成、财务稳健、资源充足。以实力说话，财富随之而来。',
    reversed: '财务僵化、贪婪执念、根基松动。财富是工具，别让它成为主人。' }
];

/* 快速检索：id -> 卡牌对象（避免每次遍历数组） */
const CARD_BY_ID = Object.create(null);
for (let i = 0; i < TAROT_CARDS.length; i++) {
  CARD_BY_ID[TAROT_CARDS[i].id] = TAROT_CARDS[i];
}
