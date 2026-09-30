# 星穹塔罗 · Starry Tarot

纯前端塔罗牌互动网页。神秘星空氛围、洗牌/翻牌动画、10 种牌阵、正逆位解读、解读复制与本地历史保存。无需后端与数据库，可部署到任意静态托管平台（GitHub Pages / Cloudflare Pages / Vercel 等）。

- 当前版本：v1.0.0（详见 [CHANGELOG.md](./CHANGELOG.md)）
- 技术栈：原生 HTML + CSS + JavaScript（无任何第三方依赖）
- 卡牌素材：公版 Rider-Waite（1909）塔罗牌 78 张，已转 WebP 压缩

## 功能特性

| 功能 | 说明 |
| --- | --- |
| 神秘氛围 UI | 星空渐变、星屑粒子、辉光卡片，PC / 移动端自适应 |
| 牌阵系统 | 内置 10 种牌阵，支持手动选择；另有"单卡速抽"快捷入口 |
| 抽卡交互 | 洗牌动画、3D 翻牌动画、随机抽牌（正位 / 逆位各 50%） |
| 卡牌展示 | 牌面图片、牌名、基础含义、正位解读、逆位解读 |
| 结果功能 | 全套牌阵解读展示，一键复制解读文本 |
| 本地保存 | 解读结果保存到浏览器 localStorage，随时在"历史记录"中回看 |
| 免责声明 | 页面底部固定声明：塔罗仅为趣味娱乐，不构成人生、投资、重大决策建议 |

## 项目结构

```
.
├── index.html            # 页面结构（首页 / 抽牌视图 / 结果视图 / 弹窗）
├── css/
│   └── style.css         # 全部样式与动画（含响应式断点）
├── js/
│   ├── app.js            # 主逻辑：视图切换、洗牌抽牌、翻牌、结果渲染、历史管理
│   └── data/
│       ├── cards.js      # 78 张卡牌数据（名称 / 含义 / 正逆位解读）
│       └── spreads.js    # 牌阵数据（布局类型 + 卡位标签）
└── assets/
    └── cards/            # 78 张卡牌图片（WebP）
```

## 本地运行

```bash
# 任意静态服务器即可，例如：
python3 -m http.server 8080
# 浏览器打开 http://localhost:8080
```

> 纯前端页面，直接双击 `index.html` 也能运行（图片为相对路径）。

## 部署到 Cloudflare Pages

1. 将本仓库推送到 GitHub（见下方"推送 GitHub"）。
2. 打开 [Cloudflare Dashboard](https://dash.cloudflare.com) → Workers & Pages → **Create** → **Pages** → **Connect to Git**。
3. 授权并选择本仓库。
4. 构建设置：
   - **Framework preset**：`None`
   - **Build command**：留空
   - **Build output directory**：`/`（或留空）
5. 点击 **Save and Deploy**，等待部署完成即可获得 `*.pages.dev` 访问地址。

## 如何新增牌阵

无需修改任何逻辑代码，只需向 `js/data/spreads.js` 的 `TAROT_SPREADS` 数组追加一项：

```js
{
  id: 'my-spread',          // 唯一标识（小写英文）
  name: '我的牌阵',          // 显示名称
  desc: '一句话简介',        // 预览弹窗中展示
  count: 3,                 // 卡牌数量，必须与 positions 长度一致
  layout: 'row',            // 布局类型，见下方说明
  positions: [              // 卡位标签，第 1 张对应 positions[0]
    { label: '位置一' },
    { label: '位置二' },
    { label: '位置三' }
  ]
}
```

### layout 可选值

| layout | 排布方式 | 适用 |
| --- | --- | --- |
| `single` | 单张居中 | 1 张 |
| `row` | 横向一行（自动换行） | 3~5 张 |
| `grid2` | 2×2 网格 | 4 张 |
| `triangle` | 三角堆叠 | 3 张 |
| `hex` | 六芒星网格 | 6 张 |
| `year` | 12 宫网格 | 12 张 |
| `celtic` | 凯尔特十字（十字 + 柱列，第 2 张为覆盖牌） | 10 张 |

> 若新增布局形态，只需在 `css/style.css` 中补充对应的 `.layout-<name>` 规则，并在 `js/app.js` 的 `buildSlots` / `buildPreviewSlots` 中处理网格区类名即可。

## 如何修改解读文案

所有卡牌文案集中在 `js/data/cards.js`，每张卡牌结构如下：

```js
{
  id: 'TheFool',            // 与图片文件名对应（00-TheFool.webp）
  name: '愚者',             // 中文牌名
  nameEn: 'The Fool',       // 英文牌名
  meaning: '基础含义一句话',
  upright: '正位解读',
  reversed: '逆位解读'
}
```

直接修改 `meaning` / `upright` / `reversed` 字段即可，无需改动其他代码。

## 许可证

本项目代码采用 MIT 许可证。塔罗卡牌素材来自公版 Rider-Waite（1909），版权归原作者所有（已进入公共领域）。
