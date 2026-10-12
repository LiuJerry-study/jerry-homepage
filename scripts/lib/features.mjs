/* ==========================================================================
   开关：站点有哪些板块、哪些功能
   --------------------------------------------------------------------------
   状态存在 content/features.json，后台的「开关」页写它。
   没写到的项一律按默认值（全开）—— 所以删掉整个文件 = 全部打开，
   不会因为少一个字段就把站点关出毛病来。

   两个层次（重要）：
     site    —— 板块级的。关掉之后**根本不生成**那些页面，
                sitemap / RSS / 搜索索引 / 导航卡片一起跟着消失。
                这是"渲染期"的事：动态站下保存即生效，静态快照要重跑构建。
     runtime —— 首页的装饰与交互。写进 assets/site-data.js，
                main.js 读它决定初始化哪些模块。首页专用（长页面不加载 main.js）。

   为什么不做成"实时读文件"：页面是服务器渲染的，导航、sitemap 这些
   本来就是渲染时才知道的结果；把它做成运行时开关，等于让每张页面
   自己去藏东西 —— 藏不干净就会留下点了 404 的链接。
   ========================================================================== */

/** 每一项：key 要稳定（会被写进 features.json），group 决定它出现在后台哪一组 */
export const FEATURE_ITEMS = [
  /* ---------------- 板块 ---------------- */
  { key: 'pages.blog',     group: 'pages', level: 'site', href: 'blog/',          label: '博客',   note: '文章列表 + 详情 + 分页。关掉后文章不再出现在任何地方' },
  { key: 'pages.projects', group: 'pages', level: 'site', href: 'projects/',      label: '作品集', note: '项目列表 + 详情' },
  { key: 'pages.resume',   group: 'pages', level: 'site', href: 'resume.html',    label: '简历',   note: '读 content/resume.json' },
  { key: 'pages.tags',     group: 'pages', level: 'site', href: 'tags/',          label: '标签页', note: '按标签翻文章与作品；标签是从文章和项目里长出来的' },

  /* ---------------- 首页 ---------------- */
  { key: 'home.aboutPanel', group: 'home', level: 'runtime', label: '「关于」屏', note: '首页第二屏。关掉后只剩一屏，右侧圆点也跟着少一个' },
  { key: 'home.cards',      group: 'home', level: 'runtime', label: '卡片墙',     note: '首屏那几张入口卡片' },
  { key: 'home.dots',       group: 'home', level: 'runtime', label: '右侧圆点',   note: '一屏一个的小圆点导航' },
  { key: 'home.clock',      group: 'home', level: 'runtime', label: '页脚时钟',   note: '「关于」屏页脚那个跳秒的钟' },

  /* ---------------- 装饰效果 ---------------- */
  { key: 'effects.particles',     group: 'effects', level: 'runtime', label: '背景粒子', note: '连线的粒子场，指针会搅动它们。关掉最省电' },
  { key: 'effects.blobs',         group: 'effects', level: 'runtime', label: '光斑色场', note: '背景里缓慢漂移的色块与颗粒' },
  { key: 'effects.halo',          group: 'effects', level: 'runtime', label: '光标光晕', note: '跟着指针走的那团柔光' },
  { key: 'effects.burst',         group: 'effects', level: 'runtime', label: '点击爆点', note: '点一下炸开的那一圈' },
  { key: 'effects.titleDissolve', group: 'effects', level: 'runtime', label: '标题消散', note: '点主标语散成粒子（两秒后自己聚回来）' },
  { key: 'effects.transition',    group: 'effects', level: 'runtime', label: '逐屏转场', note: '翻屏时的动效。关掉 = 全部用最朴素的淡入' },
  { key: 'effects.magnetic',      group: 'effects', level: 'runtime', label: '按钮磁吸', note: '指针靠近时按钮轻轻让开一点' },

  /* ---------------- 工具 ---------------- */
  { key: 'tools.cmdk',        group: 'tools', level: 'runtime', label: '命令面板', note: 'Ctrl / ⌘ + K 搜索与跳转' },
  { key: 'tools.themeToggle', group: 'tools', level: 'runtime', label: '主题切换', note: '右上角的明暗按钮，以及 T 键' },
  { key: 'tools.keys',        group: 'tools', level: 'runtime', label: '快捷键一览', note: '按 ? 弹出的那张表' },
  { key: 'tools.hoverPeek',   group: 'tools', level: 'runtime', label: '卡片悬停预览', note: '鼠标停在卡片上时浮出来的小面板' },
];

export const FEATURE_GROUPS = [
  { key: 'pages',   label: '板块',     note: '关掉之后整块页面不再生成，导航里那张卡、sitemap、RSS、搜索索引也一起消失。' },
  { key: 'home',    label: '首页',     note: '只影响首页那两屏。' },
  { key: 'effects', label: '装饰效果', note: '纯好看的东西，关掉不影响任何功能。' },
  { key: 'tools',   label: '工具',     note: '锦上添花的小工具。' },
];

/** 路径 → 默认值。默认**全开**，所以 items 里没列的一律 undefined（= 开）。 */
export function defaultFeatures() {
  const o = {};
  for (const it of FEATURE_ITEMS) o[it.key] = true;
  return o;
}

/**
 * 读 content/features.json，和默认值合并。
 * 文件不存在、读坏了、某个键写的是奇怪的值 —— 都退回默认（开），
 * 绝不让一个配置文件把站点关黑。问题会作为 notes 返回，由调用方决定怎么喊。
 */
export function loadFeatures(root, readFileSync, existsSync) {
  const notes = [];
  const out = defaultFeatures();
  const file = root ? root + '/content/features.json' : 'content/features.json';
  if (!existsSync(file)) return { features: out, notes };

  let raw;
  try { raw = JSON.parse(readFileSync(file, 'utf8')); }
  catch (e) { notes.push('content/features.json 解析失败（已按全开处理）：' + e.message); return { features: out, notes }; }

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    notes.push('content/features.json 应该是一个对象（已按全开处理）');
    return { features: out, notes };
  }

  const known = new Set(FEATURE_ITEMS.map((i) => i.key));
  for (const [k, v] of Object.entries(raw)) {
    if (k.startsWith('_')) continue;                       // 下划线开头的是注释，随便写
    if (!known.has(k)) { notes.push(`features.json 里有不认识的开关「${k}」，忽略`); continue; }
    if (typeof v !== 'boolean') { notes.push(`开关「${k}」不是 true/false，按开处理`); continue; }
    out[k] = v;
  }
  return { features: out, notes };
}

/** 板块是否打开（渲染期用）。key 不带 pages. 前缀，例如 sectionOn(f, 'blog') */
export const sectionOn = (f, name) => f['pages.' + name] !== false;

/** 关掉的板块对应的路径前缀，用来过滤导航卡片 */
export function offHrefs(f) {
  return FEATURE_ITEMS.filter((i) => i.level === 'site' && f[i.key] === false).map((i) => i.href);
}
