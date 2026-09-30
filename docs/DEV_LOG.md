# 开发日志 · DEV LOG

> 本文件用于记录每轮开发的关键决策、进度与待办，防止上下文丢失。

## 2026-09-30 · v1.3.1 加载性能优化（资源迁 R2）

### 任务
用户反馈加载慢，要求将模型等资源放入「资源账号」的 R2，建好目录并命名规范；该 token 只放资源、不用于部署。

### Token 验证结论（用户提供的两个 token 都正确）
- 部署 token `cfat_oXXX…e4`：Cloudflare Pages 账号 f1b789…，可列出/管理 Pages 项目，用于 Pages 部署。
- 资源 token `cfat_Hqc…585`：受限 API token（无 user 级权限，`/user/tokens/verify` 会报错属正常），
  其账号 `07d2274c8922a9bbaecfb3d7d7753651`（Ri1OE5），`/accounts` 与 R2 接口均正常 → 只用于 R2 资源上传。
- 注意：Cloudflare API token 不能直接当 S3 的 AccessKey 用（长度 53 ≠ 32），S3 上传需走 R2 REST/wrangler。

### 决策记录
- 慢源：Google Fonts（Cinzel + Noto Serif SC）与 jsdelivr Three.js 在国内加载慢/不稳。
- 方案：全部自托管到 R2 `starry-tarot-assets` bucket（资源账号），r2.dev 公网域名直链，
  对象带 `Cache-Control: public, max-age=31536000, immutable`，页面侧资源加 `?v=1.3.1` 版本参数。
- 目录规范：`three/r160/three.module.js`、`three/r160/OrbitControls.js`；`fonts/<family>/<weight>/<n>.woff2`。
- 字体本地化：Python 解析 Google CSS2（Chrome UA 取 woff2），309 个 woff2 子集 + 生成 `css/fonts.css`
  （@font-face 指向 R2），页面移除 Google Fonts 引用。
- importmap：`three` 与 `three/addons/` 指向 R2。

### 实施步骤
- [x] 验证两 token（见上）
- [x] 启用 bucket r2.dev 公网访问（PUT domains/managed，域名 `pub-57bea9a8f47f44be95eae1e1f5faadf5.r2.dev`）
- [x] 下载 Three.js 0.160 两个文件、字体 309 个 woff2 到 /tmp（不落工作区）
- [x] wrangler r2 object put 上传（三.js + 字体），content-type / cache-control 均正确
- [x] index.html：字体链接换 css/fonts.css，importmap 指向 R2，全部资源 ?v=1.3.1，版本徽标 v1.3.1
- [x] app.js：APP_VERSION → 1.3.1
- [x] 线上验证（curl 直链 + 浏览器回归）
- [x] 提交 v1.3.1（commit 70ebb2a / tag v1.3.1 已推送 GitHub Ri1035/starry-tarot）
- [x] 部署（部署 token `cfat_oXXX…e4` 验证有效：/accounts 正常、/user/tokens/verify 报错属
  权限正常现象）→ wrangler pages deploy（暂存目录排除 docs/.uploads），production 76fcfff6

### 部署记录（地址不写入公开文件，按用户要求仅保留邮箱公开）
- 2026-09-30 v1.3.1 已通过 wrangler direct upload 部署至 Cloudflare Pages
  `starry-tarot` 项目（production branch: main），正式 production：76fcfff6。
  线上验证：index.html 引用 `css/fonts.css?v=1.3.1`，importmap 指向 R2
  `pub-57bea9…r2.dev/three/r160/`，R2 直链 three.module.js（1.27MB）与字体 woff2 均 200。
- 隐私修正：早期部署把 `docs/DEV_LOG.md` 与 `.uploads/`（用户原图）传上了站点。
  排查确认 wrangler 4.x `pages deploy` 不读取 `.assetsignore`（仅 Workers assets 生效），
  故改为「构建暂存目录」排除：rsync --exclude docs/.uploads/.wrangler/.git 到 /tmp/pages-build
  再部署。验证新 production 上 `/docs/DEV_LOG.md` 与 `.uploads/*` 均返回 index.html
  SPA 回退（11782B，与不存在路径一致），敏感内容已从线上移除。

