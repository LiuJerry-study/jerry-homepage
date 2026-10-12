#!/usr/bin/env bash
# ==========================================================================
# 部署：拼资源 → 自检 → rsync 到云服务器
# --------------------------------------------------------------------------
# 用法：
#   1) 复制配置文件（只需一次）：
#        cp deploy/deploy.env.example deploy/deploy.env
#   2) 部署：
#        bash scripts/deploy.sh                 只推代码和静态资源
#        bash scripts/deploy.sh --with-content  连 content/ 一起推（首次部署用）
#        bash scripts/deploy.sh --dry-run       只看会传什么、不真传
#
# 也可以临时指定目标，不动配置文件：
#        bash scripts/deploy.sh root@1.2.3.4 /srv/personal-site
#
# ⚠ content/ 默认**不推**。
#   动态化之后，服务器上的 content/ 就是唯一副本（后台直接往那儿写），
#   无脑 rsync --delete 会把你在后台写的东西抹掉。要推得明说 --with-content，
#   而且推之前先想清楚是不是真的要以本地为准。
#
# 服务器上跑两个进程（见 DEPLOY.md）：
#   personal-site-site   ← 公开站渲染，只读，nginx 反代到它
#   personal-site-admin  ← 写作后台，可选
# 这个脚本只负责同步文件；改完**代码**记得重启渲染进程，
# 只改**内容**不用重启（渲染进程盯着 content/，自己会重渲染）。
# ==========================================================================
set -euo pipefail

cd "$(dirname "$0")/.."

DRY_RUN=""
WITH_CONTENT=""
TARGET=""
DEST_DIR=""

for arg in "$@"; do
  case "$arg" in
    --dry-run)       DRY_RUN="--dry-run" ;;
    --with-content)  WITH_CONTENT="1" ;;
    -*)              echo "✗ 不认识的参数：$arg"; exit 1 ;;
    *)               if [ -z "$TARGET" ]; then TARGET="$arg"; else DEST_DIR="$arg"; fi ;;
  esac
done

# ---------- 读取配置 ----------
if [ -f deploy/deploy.env ]; then
  # shellcheck disable=SC1091
  source deploy/deploy.env
fi

TARGET="${TARGET:-${DEPLOY_TARGET:-}}"
DEST_DIR="${DEST_DIR:-${DEPLOY_PATH:-/var/www/personal-site}}"

if [ -z "$TARGET" ]; then
  cat <<'EOF'
✗ 没配置服务器地址。

  方式一（推荐）：复制一份配置再填
      cp deploy/deploy.env.example deploy/deploy.env
      $EDITOR deploy/deploy.env

  方式二：直接传参
      bash scripts/deploy.sh root@你的服务器IP /var/www/personal-site
EOF
  exit 1
fi

# ---------- 1. 拼资源 ----------
# 用 --assets 而不是完整构建：服务器是**按内容现渲染**的，磁盘上那份 HTML 没人发，
# 重新生成它只是白花时间。真正需要更新的是 styles.css / main.js 这几个静态资源。
echo ""
echo "▶ 拼样式与脚本"
node scripts/build.mjs --assets

# ---------- 2. 自检 ----------
echo ""
echo "▶ 自检"
node scripts/check.mjs

# ---------- 3. 同步 ----------
FILES=(
  assets/styles.css
  assets/main.js
  assets/pages.js
  proto
  site            # 渲染进程
  scripts         # 渲染进程要 import build.mjs
  admin           # 写作后台（不用就删掉这一行）
  deploy          # nginx / systemd 配置，放在服务器上方便对照
)

if [ -n "$WITH_CONTENT" ]; then
  FILES+=(content)
  echo ""
  echo "  ⚠ --with-content：content/ 会以本地为准覆盖服务器上的（多余的会被删掉）"
fi

echo ""
echo "▶ 同步到 ${TARGET}:${DEST_DIR}"
for f in "${FILES[@]}"; do
  [ -e "$f" ] || { echo "  ✗ 缺少 $f"; exit 1; }
done

RSYNC_ARGS=(
  -az
  --delete
  --human-readable
  --itemize-changes
  --exclude '.DS_Store'
  --exclude 'Thumbs.db'
  --exclude '.build-cache/'
  --exclude 'node_modules/'
)
[ -n "$DRY_RUN" ] && RSYNC_ARGS+=(--dry-run)

# 目标目录不在时先建出来（避免 rsync 因路径不存在而失败）
if [ -z "$DRY_RUN" ]; then
  ssh "$TARGET" "mkdir -p '$DEST_DIR'"
fi

rsync "${RSYNC_ARGS[@]}" "${FILES[@]}" "${TARGET}:${DEST_DIR}/"

echo ""
if [ -n "$DRY_RUN" ]; then
  echo "✓ 演练完成（没有真的传输）"
else
  echo "✓ 部署完成"
  echo "  改的是内容 → 什么都不用做，渲染进程盯着 content/ 会自己重渲染。"
  echo "  改的是代码 → 服务器上执行：sudo systemctl restart personal-site-site"
  echo "  有没有起来：curl -s http://127.0.0.1:8081/__status"
fi
