# 部署到云服务器

站点是**纯静态**的：服务器上不需要 Node、不需要数据库、不需要常驻进程，
只要一个 nginx 把文件发出去。构建在你自己的电脑上做完，再把产物同步上去。

> 为什么不用"服务器上自动构建"：那样服务器要装 Node、要能拉代码，
> 出问题的地方就从一个变成三个。静态站最舒服的地方就是——**产物即网站**。

---

## 0. 你要准备什么

- 一台能 ssh 的 Linux 服务器（Ubuntu / Debian 都行，1 核 1G 足够）
- 本地装了 Node 18+（`node -v` 看一下；构建只需要 Node，不需要 npm install）
- 可选：一个域名，解析到服务器 IP

---

## 1. 本地：先把站点改成你自己的

### 1.1 改域名

打开 `content/site.js`，把 `url` 改成真实地址（**末尾不要带斜杠**）：

```js
url: 'https://your-domain.com',
```

`sitemap.xml`、`rss.xml`、每页的 `canonical` 都由它拼出来。忘了改也能构建，
只是自检会提醒你，SEO 产物里的地址会是 `example.com`。

### 1.2 改内容

| 想改什么 | 改哪里 |
|---|---|
| 首页标语、卡片、开关 | `content/site.js` |
| 博客文章 | `content/posts/*.md`（文件名就是网址，如 `my-post.md` → `/blog/my-post.html`） |
| 作品 | `content/projects/*.md` |
| 简历 | `content/resume.json` |

### 1.3 构建 + 自检

```bash
node scripts/build.mjs     # 生成 index.html / blog / projects / resume.html / RSS / sitemap
node scripts/check.mjs     # 检查死链、漏替换的占位符、必需产物
node scripts/serve.mjs     # 本地预览 http://127.0.0.1:8000（行为对齐 nginx）
```

**自检必须通过再上线**——它会把所有站内链接真的走一遍，死链会直接报出来。

---

## 2. 服务器：装 nginx

```bash
sudo apt update
sudo apt install -y nginx rsync
sudo systemctl enable --now nginx
```

建站点目录：

```bash
sudo mkdir -p /var/www/personal-site
sudo chown -R "$USER":"$USER" /var/www/personal-site
```

> 把目录所有权给你自己的账号，`rsync` 就不需要 sudo 了。

---

## 3. 上传

### 方式 A：rsync 一键部署（推荐）

本地先复制一份配置：

```bash
cp deploy/deploy.env.example deploy/deploy.env
```

编辑 `deploy/deploy.env`：

```bash
DEPLOY_TARGET=root@你的服务器IP
DEPLOY_PATH=/var/www/personal-site
```

然后每次发布就是一条命令：

```bash
bash scripts/deploy.sh            # 构建 → 自检 → 同步
bash scripts/deploy.sh --dry-run  # 只看会传哪些文件，不真传
```

脚本只同步运行时要用的文件（`index.html`、`assets/`、`blog/`、`projects/`、
`resume.html`、`404.html`、`sitemap.xml`、`rss.xml`、`robots.txt`、`proto/`），
源码、`content/` 和 `scripts/` 不会上服务器。

> `proto/` 是爆点与标题消散的开发对照页，默认会一起同步（占用很小，随时能自己点开看）。
> 不想公开就从 `scripts/deploy.sh` 的 `FILES` 数组里删掉 `proto` 那一行。

### 方式 B：手动 rsync

```bash
rsync -az --delete index.html assets blog projects resume.html 404.html \
      sitemap.xml rss.xml robots.txt proto/ root@服务器IP:/var/www/personal-site/
```

### 方式 C：在服务器上构建（用 git）

```bash
# 服务器上
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs git
sudo git clone <你的仓库> /srv/personal-site-src
cd /srv/personal-site-src && sudo node scripts/build.mjs
sudo rsync -az --delete index.html assets blog projects resume.html 404.html \
     sitemap.xml rss.xml robots.txt proto/ /var/www/personal-site/
```

---

## 4. 配 nginx

把仓库里的 `deploy/nginx.conf` 拷到服务器，改成你的域名和路径：

```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/personal-site
sudo nano /etc/nginx/sites-available/personal-site   # 改 server_name 和 root
sudo ln -s /etc/nginx/sites-available/personal-site /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default          # 关掉默认站点
sudo nginx -t                                        # 语法检查
sudo systemctl reload nginx
```

这份配置已经处理好了几件事：

- **HTML 不缓存、CSS/JS 长期缓存**：资源带 `?v=` 版本串，改了内容访客立刻拿到，没改的走缓存；
- **404 走 `404.html`**，状态码仍然是 404（不做软 404，搜索收录不会出问题）；
- gzip、安全响应头、隐藏文件拒绝访问；
- 访问日志在 `/var/log/nginx/personal-site.access.log`。

现在浏览器打开 `http://服务器IP` 应该就能看到了。

---

## 5. 配 HTTPS（有域名就做）

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

certbot 会自动改 nginx 配置、加 80→443 跳转，并装好续期定时器。
验证续期：

```bash
sudo certbot renew --dry-run
```

---

## 6. 日常发布流程

```bash
# 1. 写内容
$EDITOR content/posts/新文章.md

# 2. 本地看一眼
node scripts/build.mjs && node scripts/serve.mjs

# 3. 发布（构建 + 自检 + 同步）
bash scripts/deploy.sh
```

整个过程不到十秒。**改样式/脚本**时可以用更快的命令：

```bash
node scripts/build.mjs --assets   # 只重拼 CSS/JS，不重新生成页面
```

