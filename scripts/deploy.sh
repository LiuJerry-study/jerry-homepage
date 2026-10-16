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
#        bash scripts/deploy.sh --sudo           ssh 账号不是站点目录属主时用（见下）
#        bash scripts/deploy.sh --tar            强制走 tar+ssh（本机没装 rsync 时自动走）
#
# 本机没装 rsync 也能用：脚本会自动改走「打包 → ssh 传 → 服务器端 rsync 解包同步」，
# 语义与 rsync 那条路径完全一样（含 --delete）。
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
SUDO_MODE=""
FORCE_TAR=""
TARGET=""
DEST_DIR=""

for arg in "$@"; do
  case "$arg" in
    --dry-run)       DRY_RUN="--dry-run" ;;
    --with-content)  WITH_CONTENT="1" ;;
    --sudo)          SUDO_MODE="1" ;;
    --tar)           FORCE_TAR="1" ;;
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

# 站点目录属主通常是 nginx，而 ssh 账号（如 admin）不是它 ——
# 这种时候用 --sudo（或 deploy.env 里写 DEPLOY_SUDO=1）：远端 rsync 走 sudo，
# 同步完再把属主改回 DEPLOY_OWNER（默认 nginx:nginx）。
SUDO_MODE="${SUDO_MODE:-${DEPLOY_SUDO:-}}"
OWNER="${DEPLOY_OWNER:-nginx:nginx}"
SSH_SUDO=""
[ -n "$SUDO_MODE" ] && SSH_SUDO="sudo "

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
# 注意 assets 推的是整个目录，不是那三个文件 —— 上面刻意列过文件名，
# 结果 assets/site-index.js 从来没被推上去过（页面里引用了它，命令面板就哑了）。
FILES=(
  assets          # styles.css / main.js / pages.js / site-data.js / site-index.js
  src             # ⚠ 必须推：渲染进程**每次都读** src/pages/index.html 当首页模板，
                  #   少了它首页会一直停在旧文案（改动像是"没生效"）。
                  #   nginx 里 src/ 是 deny 的，不会外泄。
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
  # 本地/服务器各自的私密配置：不传，也不参与 --delete（免得把服务器上的密钥文件删了）
  --exclude 'deploy.env'
  --exclude 'admin.env'
)
[ -n "$DRY_RUN" ] && RSYNC_ARGS+=(--dry-run)
[ -n "$SUDO_MODE" ] && RSYNC_ARGS+=(--rsync-path="sudo rsync")

# 只在 sudo 模式下才能改属主（普通账号本来也改不动）
CHOWN_CMD=""
[ -n "$SUDO_MODE" ] && CHOWN_CMD="cd '$DEST_DIR' && sudo chown -R $OWNER ${FILES[*]}"

USE_TAR="${FORCE_TAR:-}"
if [ -z "$USE_TAR" ] && ! command -v rsync >/dev/null 2>&1; then
  USE_TAR="1"
  echo ""
  echo "▶ 本机没有 rsync —— 自动改走 tar + ssh（服务器端解包后再同步）"
fi

if [ -n "$USE_TAR" ]; then
  # ---------- 3a. tar + ssh ----------
  # 语义与 rsync 那条**完全一样**：只在 FILES 这几个目录里 --delete，别处一概不碰。
  TARBALL="$(mktemp -t personal-site-deploy.XXXXXX).tar.gz"
  tar -czf "$TARBALL" \
    --exclude '.DS_Store' --exclude 'Thumbs.db' \
    --exclude '.build-cache' --exclude 'node_modules' \
    --exclude 'deploy.env' --exclude 'admin.env' "${FILES[@]}"
  echo "  已打包 $(du -h "$TARBALL" | cut -f1)"
  REMOTE_TGZ="/tmp/personal-site-deploy.$$.tar.gz"
  STAGE="/tmp/personal-site-stage.$$"
  if [ -z "$DRY_RUN" ]; then
    if command -v scp >/dev/null 2>&1; then
      scp -q "$TARBALL" "$TARGET:$REMOTE_TGZ"
    else
      ssh "$TARGET" "cat > '$REMOTE_TGZ'" < "$TARBALL"
    fi
    ssh "$TARGET" "set -e
      rm -rf '$STAGE'; mkdir -p '$STAGE'
      tar -xzf '$REMOTE_TGZ' -C '$STAGE'
      cd '$STAGE'
      for d in ${FILES[*]}; do
        ${SSH_SUDO}rsync -a --delete --itemize-changes \"\$d/\" '$DEST_DIR'/\$d/
      done
      $CHOWN_CMD
      rm -rf '$STAGE' '$REMOTE_TGZ'"
  else
    echo "  （演练：不传包、不改服务器）"
  fi
  rm -f "$TARBALL"
else
  # ---------- 3b. rsync ----------
  # 目标目录不在时先建出来（避免 rsync 因路径不存在而失败）
  if [ -z "$DRY_RUN" ]; then
    ssh "$TARGET" "${SSH_SUDO}mkdir -p '$DEST_DIR'"
  fi

  rsync "${RSYNC_ARGS[@]}" "${FILES[@]}" "${TARGET}:${DEST_DIR}/"

  if [ -n "$CHOWN_CMD" ] && [ -z "$DRY_RUN" ]; then
    echo ""
    echo "▶ 把属主改回 $OWNER"
    ssh "$TARGET" "$CHOWN_CMD"
  fi
fi

echo ""
if [ -n "$DRY_RUN" ]; then
  echo "✓ 演练完成（没有真的传输）"
else
  echo "✓ 部署完成"
  echo "  改的是内容 → 什么都不用做，渲染进程盯着 content/ 会自己重渲染。"
  echo "  改的是代码 → 服务器上执行：sudo systemctl restart personal-site-site"
  echo "  有没有起来：curl -s http://127.0.0.1:8081/__status"
fi
