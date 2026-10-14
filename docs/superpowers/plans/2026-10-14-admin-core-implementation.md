# 后台核心内容优化实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**目标：** 在不改变零依赖文件型内容架构的前提下，完成总览仪表盘、统一工作台导航、内容管理增强、紧凑型编辑器和首页卡片管理优化。

**架构：** 继续使用 `admin/server.mjs` 的零依赖 Node HTTP 服务和 `admin/lib/ui.mjs` 的服务端字符串渲染。新增后台数据汇总函数负责把内容、草稿、卡片和构建状态转换为总览所需的数据；保存、预览、批量和卡片写入继续复用现有 API。界面层用现有 CSS 变量和原生浏览器脚本实现，不引入前端框架、数据库或第三方依赖。

**技术栈：** Node.js >=18、原生 `node:http`、ES Modules、服务端 HTML 字符串、原生 HTML/CSS/JavaScript、现有 `npm run check`、`npm run verify`。

## 全局约束

- 保持零外部请求、零运行时依赖和静态站点可双击打开。
- 继续使用 `content/posts/*.md`、`content/projects/*.md`、`content/settings.json`、`content/nav.json`。
- 不改变公开站点渲染进程和后台保存即生效机制。
- `draft: true` 内容不得出现在公开页面。
- 所有文件写入继续使用现有原子写入和安全阀。
- 实时预览固定在编辑器右侧，预览区域独立滚动，不在编辑区下方无限拉长。
- 桌面端和窄屏都要可用，窄屏默认收起实时预览。
- 不回退或覆盖仓库中已有的无关用户修改。

---

### 任务 1：建立后台数据汇总与总览页面接口

**文件：**
- 新建：`admin/lib/dashboard.mjs`
- 修改：`admin/server.mjs:38-41, 330-343`
- 修改：`admin/lib/ui.mjs:247-283`
- 修改：`package.json`（仅在需要新增自检命令时）
- 测试：`scripts/admin-check.mjs`

**接口：**
- `dashboard.mjs` 导出 `getDashboardData({ store, site, lastBuild })`。
- 返回 `{ counts, recent, health, cards, site }`，其中 `counts` 至少含 `published`、`drafts`、`cards`、`build`；`recent` 每项含 `kind`、`slug`、`title`、`mtime`、`draft`；`health` 每项含 `label`、`status`、`detail`。
- `ui.mjs` 新增 `dashboardPage({ data })`，输出总览页面。

- [ ] **步骤 1：写失败自检**

在 `scripts/admin-check.mjs` 中先导入 `getDashboardData`，用固定的假 store 和 site 调用，断言：

```js
const data = getDashboardData({
  store: {
    listContent: (kind) => kind === 'posts'
      ? [{ slug: 'new-post', title: '新文章', draft: false, mtime: '2026-10-14T10:00:00.000Z' }]
      : [{ slug: 'draft-project', title: '草稿作品', draft: true, mtime: '2026-10-13T10:00:00.000Z' }],
    readNav: () => ({ items: [{ title: '博客' }, { title: '作品集' }], saved: true }),
  },
  site: { brand: '个人门户' },
  lastBuild: { ok: true, ms: 24, at: '2026-10-14T10:00:00.000Z' },
});
if (data.counts.published !== 1) throw new Error('已发布数量错误');
if (data.counts.drafts !== 1) throw new Error('草稿数量错误');
if (data.counts.cards !== 2) throw new Error('卡片数量错误');
if (data.recent[0].title !== '新文章') throw new Error('最近内容排序错误');
```

运行：`node scripts/admin-check.mjs`。
预期：失败，直到 `admin/lib/dashboard.mjs` 存在并导出函数。

- [ ] **步骤 2：实现最小数据汇总**

在 `admin/lib/dashboard.mjs` 实现：

```js
export function getDashboardData({ store, site = {}, lastBuild = null }) {
  const posts = store.listContent('posts');
  const projects = store.listContent('projects');
  const all = [...posts.map((x) => ({ ...x, kind: 'posts' })), ...projects.map((x) => ({ ...x, kind: 'projects' }))];
  const recent = all.sort((a, b) => String(b.mtime).localeCompare(String(a.mtime))).slice(0, 6);
  const nav = store.readNav();
  return {
    site,
    counts: {
      published: all.filter((x) => !x.draft).length,
      drafts: all.filter((x) => x.draft).length,
      cards: nav.items.length,
      build: lastBuild ? `${lastBuild.ms || 0}ms` : '尚未构建',
    },
    recent,
    health: [
      { label: '内容列表', status: 'ok', detail: `${all.length} 条内容可读取` },
      { label: '首页卡片', status: nav.items.length ? 'ok' : 'warn', detail: `${nav.items.length} 个入口` },
      { label: '最近构建', status: lastBuild ? (lastBuild.ok ? 'ok' : 'error') : 'warn', detail: lastBuild ? (lastBuild.log || '') : '本次会话尚未构建' },
    ],
  };
}
```

