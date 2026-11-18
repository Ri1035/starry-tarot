/* ============================================================
 * 3D 牌桌 · 牌阵 → 桌面坐标映射
 *
 * 将现有 2D 布局（app.js LAYOUTS / spreads.js layout 字段）映射为
 * 桌面 3D 坐标。坐标系：
 *   x = 左右（相机正对 +z 方向，-x 在左）
 *   z = 纵深（-z 为远处/屏幕上方，+z 为近处/屏幕下方）
 *   y = 高度（卡牌平铺在桌面 y≈0.03）
 *   rotY = 绕竖直轴偏转（弧度），用于轻微错落与凯尔特十字横置牌
 *
 * ⚠️ v1.3.5 起卡位间距按「卡牌实际尺寸」推导，不再靠经验取值：
 *    卡牌 1.4(宽) × 2.35(高)，因此横向间距必须 ≥ 1.4、纵向间距必须 ≥ 2.35，
 *    否则相邻牌会在桌面上互相压盖（旧坐标用的是 0.9~1.6，重叠非常明显）。
 * 新增布局只需在 switch 中补一个分支（或复用 row/grid 助手）。
 * ============================================================ */

const CARD_W = 1.4;      // 与 table3d.js 的 CFG.cardW 保持一致
const CARD_H = 2.35;     // 与 table3d.js 的 CFG.cardH 保持一致
const GX = CARD_W + 0.5;    // 横向卡位间距 1.90（留 0.5 间隙）
const GZ = CARD_H + 0.25;   // 纵向卡位间距 2.60（留 0.25 间隙，再大最外侧牌角会出桌沿）
const HALF_GX = GX / 2;
const HALF_GZ = GZ / 2;

/** 横向一行（n 张居中排列） */
function rowLayout(n, z = 0) {
  const arr = [];
  for (let i = 0; i < n; i++) arr.push({ x: (i - (n - 1) / 2) * GX, z });
  return arr;
}

/** cols×rows 网格（按 positions 顺序先行后列填充），整体居中于 (x0, z0) */
function gridLayout(cols, rows, { x0 = 0, z0 = 0, gx = GX, gz = GZ } = {}) {
  const arr = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      arr.push({
        x: x0 + (c - (cols - 1) / 2) * gx,
        z: z0 + (r - (rows - 1) / 2) * gz
      });
    }
  }
  return arr;
}

