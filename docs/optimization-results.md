# 个人网站优化实施记录

> 后续体验调整：用户反馈“动效变弱，手机版文字变丑，原来的更好看”。已按反馈恢复原版标题绿光渐变、浅色辅助文字/按钮文字颜色、卡片标题与说明字号、卡片倾斜、辅助 halo/burst/magnetic 默认开启和随机转场；手机说明文字撤掉额外放大到 16px 的覆盖。转场恢复 600–720ms 并同步忙碌锁，保留手机自然滚动、历史/取消/焦点修复、无脚本入口和动画生命周期管理。构建、24 页自检、后台、配置隔离和 17 组交互回归再次通过，首页各视口复测无横向溢出。以下性能、60 组合对比度结论和五类页面截图是上一轮收敛版的历史记录，**不能视为恢复原版观感后的当前性能/色彩验收**；首页 home-* 截图、smoke 和 regression 结果已更新。

日期：2026-10-15。对应[优化方案](<optimization-plan.md>)。A–F 的代码实施已完成，本地自动化验收通过；真机、跨浏览器及人工截图观感审阅仍未完成。未发布网站，未创建提交；任务开始时已有未提交内容，均保留。运行依赖仍为零。

## 已实施

| 工作包 | 结果与主要实现 |
|---|---|
| A 导航输入 | [舞台控制器](<../src/js/09-stage.js>)分离地址写入和布局更新；push/replace/none 三策略；popstate/hashchange 不写历史；pointercancel、lostpointercapture、blur 清理捕获、位移和排队；转场仅保留最后请求；滚轮按 220ms 间隔划分手势，子容器滚动过的同次手势不翻屏；水平手势、缩放和表单控件让浏览器处理。[快捷键](<../src/js/13-boot.js>)优先滚长内容，避开输入、控件和模态。 |
| B 默认动效 | [设置注册表](<../scripts/lib/features.mjs>)默认 system 主题、320ms fade，辅助 halo/burst/magnetic 默认关闭；[仓库功能配置](<../content/features.json>)同步这些新默认。已有后台 settings 的显式 true/主题/随机转场继续优先。手动主题跨页保存，系统变化仅在无手动覆盖时生效。 |
| C 布局 | [基础样式](<../src/styles/02-base.css>)和[舞台样式](<../src/styles/07-stage.css>)默认文档流；宽 >768 且高 >600 并初始化成功后加 stage-ready。手机/矮窗自然滚动、所有面板可见；跨断点清除动画和 inert，返回桌面选最近小节。保留可见小节锚点，移动触屏主要按钮 44px；紧凑度底线由 .64 提到 .82，长内容允许局部滚动。 |
| D 渐进增强/焦点 | [共享纯渲染器](<../src/js/00-card-render.js>)同时供[构建/服务器](<../scripts/build.mjs>)和浏览器使用；首页预先输出真实链接，浏览器绑定现有节点。无链接条目用原生 details/summary 提供无脚本回退；增强后可进入详情。板块关闭时静态与浏览器入口同步过滤。[模态焦点管理](<../src/js/12-focus.js>)提供背景 inert、Tab/Shift+Tab 循环和触发点恢复。稳定 h1 内使用原生标题按钮，装饰字符 aria-hidden。初始化异常时移除舞台锁屏并恢复所有面板。 |
| E 生命周期/性能 | [粒子](<../src/js/04-fx.js>)和[指针](<../src/js/05-pointer.js>)响应 hidden/reduced-motion；指针光晕插值收敛后停 RAF，背景指针样式仅在输入时唤醒。新增标准/轻量设置，触屏轻量预设降低粒子数和 DPR。卡片指针更新按帧合并，缓存尺寸并在 resize/scroll/ResizeObserver 后失效。调试面板也响应生命周期。 |
| F 视觉/维护 | [设计变量](<../src/styles/01-design-tokens.css>)统一 160ms 按钮、200ms 卡片、320ms fade；卡片保留一种抬升反馈。标题绿字与代码字符串使用有足够对比度的语义颜色；必要按钮边界和焦点环提高对比度。[长页样式](<../src/styles/21-pages.css>)允许行内长标识符换行，代码块保留局部滚动。绿色体系、标题粒子、后台与原生拼接架构保留。 |

## 工程和行为验收

- 完整 build 通过；最终增量重建 0 文件变化，33 文件跳过。
- check 通过：24 页面，另有 3 个 proto 页面；7 个后台页内联脚本可编译。
- admin-check 通过。
- [隔离配置回归](<../scripts/optimization-check.mjs>)通过：关闭 blog/resume/about 面板/cards 无残留入口，静态与运行配置过滤一致，已保存设置可重新开启实验效果，轻量质量档、转义、原生 details 回退。夹具写在构建缓存内并自行删除，不改真实内容。
- [浏览器行为回归](<../scripts/browser-regression.mjs>)17 组通过，详见[原始结果](<optimization-evidence/regression.json>)：历史回放/resize 不新增历史；取消/丢失捕获/失焦不翻屏；键盘先滚长内容；滚轮手势边界；跨断点 inert/定位；快速请求合并；三个模态焦点循环与恢复；主题跨页和系统变化；减少动效无持续应用 RAF；hidden 生命周期（脚本模拟）停止/恢复；实验效果启用后仍尊重减少动效；主脚本阻断后的导航；无脚本 file 链接。
- 上述回归启动 127.0.0.1:18765 的短生命周期站点服务器，在 finally 中关闭；内部执行 verify-server --port 18765，对服务器内存渲染与磁盘产物逐字节验证。未替换 DSH GUI 服务。
- [五类页面审计](<../scripts/browser-pages.mjs>)60 组合通过：index、文章、项目、简历、关于 × 深浅主题 × 320×640、390×844、768×1024、844×390、1366×768、683×384。未检出页面级横向溢出、所审计文本对比度失败或必要按钮边界低于 3:1，见[原始结果](<optimization-evidence/pages.json>)。
- [首页烟雾检查](<../scripts/browser-smoke.mjs>)另外覆盖 360×640 与无脚本，见[原始结果](<optimization-evidence/smoke.json>)。最终浏览器检查无 pageerror。

