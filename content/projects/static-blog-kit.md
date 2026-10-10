---
title: 静态博客生成器
description: 把 Markdown 变成静态页面的一百多行脚本：文章列表、上一篇/下一篇、RSS、sitemap 全都自动生成。
date: 2026-09-30
tech: [Node.js, Markdown]
repo: https://github.com/
order: 2
featured: false
excerpt: 不用打包器，只用 Node 内置模块：拼接样式脚本、渲染 Markdown、写 SEO 产物。
---

## 为什么不用现成的

现成的静态站点生成器（Hugo / Astro / Eleventy）都很好，但都要装工具链、
学一套目录约定和模板语法。这个站点的内容量级很小，值得自己写一百多行，
换来的好处是：

- 服务器上只要有 Node，`node scripts/build.mjs` 就能出站，不需要 `node_modules`；
- 没有版本升级问题——不会因为某个依赖三年不更新而构建失败；
- 出问题的地方都在自己能读懂的代码里。

## 它做四件事

1. 把 `src/styles/*.css`、`src/js/*.js` 按清单拼成 `assets/styles.css`、`assets/main.js`；
2. 把 `content/site.js` 拷成 `assets/site-data.js`，顺手把导航卡片里的花括号占位符换成真实数量（「3 篇」「2 个」「已上线」）；
3. 把 `content/posts/*.md`、`content/projects/*.md` 渲染成页面，
   并生成列表页、上一篇/下一篇、`resume.html`；
4. 写 `sitemap.xml`、`rss.xml`、`robots.txt`、`404.html`。

## 自己写的 Markdown 渲染器

支持标题（带锚点）、粗斜体、删除线、行内代码、链接、图片、裸网址、
有序/无序/嵌套列表、引用、围栏代码块（带高亮）、GFM 表格、分隔线。
不做 CommonMark 全兼容——够写博客就行。

安全上默认**转义正文里的 HTML**，不原样输出。

代码高亮是构建期做的：扫一遍注释 / 字符串 / 数字 / 关键字 / 函数名，
输出 `<span class="tok-*">`，配色仍然落在站点的墨绿灰阶里，不引入彩虹色。

## 输出的东西

```
blog/index.html       文章列表
blog/<slug>.html      文章详情（含 JSON-LD）
projects/index.html   项目列表
projects/<slug>.html  项目详情
resume.html           简历
404.html              找不到页面
sitemap.xml  rss.xml  robots.txt
```