- [ ] **步骤 3：增加 `/admin` 路由和页面骨架**

在 `server.mjs` 导入 `getDashboardData` 与 `dashboardPage`，把 `/admin` 从重定向 `/admin/posts` 改为读取数据并返回 `dashboardPage({ data })`。保留 `/admin/` 兼容入口。`layout()` 的品牌链接改为 `/admin`。

- [ ] **步骤 4：实现总览页面**

在 `ui.mjs` 新增 `dashboardPage({ data })`，使用现有 `.wrap`、`.card`、`.pill` 和 `.toolbar`，渲染四个统计块、最近内容列表、健康检查和两个快捷按钮。所有标题、状态和文件名都经过 `h()` 转义。导航 active 值使用 `dashboard`。

- [ ] **步骤 5：运行自检并提交**

运行：

```text
node scripts/admin-check.mjs
node --check admin/lib/dashboard.mjs
node --check admin/server.mjs
```

预期：全部退出码为 0。提交：

```text
git add admin/lib/dashboard.mjs admin/server.mjs admin/lib/ui.mjs scripts/admin-check.mjs
git commit -m "feat: 增加后台总览仪表盘"
```

---

### 任务 2：统一工作台导航和页面视觉结构

**文件：**
- 修改：`admin/lib/ui.mjs:11-245, 247-283`
- 修改：`admin/lib/ui.mjs` 中各页面的标题行和导航链接
- 测试：`scripts/admin-check.mjs`

**接口：**
- `layout({ title, body, active, user })` 保持现有调用签名。
- `active` 新增 `dashboard` 值，其余 `posts`、`projects`、`cards`、`images`、`settings` 继续兼容。

- [ ] **步骤 1：扩展失败断言**

在 `scripts/admin-check.mjs` 导入 `layout`，断言：

```js
const html = layout({ title: '总览', active: 'dashboard', body: '<main>内容</main>' });
if (!html.includes('href="/admin"')) throw new Error('缺少总览导航');
if (!html.includes('class="on"')) throw new Error('缺少当前导航状态');
if (!html.includes('内容管理')) throw new Error('缺少内容管理导航');
```

- [ ] **步骤 2：实现统一导航**

将 header 导航改成紧凑工作台结构：总览、内容管理、首页卡片、素材库、站点设置、发布中心。内容管理链接指向 `/admin/posts`，首页卡片指向 `/admin/cards`，素材库指向 `/admin/images`，其余保留现有页面。当前页面继续用 `active` 加 `.on`。

- [ ] **步骤 3：补齐统一样式**

在 CSS 中增加 `.workspace-grid`、`.stat-grid`、`.stat-card`、`.page-actions`、`.status-dot`、`.data-table` 和窄屏断点；复用现有色彩变量，不新增外部字体和资源。按钮继续使用现有 `.btn`，不把已有编辑器样式整体替换。

- [ ] **步骤 4：运行页面渲染自检并提交**

运行：

```text
node scripts/admin-check.mjs
node --check admin/lib/ui.mjs
```

预期：退出码均为 0。提交：

```text
git add admin/lib/ui.mjs scripts/admin-check.mjs
git commit -m "feat: 统一后台工作台导航"
```

---

### 任务 3：补齐内容管理列表的分页和排序体验

**文件：**
- 修改：`admin/lib/ui.mjs:302-430`
- 修改：`admin/server.mjs:333-343`（如需传递排序数据）
- 测试：`scripts/admin-check.mjs`

**接口：**
- `listPage({ kind, label, items, stats })` 继续保持参数兼容。
- 列表页面前端使用现有 `/api/batch`，不新增删除或发布接口。

- [ ] **步骤 1：写失败断言**

在自检中调用 `listPage()`，断言输出包含：

```js
const html = listPage({ kind: 'posts', label: '文章', items: [], stats: '0 篇已发布' });
if (!html.includes('id="sort"')) throw new Error('缺少排序控件');
if (!html.includes('id="page-size"')) throw new Error('缺少分页控件');
if (!html.includes('回收站')) throw new Error('缺少回收站入口');
```