> 构建是增量的：内容没变的文件**不会重写**（mtime 不变），所以 rsync 只传真正改过的那几个文件，
> 几十篇的站点日常发布通常一秒内就传完了。
>
> 嫌来回上传麻烦的话，看下一节：在服务器上开一个写作后台，浏览器里写完点保存就发布。

---

## 7. 用写作后台写内容（可选）

不想每次都「本地写 → 构建 → 上传」的话，可以让服务器自己跑一个写作后台：
浏览器打开 `/admin`，登录、写 Markdown、实时预览，点保存后**服务器上自动重新构建**，站点立刻更新。

它跟站点是分开的：**后台是个独立进程，挂了也不影响站点访问**（站点始终是 nginx 发静态文件）。

### 7.1 准备

服务器上要有仓库副本（不是只有产物），因为后台要写 `content/` 并跑构建：

```bash
sudo mkdir -p /srv && cd /srv
sudo git clone <你的仓库> personal-site
cd personal-site
sudo chown -R www-data:www-data /srv/personal-site   # 让后台进程能写 content/ 和产物
```

> 站点根目录也建议直接指向这个目录（nginx 的 `root /srv/personal-site;`），
> 这样后台构建完，线上立刻就变了。如果之前用的是 `/var/www/personal-site`，改成这个路径即可。

### 7.2 配置密码并启动

```bash
sudo tee /etc/personal-site-admin.env >/dev/null <<'EOF'
ADMIN_PASSWORD=换成一个只有你知道的密码
ADMIN_HOST=127.0.0.1
ADMIN_PORT=8787
ADMIN_SECURE=1
EOF
sudo chmod 600 /etc/personal-site-admin.env

sudo cp deploy/personal-site-admin.service /etc/systemd/system/
sudo nano /etc/systemd/system/personal-site-admin.service    # 改 WorkingDirectory 和 User
sudo systemctl daemon-reload
sudo systemctl enable --now personal-site-admin
systemctl status personal-site-admin
```

### 7.3 让 nginx 把后台转发出去

`deploy/nginx.conf` 里已经带好了 `/admin/`、`/api/`、`/preview/` 三个反代段落，
拷过去就能用（不用写作后台就整段删掉）。改完：

```bash
sudo nginx -t && sudo systemctl reload nginx
```

然后浏览器打开 `https://你的域名/admin`，用刚设的密码登录。

### 7.4 它有哪些安全措施

| 措施 | 说明 |
|---|---|
| 密码登录 | `ADMIN_PASSWORD` 只放在服务器上的环境文件里（权限 600），不进仓库 |
| 会话 cookie | `HttpOnly` + `SameSite=Lax`（HTTPS 下再加 `Secure`），前端 JS 读不到 |
| 失败限流 | 同一 IP 连续 8 次密码错误，锁 10 分钟 |
| 同源校验 | 写操作要求 `Origin` 与 `Host` 一致，挡掉跨站表单/脚本 |
| 只监听本机 | 默认 `127.0.0.1:8787`；对外必须经过 nginx。**不要**设成 `0.0.0.0` 直接暴露 |
| 静态文件白名单 | 后台端口的静态服务只发站点公开文件；`content/`、`admin/`、`.git/`、`package.json` 一律 404 |
| 构建失败不毁站 | 保存时先写文件再构建，构建失败会在编辑器里把日志亮出来 |

想再加一层，就在 nginx 的 `location /admin/` 里按 IP 放行：

```nginx
allow 你的家宽IP; deny all;
```

### 7.5 每天怎么用

1. 打开 `https://你的域名/admin`；
2. 写新文章 → 右侧实时预览 → 「保存并重新构建」；
3. 想先看整页效果，点「整页预览」（`/preview/posts/<文件名>`），它渲染的是**服务器上已保存**的版本，带 `noindex`，不会被搜索引擎收录；
4. 标成草稿的文章不会出现在列表 / RSS / sitemap / 搜索里；`node scripts/build.mjs --drafts` 才连草稿一起生成。

---

## 8. 回滚 / 备份

站点是可重建的：产物全部由 `content/` + `src/` 生成。
所以**备份内容源就等于备份整个站点**。

- 用 git：`git add -A && git commit`，回滚 `git revert` / `git checkout`；
- 服务器上留一份上一版：rsync 前先 `ssh 服务器 'cp -r /var/www/personal-site /var/www/personal-site.bak'`；
- nginx 配置在 `/etc/nginx/sites-available/`，值得单独备份一份。

---

## 9. 常见问题

**改了内容，浏览器还是旧的**
HTML 是 `no-cache`，正常情况下刷新就有。如果还不对，先确认 `node scripts/build.mjs`
跑过、`deploy.sh` 也成功了（看 rsync 的 `>f` 行），再看 nginx 的 `access.log`。
`file://` 直开时浏览器缓存更顽固，用 `Ctrl+F5` 强刷。

**访问 `/blog/` 出现 403 / 404**
nginx 需要 `index index.html;` 和 `try_files $uri $uri/ =404;`——
`deploy/nginx.conf` 里已经有了，检查是不是用了别处的配置覆盖。

**中文文件名 / 中文标题**
文章网址用的是**文件名**（`content/posts/中文名.md` → `/blog/中文名.html`），
能跑但不建议：URL 会被百分号编码，看着乱。建议文件名用英文/拼音，标题写中文。

**想加评论 / 统计**
静态站没有后端。评论可以用 Giscus（基于 GitHub Discussions，需要一段外部脚本），
统计可以用 Umami / Plausible 这类自托管方案。
注意这两样都会引入**外部请求**，会破坏现在"零外部请求"的特性——
加之前想清楚值不值得。

**服务器上需要装 Node 吗？**
不需要。构建在本地做，服务器只发文件。只有选"方式 C"才需要装。
