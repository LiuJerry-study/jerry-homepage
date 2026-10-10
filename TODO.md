# 没做的事 · 以后想加的时候从这里挑

这份文件记录**刻意没做**和**暂时没做**的东西，每条都写清楚：是什么、为什么没做、要加的话动哪里。

> 想加之前先看一眼「[怎么改这个项目](README.md#目录结构)」——
> 大部分东西都落在 `content/`、`src/js/`、`src/styles/`、`scripts/` 这四个地方。

---

## A. 明确没加：视觉与交互

这些是 `portal-next` / `Jerry个人网站（try）` 里有的东西，**你说过"personal-site 的视觉交互已经够了"，所以一个都没搬**。
它们都是纯增量，不会破坏现有版式，想加随时可以。

| 没加的东西 | 是什么 | 要加的话动哪里 |
|---|---|---|
| **Bento 关于屏** | 简介跨两列 + 数字卡 + 技能 chips + 经历时间线拼成的不规则网格 | 改 `src/pages/index.html` 里 `#about` 那个 `<section>`；样式加到 `src/styles/09-hero.css` 或新开一个 `src/styles/22-about.css`（记得加进 `scripts/build.mjs` 的 `STYLE_MANIFEST`）。⚠️ 它是长滚动版式，塞进一屏要走 `--k` 收紧或屏内滚 |
| **技能 chips / 技术栈标签** | 一排小胶囊 | 现在简历页已经有了（`content/resume.json` 的 `type: "skill"`），样式是 `.chip-list`。想搬到首页就复用这个类 |
| **经历时间线** | 年份 mono 左栏 + 角色/公司 | 同上，简历页的 `.resume-line` 就是；`content/resume.json` 里 `type: "timeline"` |
| **CountUp 数字滚动** | 数字从 0 滚到目标值 | 新建 `src/js/xx-countup.js`（`IntersectionObserver` + `requestAnimationFrame`，约 60 行），在 `src/js/13-boot.js` 的 `boot()` 里调一次。⚠️ 要有真实数字才有意义 |
| **社交链接行** | GitHub / 邮箱 / X 图标一排 | 加到 `#about` 面板；图标直接内联 SVG（现有代码里 `ICONS` 是全站图标表，见 `src/js/08-cards.js` 顶部） |
| **featured 项目卡跨列** | 项目列表里第一张卡占两列 | 改 `scripts/build.mjs` 的 `projectCard()`，再在 `21-pages.css` 的 `.project-grid` 上加一句 `.project-card.is-featured { grid-column: 1 / -1 }` |
| **sticky 顶栏 + 滚动锚点导航** | 长页面顶部吸一条导航，点了滚到对应段落 | `21-pages.css` 的 `.page .topbar` 已经是 `position: fixed`，加滚动高亮即可。⚠️ 只对长页面成立，首页是"锁死不滚"，锚点导航没意义 |
| **Jerry 的 `class="dark"` 主题机制** | 另一套主题实现（切 class 而不是 `data-theme`） | **不要加**。现在的 `data-theme` + 圆形揭示 + 三处一致的 key 已经工作正常，混用两套只会互相打架（详见 README「两套布局」） |
| **外部字体（Geist 等）** | 好看的西文字体 | **加之前想清楚**：会破坏"零外部请求、离线可用、双击能开"。非要加就自托管 subset woff2 放 `assets/fonts/`，并在 `01-design-tokens.css` 的 `--font-sans` 里排在最前 |
| **Tailwind / Next.js / React** | 组件化 + 原子 CSS | **不要加**。这个站点的身份就是零依赖、双击可开。真要框架，那是另一个项目（`portal-next` 就是，你已经不要了） |
| **评论 / 统计 / 访问计数** | Giscus、Umami、Plausible…… | 都要引入外部请求或第三方脚本，会破坏离线可用。真要加：Giscus 是一段 `<script>` 塞进 `scripts/lib/templates.mjs` 的 `pageShell()`；自托管 Umami 需要另起一个服务 |

---

## B. B 档做了一部分，剩下这些

这一批是"想要就能做，只是这次没做"的。已经做完的（全文搜索、标签页、分页、草稿预览、TOC、图片尺寸、封面/og:image、CI、脚注、HTML 直出）见 README。

| 没做的 | 现状 | 要加的话动哪里 |
|---|---|---|
| **标签页分页** | 标签页把该标签下所有文章一次性列出来 | `scripts/build.mjs` 的标签页那段，复用同文件里的 `pagination()` |
| **图片压缩 / 缩略图 / 多尺寸** | 只做拷贝和读尺寸，**不压缩**（压缩要图片编解码库，跟零依赖冲突） | 保持零依赖的话：自己在放进来之前压好（Squoosh / `cwebp`），构建这边不管。想要自动压缩只能引入 `sharp`，那就破坏零依赖了 |
| **自动生成 OG 分享图** | 支持每篇 `cover:` + 站点级 `ogImage`（`content/site.js`），图要你自己放 | 自动生成需要把文字栅格化，没有字体光栅器做不到。折中方案：做一个 HTML 模板页，用浏览器截图生成（人工一次性），或接一个外部服务 |
| **数学公式** | `$...$` 会被当普通文本 | 需要 KaTeX（约 250KB CSS+JS+字体）。零依赖做不到；要么在正文里用图片，要么放弃 |
| **Mermaid 图表** | 同上 | Mermaid 约 1MB，且要运行时渲染。同上 |
| **MDX / 在正文里嵌组件** | 不支持 | 需要构建期编译 + 一个组件运行时。这是"换架构"级别的事 |
| **定义列表**（`术语` 换行缩进释义） | 不支持 | `scripts/lib/markdown.mjs` 的 `renderBlocks()` 里加一个 `isDefList` 分支，约 30 行 |
| **搜索进阶**：中文分词 / 结果高亮 / 搜索历史 | 现在是模糊子序列匹配（`fuzzy()`，见 `src/js/10-palette.js`），不做分词，也不高亮正文命中 | 分词要词表（约 1 万词，~100KB）；高亮可在 `render()` 里给命中片段加 `<b>`；历史用 `sessionStorage` |
| **草稿的另一种形态** | `--drafts` 是"整站带上草稿" | 想只预览某一篇：加 `?preview=<slug>`，构建时把 `.draft` 标记的页面单独放到 `_preview/` 目录并加 `noindex` |
| **相关文章** | 没有 | `scripts/build.mjs` 里按 tags 交集算相似度，取前 3 条渲染在文末。约 20 行 |
| **阅读时长 / 字数** | 没有 | 构建时数一下 `content` 的字数除以 400，塞进 `pageHead` 的 meta 那一行 |
| **JSON Feed** | 只有 RSS 2.0 | 照抄 `buildSeo()` 里的 `rss` 那段，换一个 JSON 结构，约 15 行 |

---

## C. 按设计不做（不是遗漏，是取舍）

> 这一档原来有 7 条，**其中 4 条后来做了**：
> 在线写作后台 · 密码登录 / 权限 · SSR / 实时草稿预览 · 增量构建。
> 做法是**另开一个后台进程**，而不是把站点改成服务端应用 ——
> 站点仍然纯静态、双击能开、`file://` 下能用。见 README 的「写作后台」和 DEPLOY.md 第 7 节。
>
> 下面 3 条仍然是取舍，不打算做。

| 不做的 | 为什么 |
|---|---|
| **在服务器上自动构建**（push 即上线） | 技术上可行（服务器上装 git hook 或 CI 拉代码再构建），但那等于在服务器上多养一套东西。现在的方式是"后台里点保存就构建"，或者本地构建完 rsync 上去 —— 站点只有一个进程（nginx），出问题的面最小 |
| **第三方评论 / 统计 / CDN 字体** | 都会引入外部请求，破坏「零外部请求 + 离线可用 + 双击能开」这条底线。真要加：Giscus（评论）最小代价是一段 `<script>` 塞进 `scripts/lib/templates.mjs` 的 `pageShell()`；统计建议自托管 Umami（另起一个服务） |
| **sitemap 分片 / sitemap index** | URL 超过 5 万条才需要。个人站点到不了 |

## D. 已知的小边界

不是"没做"，是"这么设计有代价"，用的时候心里有数。

- **中文文件名**：文章网址取文件名（`content/posts/中文名.md` → `/blog/中文名.html`），能跑，但 URL 会被百分号编码。建议文件名用英文/拼音，标题写中文。标签页同理（`tags/前端.html`）。
- **正文 HTML 默认转义**：安全考虑。整篇要直出就在 front-matter 写 `html: true`（`scripts/lib/markdown.mjs` 里 `opts.html === true` 的分支），风险自负。
- **版本串只在完整构建时更新**：`node scripts/build.mjs --assets` 只重拼样式和脚本，页面里的 `?v=` 会过期——那是给改样式时快速迭代用的，**发布前一定要跑完整构建**（`scripts/check.mjs` 会检查出来）。
- **构建会清理旧产物**：`blog/` `projects/` `tags/` `assets/images/` 这四个目录由构建全权管理 ——
  删掉一篇文章，它的页面和标签页会被自动清掉；所以别把手工文件放进这四个目录（会被当成旧产物删掉）。
  实现见 `scripts/build.mjs` 的 `PRODUCED` / `pruneGenerated()`。
- **构建产物必须可复现**：构建路径里**不要**出现这两类东西 ——
  `new Date()`（同一份源在不同日期构建出的产物不一样）和 `localeCompare()`
  （结果取决于运行环境的 locale / ICU：中文标签在 zh-CN 和 en-US 下排出完全不同的顺序）。
  两者的后果都是 CI 里"产物与提交一致"那条检查莫名其妙变红。
  现在 sitemap 的 lastmod / 页脚年份都从内容推导，排序统一走 `scripts/build.mjs` 的 `byCode()`。
  验证方法：`scripts/build.mjs` 跑完后，在 Linux（或 WSL）里再跑一次，产物应当逐字节一致。
- **增量构建**：内容没变的文件不会被重写（mtime 不变，rsync 只传改过的）。
  想让构建"全部重来"就加 `--force`。缓存放在 `.build-cache/`（已 gitignore）。
- **`file://` 下没有服务器**：目录链接要写 `blog/index.html` 而不是 `blog/`（后者会打开目录列表）。构建出来的链接已经这么写了。