- [ ] **步骤 2：实现前端排序和分页**

在列表工具栏加入排序选择（更新时间、日期、标题）和每页条数选择（10、20、50）。保留服务器返回的全量列表，在浏览器中根据当前搜索、状态、排序结果分页显示；分页状态放在表格下方，显示当前范围和上一页 / 下一页按钮。批量选择只作用于当前筛选页可见行，并在切页后重新同步全选状态。

- [ ] **步骤 3：补充明确操作状态**

每行保留预览、编辑、历史；在批量栏显示“已选 N 项”，删除确认文案改为“移入回收站”，避免与永久删除含义混淆。删除仍调用现有 `/api/batch` 的 `delete`，不改变文件快照逻辑。

- [ ] **步骤 4：运行自检并提交**

运行：

```text
node scripts/admin-check.mjs
node --check admin/lib/ui.mjs
```

预期：退出码均为 0。提交：

```text
git add admin/lib/ui.mjs scripts/admin-check.mjs
git commit -m "feat: 增强后台内容列表"
```

---

### 任务 4：将文章编辑器改成紧凑右侧预览布局

**文件：**
- 修改：`admin/lib/ui.mjs:75-89, 432-767`
- 修改：`admin/server.mjs:428-447`（仅在需要补充预览错误返回时）
- 测试：`scripts/admin-check.mjs`

**接口：**
- `/api/preview` 继续接收 `{ body, data }` 并返回 `{ ok, html, headings }`。
- `/api/save` 继续接收 `{ kind, slug, data, body, createOnly }` 并返回 `{ ok, slug, build, log }`。
- `editorPage({ kind, slug, data, body, exists, lastBuild })` 参数不变。

- [ ] **步骤 1：写失败断言**

在自检中调用 `editorPage()`，断言：

```js
const html = editorPage({ kind: 'posts', slug: 'demo', data: { title: '演示' }, body: '# 标题', exists: true, lastBuild: '' });
if (!html.includes('class="editor editor-compact"')) throw new Error('编辑器未启用紧凑布局');
if (!html.includes('data-preview-toggle')) throw new Error('缺少窄屏预览开关');
if (!html.includes('data-preview-panel')) throw new Error('缺少独立预览面板');
```

- [ ] **步骤 2：实现桌面紧凑布局**

把编辑器区域改为 `.editor.editor-compact`，编辑区使用 `minmax(0,1fr)`，预览面板固定 `minmax(260px,360px)`，容器高度使用 `min(680px, calc(100vh - 230px))`，预览面板设置 `overflow:auto`。禁止预览在编辑区下方自然堆叠。

- [ ] **步骤 3：实现窄屏按需预览**

增加“预览”按钮并用 `data-preview-toggle`、`data-preview-panel` 标记。宽度小于 900px 时预览面板默认隐藏，点击按钮切换 `is-open`；点击遮罩或关闭按钮收起。编辑区保持可滚动，页面不因预览内容增加高度。

- [ ] **步骤 4：保留并强化编辑状态**

保留现有 Markdown 工具栏、字数统计、本地 `sessionStorage` 草稿、自动预览、自动保存提示、整页预览和删除确认。保存失败时不清除 `dirty` 状态、不清除本地草稿，并在日志区显示服务端返回错误。

- [ ] **步骤 5：运行编辑器自检并提交**

运行：

```text
node scripts/admin-check.mjs
node --check admin/lib/ui.mjs
node --check admin/server.mjs
```

预期：退出码均为 0。提交：

```text
git add admin/lib/ui.mjs admin/server.mjs scripts/admin-check.mjs
git commit -m "feat: 优化紧凑型文章编辑器"
```

---

### 任务 5：首页卡片管理统一为排序 + 表单 + 即时预览

**文件：**
- 修改：`admin/lib/ui.mjs:1189-1377`
- 修改：`admin/server.mjs:398-403, 495-500`（只补充错误消息或保存状态时）
- 修改：`admin/lib/store.mjs:405-449`（仅在需要增加字段校验时）
- 测试：`scripts/admin-check.mjs`

**接口：**
- `/api/cards` 继续接收 `{ items }` 并返回 `{ ok, items, build }`。
- `store.cleanCard()` 和 `store.writeNav()` 继续作为唯一数据清洗与写入入口。

- [ ] **步骤 1：写失败断言**

在自检中调用 `cardsPage()`，断言：

