/* ==========================================================================
   个人门户 · 站点配置（首页唯一需要改的文件）
   --------------------------------------------------------------------------
   这里放「门户首页」要用的东西：主标语、开关、导航卡片。
   博客文章、项目、简历分别放在 content/posts、content/projects、content/resume.json，
   由 node scripts/build.mjs 生成 blog/ 、projects/ 、resume.html。

   加一张卡片 = 往 nav 里加一个对象，卡片自己长出来。
   href 留空 → 卡片显示「筹备中」，点一下从右侧滑进整屏详情页；
   href 填上 → 卡片自动变成可点的真链接（站内页写 'blog/index.html'，外链写完整 https://）。

   每张卡片还可以带两样东西，都会被界面用上：
     tags    —— 关键字，命令面板（Ctrl/⌘+K）搜索时会被匹配到
     details —— 详情列表，悬停预览里露前两条，详情页里完整显示

   三个占位符由构建脚本换成真实数量，手写时不用管：
     3 篇 → 「3 篇」   2 个 → 「2 个」   已上线 → 「已上线 / 筹备中」
   ========================================================================== */
window.SITE = {
  /* 站点身份：长页面的 <title>、OG、sitemap、RSS 都用它 */
  brand: '个人门户',
  author: 'Jerry',

  /* 部署后改成你的真实域名（末尾不要带斜杠）。
     sitemap.xml / rss.xml / canonical 里的绝对地址由它拼出来。
     忘了改也能构建，只是会打印一条提醒，SEO 产物里的地址不对。 */
  url: 'https://xixid.cloud',

  /* 首页描述：分享卡片和搜索引擎用 */
  description: '一个极简的个人门户：简历、博客、作品集、笔记库的入口。一屏一页，页面本身不滚动。',

  /* 博客列表每页几篇（超过就自动生成 blog/page2.html、page3.html…）
     想一页到底就填一个大数字，比如 999。 */
  postsPerPage: 10,

  /* 分享卡片用的默认图（可选）。填站内路径，如 'assets/images/og.png'。
     单篇文章可以在 front-matter 里用 cover: 覆盖它。 */
  ogImage: '',

  /* 主标语：首屏那一行大字，逐字浮现。点它 = 散成粒子（约两秒后重聚），按 R = 重播浮现 */
  tagline: '未来 由我们创造',

  /* 导航卡片区是否显示一张「＋ 添加新站点」的开发用卡片 */
  showAddCard: true,

  /* 逐屏转场：true = 每次翻屏随机换一套动效（淡入 / 推移 / 翻卡 / 缩放 / 虚化 / 擦除）
     false = 全部用最朴素的淡入 */
  randomTransition: true,

  /* 点击爆点：true = 每次点击随机挑一套（可能连着两次是同一套），
     false = 只用新的那套（核心闪光 + 冲击波 + 火星拖尾）。
     两套分别是什么，看 proto/burst-lab.html 的左右对照；网址也钉得死：
     ?fx=random（随机）/ ?fx=new（只新的）/ ?fx=classic（只旧的） */
  randomBurst: true,

  /* 主题：true = 你还没自己选过的时候，每次打开随机亮色或暗色；
     手动切过一次（按 T 或点右上角）就会记住，不再随机。
     false = 按系统偏好（system dark mode）。
     网址上写 ?theme=light / ?theme=dark 永远优先。 */
  randomTheme: true,

  /* 导航卡片（建议 4~8 个，太多就不「简约」了） */
  nav: [
    {
      title: '个人简历',
      desc: '教育经历 · 技能栈 · 项目经验',
      icon: 'resume',
      href: 'resume.html',
      badge: '已上线',
      tags: ['简历', 'resume', 'cv', '教育', '技能', '项目'],
      details: [
        '教育经历：学校 / 专业 / 时间线',
        '技能栈：按熟练度分层列出，不堆关键词',
        '项目经验：挑三个讲清楚「做了什么、结果如何」',
        '导出 PDF，一页装得下'
      ]
    },
    {
      title: '博客',
      desc: '随笔 · 技术笔记 · 学习记录',
      icon: 'pen',
      href: 'blog/index.html',
      badge: '3 篇',
      tags: ['博客', 'blog', '文章', '随笔', '笔记'],
      details: [
        '随笔：想到哪写到哪，先写起来',
        '技术笔记：踩过的坑 + 解决过程',
        '学习记录：四级 / 课程 / 读书',
        '按年份归档，支持全文搜索'
      ]
    },
    {
      title: '作品集',
      desc: '做过的东西，都放在这里',
      icon: 'grid',
      href: 'projects/index.html',
      badge: '2 个',
      tags: ['作品', '作品集', '项目', 'portfolio', 'demo'],
      details: [
        '每个作品配一张图 + 一段人话说明',
        '能跑的 demo 直接嵌进来，点开就能玩',
        'GitHub 链接与提交记录',
        '按「做完了 / 在做 / 想做」分栏，进度一眼可见'
      ]
    },
    {
      title: '笔记库',
      desc: '知识管理 · 长文归档',
      icon: 'book',
      href: '',
      badge: '筹备中',
      tags: ['笔记', '知识库', 'obsidian', '归档', '长文'],
      details: [
        'Obsidian 库整理后放这里',
        '标签 + 双向链接，知识之间连起来',
        '长文归档，适合慢慢读',
        '定期更新一张索引页，不至于迷路'
      ]
    },
    {
      title: '关于我',
      desc: '我是谁，正在做什么',
      icon: 'user',
      href: '',            // 想直接跳到第二屏就写 '#about'
      badge: '筹备中',
      tags: ['关于', 'about', '介绍', '我', '自我介绍'],
      details: [
        '我是谁：一段不超过十行的自我介绍',
        '正在做什么：当前最重要的三件事',
        '喜欢什么：书 / 音乐 / 运动，随便聊聊',
        '这一页会一直改，因为它一直在变'
      ]
    },
    {
      title: '联系',
      desc: '邮箱 · 社交 · 留言',
      icon: 'mail',
      href: '',            // 例如 'mailto:you@example.com'
      badge: '筹备中',
      tags: ['联系', 'contact', '邮箱', '邮件', '社交'],
      details: [
        '邮箱：点一下直接复制到剪贴板',
        '社交账号与主页链接',
        '留言板（以后再加）',
        '通常 24 小时内回信'
      ]
    }
  ]
};

/* ↓ 由构建脚本追加：资源版本 + 搜索索引地址（不要手改这一段） */
window.SITE.assetVersion = "89f631f8";
window.SITE.searchIndex = 'assets/site-index.js';