/** 根据牌阵元数据生成卡位坐标数组（与 positions 一一对应） */
export function getSpreadPositions3d(spread) {
  const n = spread.count;
  let slots = [];

  switch (spread.layout) {
    case 'single':
      slots = [{ x: 0, z: 0 }];
      break;

    case 'row':
      slots = rowLayout(n);
      break;

    case 'grid2':                                     // 2×2
      slots = gridLayout(2, 2);
      break;

    case 'triangle':
      // [0]现状 [1]挑战 在下排；[2]结果 在上排
      slots = [
        { x: -HALF_GX, z: HALF_GZ }, { x: HALF_GX, z: HALF_GZ },
        { x: 0, z: -HALF_GZ }
      ];
      break;

    case 'hex': {
      // v1.5.4：与 2D 六边形环一致（1 左上 / 2 右上 / 3 右 / 4 右下 / 5 左下 / 6 左）
      // 每张牌的长轴沿半径方向，避免轴向排列时相邻卡位在 x、z 上同时小于牌宽牌高而互相压盖
      const R = 2.5;
      slots = [];
      for (let i = 0; i < 6; i++) {
        const a = (-120 + i * 60) * Math.PI / 180;
        slots.push({ x: Math.cos(a) * R, z: Math.sin(a) * R, rotY: a + Math.PI / 2 });
      }
      break;
    }

    case 'year':
    case 'zodiac':                                    // 4×3（月相八相为 4×2）
      slots = n === 8 ? gridLayout(4, 2) : gridLayout(4, 3);
      break;

    case 'columns':
      if (n === 6) {
        // 灵感对应：左 3 / 右 3，两列各占一栏
        slots = [
          { x: -1.6, z: -GZ }, { x: -1.6, z: 0 }, { x: -1.6, z: GZ },
          { x: 1.6, z: -GZ }, { x: 1.6, z: 0 }, { x: 1.6, z: GZ }
        ];
      } else if (n === 5) {
        // 二选一：顶部 1 张总览，下方左右各 2 张
        slots = [
          { x: 0, z: -GZ },
          { x: -1.6, z: 0 }, { x: -1.6, z: GZ },
          { x: 1.6, z: 0 }, { x: 1.6, z: GZ }
        ];
      } else {
        slots = gridLayout(2, Math.ceil(n / 2));
      }
      break;

    case 'pyramid':
      // 1-2-1：顶部[0]；中层[1][2]；底部[3]
      slots = [
        { x: 0, z: -GZ },
        { x: -HALF_GX, z: 0 }, { x: HALF_GX, z: 0 },
        { x: 0, z: GZ }
      ];
      break;

    case 'cross5':
      // [0]中心 [1]右 [2]左 [3]下 [4]上
      slots = [
        { x: 0, z: 0 },
        { x: GX, z: 0 }, { x: -GX, z: 0 },
        { x: 0, z: GZ }, { x: 0, z: -GZ }
      ];
      break;

    case 'horseshoe':
      // U 形：左列下→底部→右列上
      slots = [
        { x: -2.5, z: -GZ }, { x: -2.5, z: 0 }, { x: -2.5, z: GZ },
        { x: 0, z: GZ },
        { x: 2.5, z: GZ }, { x: 2.5, z: 0 }, { x: 2.5, z: -GZ }
      ];
      break;

    case 'celtic':
      // 十字（前 6 张）整体左移，右侧留给柱列（后 4 张）
      // v1.5.4：柱列间距 2.15 → 2.35（卡牌缩放 0.95 后高 2.23），取消逐张抬高，
      // 原来"略叠一沓"在实机上会读成穿模；挑战位抬到 0.10，翻下面的牌不再穿过去。
      slots = [
        { x: -1.7, z: 0 },
        { x: -1.7, z: 0, y: 0.10, rotY: Math.PI / 2 },
        { x: -1.7, z: GZ },                                   // 基础（下）
        { x: -1.7 - GX, z: 0 },                               // 过去（左）
        { x: -1.7, z: -GZ },                                  // 目标（上）
        { x: -1.7 + GX, z: 0 },                               // 未来（右）
        { x: 2.4, z: -3.4 },
        { x: 2.4, z: -1.05 },
        { x: 2.4, z: 1.05 },
        { x: 2.4, z: 3.4 }
      ];
      break;

    /* ---- v1.5.1 独立布局 ----
     * 生命之树：3D 用「双柱 + 中轴」的简化构图（完整 6 行树冠在桌面放不下），
     * 卡牌在 table3d 里按 layout 缩小到 0.68 倍，保证同一列不重叠。
     */
    case 'tree':
      slots = [
        { x: 0, z: -4.0 },    // 王冠
        { x: 1.6, z: -2.7 },  // 智慧
        { x: -1.6, z: -2.7 }, // 理解
        { x: 1.6, z: -1.0 },  // 慈悲
        { x: -1.6, z: -1.0 }, // 严厉
        { x: 0, z: -1.0 },    // 光辉
        { x: 1.6, z: 0.7 },   // 胜利
        { x: -1.6, z: 0.7 },  // 荣耀
        { x: 0, z: 1.9 },     // 基础
        { x: 0, z: 3.5 }      // 王国
      ];
      break;

    case 'chakra':
      // 七脉轮：单列自下而上（屏幕下方 → 上方）
      slots = [];
      for (let i = 0; i < n; i++) slots.push({ x: 0, z: (3 - i) * 1.5 });
      break;

    default:
      slots = rowLayout(n);
  }

  // 兜底：数量不足时补到中心（防御，正常数据不会触发）
  while (slots.length < n) slots.push({ x: 0, z: 0 });

  // 轻微随机偏转，模拟手洗错落（凯尔特十字横置牌除外）
  return slots.slice(0, n).map((s) => ({
    x: s.x,
    z: s.z,
    y: s.y !== undefined ? s.y : 0.03,
    rotY: s.rotY !== undefined ? s.rotY : (Math.random() * 8 - 4) * (Math.PI / 180)
  }));
}
