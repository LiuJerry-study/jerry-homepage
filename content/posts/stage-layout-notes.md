---
title: 入门笔记：一屏一页的版式是怎么锁住的
date: 2026-08-22
tags: [CSS, 版式, 入门]
excerpt: 文档不滚、翻屏靠面板原地换——记一下这套版式的三条规则，以及什么时候该让它内部滚。
---

## 三条规则

**第一条：文档锁死。**

```css
html, body {
  height: 100%;
  overflow: hidden;
  overscroll-behavior: none;
}
```

从此 `window.scrollTo` 永远不会被调用，滚动条也永远不会出现。

**第二条：面板叠在同一格里。**

```css
.stage { position: fixed; inset: 0; overflow: hidden; }
.panel { position: absolute; inset: 0; visibility: hidden; }
.panel.is-active { visibility: visible; }
```

翻屏 = 给走的那块加 `.is-out`、来的那块加 `.is-in`，动画结束把类摘掉。
两块面板从头到尾都没离开过 DOM，所以返回时状态还在。

**第三条：装不下先收紧，再屏内滚。**

每块面板有一份紧凑系数 `--k`，从 1 往 0.64 一档一档退，字号、间距、卡片高度跟着缩。
`--k` 到底还排不下，才让**那一屏内部**滚（`.panel-scroll`），文档仍然一动不动。

## 什么时候会踩坑

手机上单列卡片墙必然装不下，这时滑动留给屏内滚动，翻屏改用右侧圆点。

还有一个容易忽略的点：`--k` 只在面板里定义。
把它用在面板外（比如长页面）会让整条声明失效——

```css
/* 面板里：--k 有值，这条正常 */
.lede { margin-bottom: calc(28px * var(--k)); }
```

```css
/* 长页面上：--k 没定义 → 这条声明整条作废，垂直间距直接没了 */
html[data-layout="page"] { --k: 1; }   /* 显式补上 */
```

不是变成 0，是**整条被丢掉**。这个区别在调试时很关键。
