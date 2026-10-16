import { readFileSync } from 'node:fs';
import { getDashboardData } from '../admin/lib/dashboard.mjs';
import { layout } from '../admin/lib/ui.mjs';

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

const html = layout({ title: '总览', active: 'dashboard', body: '<main>内容</main>' });
if (!html.includes('href="/admin"')) throw new Error('缺少总览导航');
if (!html.includes('class="on"')) throw new Error('缺少当前导航状态');
if (!html.includes('内容管理')) throw new Error('缺少内容管理导航');

const listHtml = (await import('../admin/lib/ui.mjs')).listPage({ kind: 'posts', label: '文章', items: [], stats: '0 篇已发布' });
if (!listHtml.includes('id="sort"')) throw new Error('缺少排序控件');
if (!listHtml.includes('id="page-size"')) throw new Error('缺少分页控件');

const editorHtml = (await import('../admin/lib/ui.mjs')).editorPage({ kind: 'posts', slug: 'demo', data: { title: '演示' }, body: '# 标题', exists: true, lastBuild: '' });
if (!editorHtml.includes('class="editor editor-compact"')) throw new Error('编辑器未启用紧凑布局');
if (!editorHtml.includes('data-preview-toggle')) throw new Error('缺少窄屏预览开关');
if (!editorHtml.includes('data-preview-panel')) throw new Error('缺少独立预览面板');

const cardsHtml = (await import('../admin/lib/ui.mjs')).cardsPage({ items: [{ title: '博客', desc: '文章', icon: 'pen', href: 'blog/index.html', badge: '', tags: [], details: [] }], saved: true, placeholders: {}, lastBuild: '' });
if (!cardsHtml.includes('data-card-index="0"')) throw new Error('缺少卡片排序标记');
if (!cardsHtml.includes('data-card-preview')) throw new Error('缺少卡片即时预览标记');
if (!cardsHtml.includes('id="save-cards"')) throw new Error('缺少卡片保存按钮');
if (!cardsHtml.includes('data-f="hidden"')) throw new Error('缺少卡片显隐开关');

const { cleanCard } = await import('../admin/lib/store.mjs');
const cleanedCard = cleanCard({ title: '隐藏测试', desc: '', icon: 'grid', href: '', badge: '', tags: [], details: [], hidden: true });
if (cleanedCard.hidden !== true) throw new Error('cleanCard 未保留 hidden 字段');
if (cleanCard({ title: '默认显示', tags: [], details: [] }).hidden !== false) throw new Error('cleanCard 默认 hidden 应为 false');

const { dashboardPage } = await import('../admin/lib/ui.mjs');
const dashHtml = dashboardPage({ data });
const pages = { 总览: dashHtml, 列表: listHtml, 编辑器: editorHtml, 卡片: cardsHtml };
for (const [name, pageHtml] of Object.entries(pages)) {
  if (!pageHtml.includes('写作后台')) throw new Error(name + ' 页面缺少统一后台骨架');
  if (!pageHtml.includes('/admin')) throw new Error(name + ' 页面缺少后台导航链接');
}

/* I6：导航恢复作品 / 简历 / 关于入口 */
for (const label of ['作品', '简历', '关于']) {
  if (!dashHtml.includes(label)) throw new Error('导航缺少「' + label + '」入口');
}

/* I5：列表页回收站死入口已移除 */
if (listHtml.includes('回收站')) throw new Error('列表页仍残留回收站死入口');
if (listHtml.includes('移入回收站')) throw new Error('删除文案仍误写「移入回收站」');

/* I2：列表行带真实 mtime 供排序 */
const listWithItem = (await import('../admin/lib/ui.mjs')).listPage({
  kind: 'posts', label: '文章',
  items: [{ slug: 'a', title: 'A', draft: false, mtime: '2026-10-14T10:00:00.000Z', tags: [] }],
  stats: '1 篇已发布',
});
if (!listWithItem.includes('data-mtime=')) throw new Error('列表行缺少 data-mtime');

/* I4：图片库保存按钮已绑定重新构建 */
const imagesHtml = (await import('../admin/lib/ui.mjs')).imagesPage({ items: [], lastBuild: '' });
if (!imagesHtml.includes("$('save').addEventListener")) throw new Error('图片库保存按钮未绑定');