布局审计中实际修复了文章 320px 下 4px 横向溢出，以及浅色代码字符串 2.91:1 的对比度失败。对比度工具通过浏览器 computed style 合成透明背景计算，标题渐变按颜色端点检查；没有对移动 Canvas、背景渐变作逐像素采样，不能据此宣称全站 WCAG 合规。

## 同环境性能结果

环境：Windows 10.0.26200，Intel Core Ultra 5 125H，18 逻辑 CPU、32GB RAM；Edge 155.0.4283.45 headless；1366×768、浅色、未限速、本地 HTTP。每场景 3 次，表中 LCP/CLS/帧 P95/应用 RAF 为三次中位数；事件耗时为三次采样中的最大值。未打开调试面板的五项与单独 debug-idle 分开记录。

对照基线为 Git HEAD 11969eb4aa24f481393a7c4ecf142f9e134662d6 在临时缓存目录完整重建；**不包含任务开始时已有的未提交改动**，因此不是工作区的精确前后快照。临时基线目录现已清理。数据见[优化前原始数据](<optimization-evidence/performance-before.json>)、[最终原始数据](<optimization-evidence/performance-after.json>)。

| 场景 | LCP 前→后 ms | CLS 前→后 | 帧 P95 前→后 ms | 应用 RAF 前→后 | 最长事件前→后 ms |
|---|---:|---:|---:|---:|---:|
| 静置，约1.7s | 92→112 | .13015→.00016 | 16.8→16.8 | 306→102 | 无记录 |
| 指针移动，约1.7s | 96→116 | .13015→0 | 16.8→16.8 | 337→162 | 无记录 |
| 标题消散，约2.6s | 92→116 | .13019→.00016 | 16.8→16.8 | 471→156 | 56→72 |
| 搜索，约1.7s | 88→136 | .13015→.00016 | 16.8→16.8 | 297→103 | 160→160 |
| 连续切屏，约3.1s | 88→124 | .13019→.00016 | 16.8→16.8 | 612→208 | 72→72 |
| 调试面板静置，约1.7s | 92→128 | .13015→.00016 | 16.8→16.8 | 412→204 | 无记录 |

最终各场景三次运行均未记录 >50ms longtask。完整帧异常与事件轨迹保存在原始数据；最终各场景“最长帧”的中位数约 16.8–25.1ms。LCP 没有改善，当前本地样本约 112–136ms；同机极短加载时间受调度噪声影响，不能推广到生产网络。实验室事件样本最大 160ms，**不是现场 INP**。静置 RAF 减少约 67%，仍有背景粒子持续动画，不能宣称整页零开销。debug-idle RAF 约为普通静置的两倍，确认统计面板本身有成本。

## 复现

工程检查无需新增依赖：

	npm run build
	npm run check
	npm run admin-check
	npm run optimization-check

浏览器验证使用开发侧 Playwright，不加入站点运行依赖。本机工具缓存已可用；可将其 index.mjs 绝对路径传入：

	node scripts/browser-regression.mjs <playwright/index.mjs>
	node scripts/browser-pages.mjs <playwright/index.mjs>
	node scripts/browser-smoke.mjs <playwright/index.mjs>
	node scripts/browser-performance.mjs <playwright/index.mjs> after

性能 before 模式需要先把指定 Git 基线解出到 .build-cache/optimization-baseline 并构建，避免误测当前版本。浏览器回归会占用本机 18765/18766，脚本结束清理自己的服务器；已有服务占用时请先更换脚本端口。

## 证据与未测项

[浅色桌面首页截图](<optimization-evidence/index-light-1366.png>)、[深色桌面首页截图](<optimization-evidence/index-dark-1366.png>)、[手机首页截图](<optimization-evidence/index-light-390.png>)、[手机文章截图](<optimization-evidence/blog-canvas-particle-grid-light-390.png>)、[无脚本首页截图](<optimization-evidence/home-noscript.png>)。其他主题/页面截图保存在同一证据目录。

- 截图已生成，但本次模型图片读取返回“model does not declare image input”，未完成实际图像视觉审阅，故未按观感重设阴影与装饰。悬停预览保留桌面可选默认，遮挡观感仍需人工检查。
- 未测试真实手机触摸、真实触控板惯性、Safari/Firefox、软键盘弹出、安全区硬件与屏幕阅读器。220ms 手势间隔仍需真实触控板复核。
- 683×384 是 1366×768 在 200% 缩放下的等效 CSS 视口重排检查，未执行浏览器 UI 的真实缩放操作。
- hidden 测试验证脚本生命周期事件响应，未把真实后台标签页的系统调度等同于模拟结果。实验室性能无网络/CPU 限速，未覆盖低端真机、移动性能与生产 LCP/CLS/INP。
- 未替换个人内容，也未发布/部署。没有自动拆分提交，以免将任务开始时的未提交内容混入优化批次。

## 回退

辅助效果可以通过现有设置重新开启；随机转场仍可选；轻量质量可切回 standard。手机布局的样式集中于舞台与响应式规则，布局判断集中于舞台控制器，与质量档独立。源码回退后必须完整构建并重新执行工程和服务器一致性检查。请按上表按工作包审阅差异后再选择性提交，不要对整个工作区 reset。