### 技术备忘
- R2 REST 无对象上传接口，对象写入走 wrangler r2 object put（Bearer token）或 S3 API（需 32 位 AccessKey）。
- r2.dev 启用接口：`PUT /accounts/{account_id}/r2/buckets/{bucket}/domains/managed`，body `{"enabled":true}`。
- 字体 @font-face 家族名保持 `Cinzel` / `Noto Serif SC` 不变，CSS 变量无需改动。

## 2026-09-30 · v1.3.0 实施（3D 占卜牌桌）

### 任务
按已批准方案实施 3D 占卜牌桌：新增视图保留 2D、不做手势识别、Three.js 走 CDN ESM + importmap。

### 决策记录
- 技术路线：Three.js 0.160（CDN ESM） + OrbitControls + importmap；table3d.js 为 ES module，
  通过 `window.Tarot3D = { mount, unmount, startReading, flipAll }` 暴露给经典脚本 app.js。
- 牌阵坐标：spreads3d.js 依据 spreads.js 的 layout/count 生成 3D 卡位数组。
- 开源参考：zlZayn/Tarot、htrnguyen-labs/tarot_ritual（MIT），仅参考交互思路，未引入依赖。
- 资源策略：geometry/material/texture 缓存复用，unmount 时统一 dispose；贴图按牌缓存。

### 实施步骤
- [x] P1 场景：渲染器 / 相机 / 灯光 / 圆桌 / 星空粒子 / OrbitControls
- [x] P2 卡牌：Canvas 背面纹理（紫金星月）+ webp 正面贴图、悬停浮起、3D 翻牌
- [x] P3 牌阵 3D 坐标映射（spreads3d.js）
- [x] P4 流程：3D 选牌阵 → 落牌 → 点击/一键翻牌 → tarot:flip3d 通知 app.js 出解读
- [x] WebGL 降级 + 返回 2D 引导
- [x] E2E 自动化验证（Puppeteer，headless swiftshader）

### 验证与修复记录
- `mount(el)` 参数与函数内 `const el = renderer.domElement` 同名，ES module 解析即抛
  `Identifier 'el' has already been declared`，导致整个 3D 模块加载失败、canvas 永不创建。
  改为 `canvasEl`。
- 卡牌朝向颠倒：原 `group.rotation.x = Math.PI`（180°）落牌即正面朝上，翻牌动画转回 0°
  反而背面朝上。修正为落牌 `-Math.PI/2`（背面朝上）、翻牌插值 `-90°→+90°`、终态 `+90°`。
- 物理光照（r155+ useLegacyLights=false）下 SpotLight/PointLight 强度需按 candela 量级：
  Ambient 1.1 / Spot 210 / Point 60，否则场景整体欠曝、卡牌不可辨。
- 背面纹理提亮（#4a2f7e 渐变 + emissive 0.7），卡牌从桌面浮现。
- E2E 结论：进入 3D → 选牌 → 落牌（背面朝上）→ 翻牌 → 自动出解读 → 重新进入 3D 挂载正常，无 JS 报错。

### 部署记录（地址不写入公开文件，按用户要求仅保留邮箱公开）
- 见 v1.2.0 部署记录；v1.3.0 部署详见 git tag v1.3.0。

### 技术备忘
- Three.js 资源释放清单：geometry、material（含 map/normalMap 等贴图）、controls.dispose()、
  ResizeObserver.disconnect()、cancelAnimationFrame。
- 渲染循环仅在 3D 视图激活时运行，离开视图立即 unmount，避免后台 GPU 占用。
- 事件契约：`tarot:draw3d`（app→3D，备用）、`tarot:flip3d`（3D→app 每翻一张）、
  `tarot:use2d`（WebGL 不可用时引导回 2D）。

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