/* C1：历史接口拒绝路径穿越 */
const { readHistory, restoreHistory } = await import('../admin/lib/store.mjs');
let c1ok = false;
try { readHistory('posts', '../../admin/plans', '2026-01-01T00-00-00-000'); } catch (e) { c1ok = true; }
if (!c1ok) throw new Error('readHistory 未拦截路径穿越');
try { restoreHistory('posts', 'a/b', '2026-01-01T00-00-00-000'); } catch (e) { c1ok = true; }
if (!c1ok) throw new Error('restoreHistory 未拦截非法 slug');

/* B1：hidden 浮层必须真的藏住 —— .pick{display:grid} 曾盖过 [hidden]{display:none}，
   * 弹窗一进后台就铺满全屏且关不掉（关闭按钮只改属性、画面没反应）。 */
if (!editorHtml.includes('[hidden]{display:none !important}')) throw new Error('后台 CSS 缺少 [hidden] 兜底规则');
if (!/<div class="pick" id="pick" hidden>/.test(editorHtml)) throw new Error('图库浮层必须默认带 hidden');
if (!editorHtml.includes('closePick()')) throw new Error('图库浮层缺少统一关闭函数');
const historyHtml = (await import('../admin/lib/ui.mjs')).historyPage({ kind: 'posts', slug: 'demo', items: [] });
if (!/<div class="pick" id="pick" hidden>/.test(historyHtml)) throw new Error('历史浮层必须默认带 hidden');
if (!historyHtml.includes('function closePick()')) throw new Error('历史浮层缺少统一关闭函数');

/* B2：JSON-LD 序列化必须转义 </script> —— JSON.stringify 不转义 `<`，
   标题里带个 </script> 就能逃出 ld+json 块执行任意脚本（存储型 XSS）。 */
const { jsonLdString } = await import('./lib/templates.mjs');
const injJson = jsonLdString({ headline: 'x</script><script>alert(1)</script>' });
if (injJson.includes('</script>')) throw new Error('jsonLdString 未转义 </script>');
if (!injJson.includes('\\u003c')) throw new Error('jsonLdString 未把 < 转义成 \\u003c');

/* B3：历史列表接口拒绝路径穿越 —— 曾直接拼路径，slug=../.. 会列出仓库根目录文件名 */
const { listHistory, serializeMarkdown } = await import('../admin/lib/store.mjs');
if (listHistory('posts', '../..').length !== 0) throw new Error('listHistory 未拦截路径穿越');
if (listHistory('posts', '..').length !== 0) throw new Error('listHistory 未拦截 ..');

/* B4：front-matter 里"长得像数字/布尔"的字符串必须加引号，
   否则 title: 2026 保存后读回来变成 number，title: 0 还会被 || 当空丢掉。 */
const { frontMatter } = await import('./lib/markdown.mjs');
for (const t of ['2026', 'true', 'false', '0']) {
  const parsed = frontMatter(serializeMarkdown({ title: t, date: '2026-01-01' }, '')).data.title;
  if (parsed !== t) throw new Error(`yamlValue 未给数字/布尔字符串加引号：${t} → ${JSON.stringify(parsed)}`);
}

/* B5：后台端口静态白名单必须包含 about.html（漏了会在后台端口打开关于页时 404） */
const serverSrc = readFileSync(new URL('../admin/server.mjs', import.meta.url), 'utf8');
if (!/"about\.html"/.test(serverSrc)) throw new Error('后台静态白名单缺少 about.html');

const { listContent, readNav } = await import('../admin/lib/store.mjs');
const realPosts = listContent('posts');
const realProjects = listContent('projects');
if (!Array.isArray(realPosts) || !Array.isArray(realProjects)) throw new Error('内容列表不是数组');
if (realPosts.some((item) => typeof item.slug !== 'string' || typeof item.draft !== 'boolean')) throw new Error('文章列表字段不完整');
const realNav = readNav();
if (!Array.isArray(realNav.items)) throw new Error('卡片列表不是数组');

console.log('后台自检通过');
