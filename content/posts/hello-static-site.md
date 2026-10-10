---
title: 把个人门户重构成一个静态站点
date: 2026-10-10
tags: [前端, 重构, 静态站点]
excerpt: 视觉一行没动，但整个站点换了骨架：源文件拆开、加了零依赖构建脚本，博客和项目终于有真页面了。
---

## 为什么要动结构

原来的 `personal-site` 是四个文件：`index.html`、`assets/styles.css`、`assets/main.js`、`assets/site-data.js`。
好处是**双击就能看**，坏处也在这：`main.js` 有 2170 行、`styles.css` 有 1532 行，
想改某一处得先滚到对应的位置；而「博客」「作品集」这些卡片点开永远是占位详情页——因为没有真页面。

这次只做一件事：**把骨架换掉，把外观留下。**

- 源文件拆成 `src/styles/*.css`（20 个章节）和 `src/js/*.js`（13 个章节），改哪一块就看哪个文件；
- 加一个 `scripts/build.mjs`，把源文件拼回 `assets/styles.css` 和 `assets/main.js`；
- 内容搬进 `content/`：文章是 Markdown，项目是 Markdown，简历是 JSON；
- 构建时顺便生成 `blog/`、`projects/`、`resume.html`，以及 `sitemap.xml`、`rss.xml`、`robots.txt`。

## 为什么不用打包器

因为这个站点的身份是"零依赖、双击就能看"。

一旦引入 webpack / vite，就多出一条 `npm install` 的命令，
而这些页面的交互其实只有粒子、转场、命令面板那几件事——不值得为此背上一个工具链。

所以构建脚本只用 Node 内置模块：拼接、渲染 Markdown、写文件，没了。
代价是 Markdown 渲染器得自己写一份（`scripts/lib/markdown.mjs`），
好处是**服务器上只要装了 Node，`node scripts/build.mjs` 就能出站**，
不需要 `node_modules`，不需要锁文件，也不会因为某个包三年不更新而构建失败。

## 一件麻烦事：文档锁死不滚

一屏一页的版式，靠的是 `html, body { height: 100%; overflow: hidden }`。
博客列表这种长页面不能继承这套锁，否则整页只能看到第一屏。

解法是在 `<html>` 上分一个 `data-layout`：

```html
<!-- 门户首页 -->
<html data-layout="stage">
<!-- 博客 / 项目 / 简历 -->
<html data-layout="page">
```

CSS 里只对 `page` 解锁：

```css
html[data-layout="page"],
html[data-layout="page"] body {
  height: auto;
  min-height: 100%;
  overflow: visible;
}
```

两者共用同一套设计令牌和同一份样式表，所以点进博客页不会有"换了个网站"的感觉。

> 顺便记一个坑：面板里的紧凑系数 `--k` 只在舞台上存在。
> 长页面如果没定义 `--k`，所有 `calc(28px * var(--k))` 的声明会整条失效——
> 不是变成 0，而是**整条被丢掉**。所以长页面必须显式写 `--k: 1`。

## 写作流程

```bash
# 1. 在 content/posts/ 里新建一个 .md，写正文
# 2. 生成页面
node scripts/build.mjs
# 3. 本地看一眼
python -m http.server 8000
```

文章列表、RSS、sitemap、上一篇/下一篇都会自动跟上，不用再配一遍。
