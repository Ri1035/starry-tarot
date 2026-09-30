# 开发日志 · DEV LOG

> 本文件用于记录每轮开发的关键决策、进度与待办，防止上下文丢失。

## 2026-09-30 · v1.2.0 实施

### 任务
按调研方案实施：布局系统重构 + 6 个核心牌阵 + 牌阵分类筛选 + 图标更换 + 个人主页 + 版本号显眼化。

### 用户关键信息
- 邮箱：`koka2996978242@outlook.com`（仅此联系方式可公开）
- 不公布：占卜网页链接、线下门店地址（两者都不公布）
- 昵称：1035
- 主页内容：头像（猫咪魔法师图标）+ 昵称 + 简介 + 邮箱

### 实施步骤
- [x] 提交 v1.1.0 基线（commit c08b24c）
- [x] P1 布局系统数据驱动重构（columns / pyramid / cross5 / horseshoe / zodiac）
- [x] P2 新增 6 个牌阵 + 牌阵信息字段（category / info）
- [x] P3 牌阵分类筛选
- [x] P4 favicon / apple-touch-icon 更换为猫咪魔法师
- [x] P5 个人主页「关于我」视图
- [x] P6 版本号 v1.2.0 页头徽标
- [x] 浏览器验证全部功能（含 390px 移动端适配，无 JS 报错）
- [x] 提交 v1.2.0

### 验证与修复记录
- 首次浏览器验证发现 `previewAreaGrid` 的 areaMap 键值写反：字符串键被当作 positions
  数组索引，导致马蹄铁 / 吉普赛十字预览报 `Cannot read properties of undefined`。
  已修正为 `{ 区域名: 索引 }`。
- 翻牌 `flipCard` 重建卡位时只复制 `slot-*` 类名，漏掉 cross5 / horseshoe 的 `area-*`
  类名，翻牌后布局错位。已改为复制原卡位全部类名。
- 静态资源（css/js）加 `?v=` 版本参数，避免线上用户拿到旧版缓存。

### 部署记录（地址不写入公开文件，按用户要求仅保留邮箱公开）
- 2026-09-30 v1.2.0 已通过 wrangler direct upload 部署至 Cloudflare Pages
  `starry-tarot` 项目（production branch: main），线上验证：版本徽标 v1.2.0、
  新图标、app.js 版本号均确认生效。
- 新增 `.assetsignore`，部署时排除 `.uploads/`（用户上传原图，不发布）。
- Git: commit 6806e6b，tag v1.2.0 已推送 GitHub（Ri1035/starry-tarot）。

### 技术备忘
- 布局系统：将 `buildCardsDom` 的分支逻辑改为「布局注册表 LAYOUTS」数据驱动；
  每个布局提供渲染函数与 CSS 类，卡位可带 `area` 提示。
- 新布局：columns 双栏、pyramid 金字塔、cross5 十字、horseshoe 弧形、zodiac 宫位网格。
- 牌阵数据新增字段：`category`（love/career/growth/time/life）、`info`（适用场景与解读要点）。
- 图标：源文件 `/workspace/.uploads/3e0417a6-4738-460b-adb0-bde0b2d4608d_用量是否正常.jpeg`，
  处理输出到 `assets/icon/`（favicon + apple-touch-icon 180×180）。
- 个人主页邮箱用 `mailto:` 链接，仅展示邮箱文本与复制按钮，无任何外链。