```js
const html = cardsPage({ items: [{ title: '博客', desc: '文章', icon: 'pen', href: 'blog/index.html' }], saved: true, placeholders: {}, lastBuild: '' });
if (!html.includes('data-card-index="0"')) throw new Error('缺少卡片排序标记');
if (!html.includes('data-card-preview')) throw new Error('缺少卡片即时预览标记');
if (!html.includes('id="save-cards"')) throw new Error('缺少卡片保存按钮');
```

- [ ] **步骤 2：实现排序交互**

为每个卡片增加拖动句柄、稳定的 `data-card-index` 和键盘可用的上移 / 下移按钮。拖动或点击排序后只更新内存数组和序号，不立即写文件；页面顶部显示未保存状态。

- [ ] **步骤 3：实现卡片信息编辑和开关**

保留标题、描述、图标、链接、角标、标签和详情字段。增加显示开关，隐藏项保留在数组中但预览不展示；保存时仍交给 `cleanCard()` 清洗。所有输入使用事件委托，避免每次排序重建监听器。

- [ ] **步骤 4：实现首页即时预览**

右侧显示当前可见卡片的简化预览，使用 `cardPlaceholders()` 替换 `{{posts}}`、`{{projects}}`、`{{resume}}`。每次字段变化、显示开关变化或排序完成后刷新预览，不请求外部资源。

- [ ] **步骤 5：运行自检并提交**

运行：

```text
node scripts/admin-check.mjs
node --check admin/lib/ui.mjs
node --check admin/lib/store.mjs
```

预期：退出码均为 0。提交：

```text
git add admin/lib/ui.mjs admin/lib/store.mjs admin/server.mjs scripts/admin-check.mjs
git commit -m "feat: 优化首页卡片管理"
```

---

### 任务 6：端到端验证后台四条核心工作流

**文件：**
- 修改：`scripts/admin-check.mjs`
- 可能修改：`package.json`（新增 `admin:check` 脚本）
- 不新增业务文件

- [ ] **步骤 1：补充页面契约检查**

在 `scripts/admin-check.mjs` 检查四个页面渲染结果都包含统一导航、中文标题和关键操作：

```js
const pages = [dashboardPage({ data }), listPage({ kind: 'posts', label: '文章', items: [], stats: '' }), editorPage({ kind: 'posts', slug: '', data: {}, body: '', exists: false, lastBuild: '' }), cardsPage({ items: [], saved: false, placeholders: {}, lastBuild: '' })];
for (const html of pages) {
  if (!html.includes('写作后台')) throw new Error('页面缺少统一后台骨架');
  if (!html.includes('/admin')) throw new Error('页面缺少后台入口');
}
```

- [ ] **步骤 2：补充真实内容检查**

运行真实仓库数据检查：

```js
import * as store from '../admin/lib/store.mjs';
const posts = store.listContent('posts');
const projects = store.listContent('projects');
if (!Array.isArray(posts) || !Array.isArray(projects)) throw new Error('内容列表不是数组');
if (posts.some((item) => typeof item.slug !== 'string' || typeof item.draft !== 'boolean')) throw new Error('文章列表字段不完整');
const nav = store.readNav();
if (!Array.isArray(nav.items)) throw new Error('卡片列表不是数组');
```

- [ ] **步骤 3：运行项目验证命令**

按顺序运行：

```text
node scripts/admin-check.mjs
npm run check
npm run verify
```

预期：三条命令都退出码为 0；`npm run check` 不报告死链、占位符或产物缺失；`npm run verify` 报告服务器渲染与构建产物一致。

- [ ] **步骤 4：启动后台做手工验收**

使用临时密码启动：

```text
ADMIN_PASSWORD=test-admin-password node admin/server.mjs
```

访问 `http://127.0.0.1:8787/admin/login`，手工验证：

1. 登录后进入总览，四个统计块和最近内容可见。
2. 进入文章列表，搜索、状态筛选、分页和批量栏可用。
3. 打开一篇文章，确认预览在右侧、预览区域独立滚动；缩窄窗口后预览默认收起且可按按钮打开。
4. 编辑正文但不保存，刷新前触发离开提示；保存后状态变为已保存。
5. 进入卡片页，调整顺序和显示开关，确认未保存提示、右侧预览和保存后刷新都有效。
6. 打开公开站点确认草稿没有公开、已发布内容正常显示。

- [ ] **步骤 5：最终检查并提交实现**

运行：

```text
git status --short
git diff --check
npm run check
npm run verify
```

预期：无空白错误、无 whitespace 错误、项目检查全部通过。实现提交使用按任务拆分的提交记录，不提交用户未要求的无关文件。
