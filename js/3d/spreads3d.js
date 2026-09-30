/* ============================================================
 * 3D 牌桌 · 牌阵 → 桌面坐标映射
 *
 * 将现有 2D 布局（app.js LAYOUTS / spreads.js layout 字段）映射为
 * 桌面 3D 坐标。坐标系：
 *   x = 左右（相机正对 +z 方向，-x 在左）
 *   z = 纵深（-z 为远处/屏幕上方，+z 为近处/屏幕下方）
 *   y = 高度（卡牌平铺在桌面 y≈0.03）
 *   rotY = 绕竖直轴偏转（弧度），用于轻微错落与凯尔特十字横置牌
 * 新增布局只需在 switch 中补一个分支（或复用 row/grid 助手）。
 * ============================================================ */

const GX = 1.5;   // 横向卡位间距
const GZ = 1.5;   // 纵向卡位间距

/** 横向一行（n 张居中排列） */
function rowLayout(n, z = 0) {
  const arr = [];
  for (let i = 0; i < n; i++) arr.push({ x: (i - (n - 1) / 2) * GX, z });
  return arr;
}

/** cols×rows 网格（按 positions 顺序先行后列填充） */
function gridLayout(cols, rows, { x0 = 0, z0 = 0, gx = GX, gz = GZ } = {}) {
  const arr = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      arr.push({ x: x0 + c * gx, z: z0 + r * gz });
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

    case 'grid2':
      slots = gridLayout(2, 2, { x0: -0.75, z0: -0.8, gx: 1.5, gz: 1.6 });
      break;

    case 'triangle':
      // [0]现状 [1]挑战 在下排；[2]结果 在上排
      slots = [{ x: -0.85, z: 0.95 }, { x: 0.85, z: 0.95 }, { x: 0, z: -0.95 }];
      break;

    case 'hex':
      slots = gridLayout(3, 2, { x0: -1.5, z0: -0.8, gx: 1.5, gz: 1.6 });
      break;

    case 'year':
    case 'zodiac':
      slots = gridLayout(4, 3, { x0: -2.25, z0: -1.5, gx: 1.5, gz: 1.5 });
      break;

    case 'columns':
      // 灵感对应(6)：左右各 3；二选一(5)：顶部 1 + 左右各 2
      if (n === 6) {
        slots = [
          { x: -1.7, z: -1.0 }, { x: -1.7, z: 0 }, { x: -1.7, z: 1.0 },
          { x: 1.7, z: -1.0 }, { x: 1.7, z: 0 }, { x: 1.7, z: 1.0 }
        ];
      } else if (n === 5) {
        slots = [
          { x: 0, z: -1.4 },
          { x: -1.7, z: 0.15 }, { x: -1.7, z: 1.55 },
          { x: 1.7, z: 0.15 }, { x: 1.7, z: 1.55 }
        ];
      } else {
        slots = gridLayout(2, Math.ceil(n / 2), { x0: -0.75, z0: -0.75, gx: 1.5, gz: 1.5 });
      }
      break;

    case 'pyramid':
      // 1-2-1：顶部[0]；中层[1][2]；底部[3]
      slots = [{ x: 0, z: -1.2 }, { x: -0.85, z: 0 }, { x: 0.85, z: 0 }, { x: 0, z: 1.2 }];
      break;

    case 'cross5':
      // [0]中心 [1]右 [2]左 [3]下 [4]上
      slots = [{ x: 0, z: 0 }, { x: 0.95, z: 0 }, { x: -0.95, z: 0 }, { x: 0, z: 0.95 }, { x: 0, z: -0.95 }];
      break;

    case 'horseshoe':
      // U 形：左列下→底部→右列上
      slots = [
        { x: -2.4, z: -1.6 }, { x: -2.4, z: 0 }, { x: -2.4, z: 1.6 },
        { x: 0, z: 1.6 },
        { x: 2.4, z: 1.6 }, { x: 2.4, z: 0 }, { x: 2.4, z: -1.6 }
      ];
      break;

    case 'celtic':
      // 十字（前6张）+ 柱列（后4张）；[1]挑战 横置叠于[0]中心之上
      slots = [
        { x: 0, z: 0, y: 0.03 },
        { x: 0, z: 0, y: 0.06, rotY: Math.PI / 2 },
        { x: 0, z: 0.95 },
        { x: -0.95, z: 0 },
        { x: 0, z: -0.95 },
        { x: 0.95, z: 0 },
        { x: 1.7, z: -1.35 }, { x: 1.7, z: -0.45 }, { x: 1.7, z: 0.45 }, { x: 1.7, z: 1.35 }
      ];
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
