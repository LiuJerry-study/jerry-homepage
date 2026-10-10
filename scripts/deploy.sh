#!/usr/bin/env bash
# ==========================================================================
# 一键部署：构建 → 自检 → rsync 到云服务器
# --------------------------------------------------------------------------
# 用法：
#   1) 复制配置文件（只需一次）：
#        cp deploy/deploy.env.example deploy/deploy.env
#        然后编辑 deploy/deploy.env 填服务器地址和目标目录
#   2) 部署：
#        bash scripts/deploy.sh
#        加 --dry-run 只看会传什么、不真传
#
#   也可以临时指定目标，不动配置文件：
#        bash scripts/deploy.sh root@1.2.3.4 /var/www/personal-site
#
# 说明：站点是纯静态的，服务器上不需要跑任何服务进程。
#       这个脚本只负责把文件同步过去，nginx 负责发。
# ==========================================================================
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"

DRY_RUN=""
TARGET="${1:-}"
DEST_DIR="${2:-}"

for arg in "$@"; do
  [ "$arg" = "--dry-run" ] && DRY_RUN="--dry-run"
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

# ---------- 1. 构建 ----------
echo ""
echo "▶ 构建"
node scripts/build.mjs

# ---------- 2. 自检 ----------
echo ""
echo "▶ 自检"
node scripts/check.mjs

# ---------- 3. 同步 ----------
# 只传运行时要用的文件，源码 / 内容源 / 脚本不上服务器
FILES=(
  index.html
  assets
  blog
  projects
  resume.html
  404.html
  sitemap.xml
  rss.xml
  robots.txt
  proto
)

echo ""
echo "▶ 同步到 ${TARGET}:${DEST_DIR}"
for f in "${FILES[@]}"; do
  [ -e "$f" ] || { echo "  ✗ 缺少 $f，先跑构建"; exit 1; }
done

RSYNC_ARGS=(
  -az
  --delete
  --human-readable
  --itemize-changes
  --exclude '.DS_Store'
  --exclude 'Thumbs.db'
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
  echo "  提示：HTML 是 no-cache，CSS/JS 带 ?v= 版本串，访客不会拿到旧页面。"
fi
