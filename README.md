# 星穹塔罗 · Starry Tarot

> 纯前端塔罗牌互动网页：星空氛围、洗牌 / 翻牌动画、10 种牌阵、正逆位解读，无需后端即可部署到任意静态托管平台。

![JavaScript](https://img.shields.io/badge/-JavaScript-f7df1e?logo=javascript&logoColor=black)
![HTML5](https://img.shields.io/badge/-HTML5-e34f26?logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/-CSS3-1572b6?logo=css3&logoColor=white)
![Cloudflare Pages](https://img.shields.io/badge/Cloudflare%20Pages-在线体验-F38020?logo=cloudflare&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-green)

## ✨ 项目简介

星穹塔罗是一个完全在浏览器本地运行的塔罗牌占卜互动页面。用户洗牌、抽牌后可查看牌面含义与正逆位解读，解读结果支持一键复制并保存在浏览器本地历史记录中。项目无后端、无数据库、无第三方依赖，可部署到 GitHub Pages / Cloudflare Pages / Vercel 等任意静态托管平台。

## 🚀 特性亮点

| 维度 | 说明 |
| --- | --- |
| 星空氛围 UI | 星空渐变、星屑粒子、辉光卡片，PC / 移动端自适应 |
| 10 种牌阵 | 内置牌阵支持手动选择，另有「单卡速抽」快捷入口 |
| 洗牌 / 翻牌动画 | 3D 翻牌动画、随机抽牌（正位 / 逆位各 50%） |
| 牌面解读 | 展示牌面图片、牌名、基础含义与正逆位解读，全套牌阵解读一键复制 |
| 历史记录 | 解读结果保存到浏览器 localStorage，可在「历史记录」中回看 |
| 免责声明 | 页面底部固定说明：塔罗仅为趣味娱乐，不构成人生、投资、重大决策建议 |

## 📖 快速开始

```bash
# 任意静态服务器即可，例如：
python3 -m http.server 8080
# 浏览器打开 http://localhost:8080
```

> 纯前端页面，直接双击 `index.html` 也能运行（图片为相对路径）。

## 🌐 在线体验

| 入口 | 地址 |
| --- | --- |
| 在线体验 | https://starry-tarot.pages.dev |
| 源码仓库 | https://github.com/Ri1035/starry-tarot |

## 🧰 技术栈

- 原生 HTML + CSS + JavaScript（无任何第三方依赖）
- 卡牌素材：公版 Rider-Waite（1909）塔罗牌 78 张，已转 WebP 压缩
- 许可证：MIT

## 🙏 参考与致谢

- three.js 官方 examples（粒子 / 发光效果参考，MIT）
- [zlZayn/Tarot](https://github.com/zlZayn/Tarot)、[htrnguyen-labs/tarot_ritual](https://github.com/htrnguyen-labs/tarot_ritual)（开源参考，MIT，仅参考交互思路，未引入依赖）
- Rider-Waite（1909）公版塔罗牌插画（公共领域素材，用作卡牌牌面）

> 牌阵算法、洗牌动画等实现细节见源码（`js/`），详细实现不做展开。

## 修改记录

> 说明：修改记录仅记录文档维护变更，不计入版本更新。

| 日期 | 修改内容 |
| --- | --- |
| 2026-10-05 | README 精简为项目介绍，补充 topics 标签 |
| 2026-10-05 | README 美化丰富：补充在线体验与参考来源，完善使用说明 |
