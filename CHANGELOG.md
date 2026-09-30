# 星穹塔罗 · 版本记录

## v1.3.2 · 3D 修复与首页精简
- 修复 3D 牌桌白屏：R2 上 OrbitControls 存放在 `three/r160/OrbitControls.js`，而 importmap 前缀
  `three/addons/` 请求的是 `three/r160/controls/OrbitControls.js` → 404，导致 3D 模块加载失败、
  `window.Tarot3D` 为空、进入 3D 视图无任何内容。已将文件移至标准 addons 路径
  `three/r160/controls/OrbitControls.js`（删除根目录冗余副本），模块恢复正常加载
- 首页精简：移除「塔罗画廊 / 关于我 / 历史记录」三个按钮（顶部导航已有对应入口，避免重复 UI），
  首页仅保留「选择牌阵 / 单卡速抽 / 3D 牌桌」
- 3D 牌桌本地回归（软件 WebGL）：场景渲染（金色圆桌/星空粒子）、恋人金字塔 4 张落牌、
  点击翻牌、全部翻开、自动生成解读全流程通过，无 JS 报错

## v1.3.1 · 加载性能优化
- 资源自托管：字体（Cinzel / Noto Serif SC 全部字重与子集）与 Three.js（0.160 核心 + OrbitControls）从 Google Fonts / jsdelivr 迁移至自建 R2 对象存储
- R2 目录规范：`three/r160/`（Three.js ESM）、`fonts/`（按字体/字重/子集分目录），r2.dev 公网域名提供 HTTPS 直链
- 缓存策略：静态资源带 `?v=1.3.1` 版本参数，R2 对象 `Cache-Control: public, max-age=31536000, immutable`
- 移除对 Google Fonts / jsdelivr 的外部依赖，规避境外 CDN 在国内加载慢/不稳的问题
- 已部署：Cloudflare Pages `starry-tarot`（production 76fcfff6），GitHub tag v1.3.1

## v1.3.0 · 3D 占卜牌桌
- 新增 3D 占卜牌桌视图（Three.js CDN ESM + importmap），保留 2D 全部功能
- 3D 场景：星空粒子、金色圆桌、卡牌飞牌/翻牌/悬停动画、OrbitControls 拖拽旋转缩放
- 牌阵坐标映射：新增 spreads3d.js，将 12+ 种牌阵布局映射到 3D 卡位
- 流程对接：3D 选牌阵 → 落牌 → 点击/一键翻牌 → 自动生成解读（与 2D 共用解读逻辑）
- WebGL 降级：不支持时提示并引导返回 2D 占卜
- 资源管理：离开 3D 视图时统一释放 GPU 资源（geometry/material/texture）
- 修复：mount() 参数与局部变量同名导致模块加载失败；卡牌朝向翻转（背面朝上改为 -90°，翻牌转到 +90°）；物理光照模式下灯光强度不足导致场景欠曝

## v1.2.0 · 牌阵扩展与个人主页
- 布局系统重构为数据驱动（新增 columns / pyramid / cross5 / horseshoe / zodiac 五种布局）
- 新增 6 个核心牌阵：二选一、恋人金字塔、吉普赛十字、马蹄铁、十二宫、灵感对应
- 牌阵新增主题分类（爱情 / 事业 / 成长 / 时间 / 综合）与详情信息字段
- 牌阵选择弹窗增加分类筛选
- 网站图标更换为猫咪魔法师（favicon + apple-touch-icon）
- 新增「关于我」个人主页（头像 / 昵称 1035 / 简介 / 邮箱）
- 版本号在页头显示，v1.2.0
- 修复：十字/马蹄铁预览 areaMap 索引错误；翻牌后网格区类名丢失导致布局错位
- 静态资源（css/js）加版本参数 ?v=1.2.0，升级即失效缓存

## v1.1.0 · 塔罗画廊
- 画廊视图展示全部 78 张塔罗牌，支持按牌组筛选
- 卡牌详情弹窗（牌意 / 正位 / 逆位 / 关键词）
- 动效增强：入场交错动画、3D 悬浮、光晕呼吸、按钮流光

## v1.0.0 · 初版
- 纯前端塔罗占卜：多牌阵、洗牌与翻牌动画、正逆位解读、一键复制、本地历史记录
- 星空粒子背景 + 星云光晕
