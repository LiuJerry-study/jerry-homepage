#!/bin/sh
# ==========================================================================
# 备份 content/ —— 动态化之后，服务器上的内容就是唯一副本
# --------------------------------------------------------------------------
# 以前内容是"本地写完 rsync 上去"，服务器只是个产物、丢了能重建。
# 现在后台直接写服务器上的 content/，所以这里必须自己兜底 ——
# 服务器一挂，文章就真没了。
#
# 由 deploy/personal-site-backup.timer 每天跑一次，也可以手动跑：
#     sudo -u www-data sh deploy/backup-content.sh
#
# 产物：backups/content-YYYYMMDD-HHMMSS.tar.gz，**只留最近 2 份**。
#   —— 本地这份只是"手边能立刻回滚"的那一档，不是长久存档；
#      真正管版本的是下面可选的 GitHub 那一档。
#
# 顺便推到 GitHub（可选，比 tar 包好得多：能看 diff、能翻历史、能只回滚一个文件）：
#   1. 建一个**私有**仓库专门放内容（别用主仓库，见 DEPLOY.md 第 8 节）
#   2. 给服务器配一把只能写这个仓库的 deploy key
#   3. 在 personal-site-backup.service 里加上：
#        Environment=GIT_REMOTE=git@github.com:你的名字/jerry-content.git
#      或在 /etc/personal-site-backup.env 里写，再用 EnvironmentFile= 引进来
#   没设 GIT_REMOTE 就只打包，什么都不推。
# ==========================================================================
set -eu

DIR="${SITE_DIR:-/srv/personal-site}"
KEEP="${KEEP:-2}"

cd "$DIR"

if [ ! -d content ]; then
  echo "找不到 $DIR/content" >&2
  exit 1
fi

mkdir -p backups
STAMP=$(date +%Y%m%d-%H%M%S)
tar czf "backups/content-$STAMP.tar.gz" content/

echo "已备份 backups/content-$STAMP.tar.gz（$(du -h "backups/content-$STAMP.tar.gz" | cut -f1)）"

# 只留最近 $KEEP 份
ls -1t backups/content-*.tar.gz 2>/dev/null | tail -n +$((KEEP + 1)) | while read -r f; do
  rm -f -- "$f"
  echo "清掉旧备份 $f"
done

# ---------------------------------------------------------------- GitHub

# 把 content/ 镜像到一个独立的 git 仓库。**每次的改动都是一次提交** ——
# 所以"上周三那篇改错了哪一行"这种问题，git log / git diff 就能答，
# 而 tar 包只能整份回滚。
#
# 用独立仓库而不是主仓库，是为了避开两个坑：
#   · 主仓库的分支会被代码的改动推着走，服务器这边一 push 就打架；
#   · 内容要能单独设成私有（主仓库是公开的，草稿也会跟着公开）。
if [ -n "${GIT_REMOTE:-}" ]; then
  MIRROR="${GIT_MIRROR:-${DIR%/}-content}"

  if [ ! -d "$MIRROR/.git" ]; then
    echo "第一次：clone $GIT_REMOTE → $MIRROR"
    mkdir -p "$(dirname "$MIRROR")"
    git clone --quiet "$GIT_REMOTE" "$MIRROR"
  fi

  cd "$MIRROR"
  git pull --quiet --ff-only || echo "（pull 失败，按本地这份继续）"

  # 镜像过去；--delete 是重点：后台删掉的文章，备份里也要删掉，
  # 否则"备份"慢慢就变成"什么东西都留着"的一堆垃圾
  if command -v rsync >/dev/null 2>&1; then
    rsync -a --delete "$DIR/content/" "$MIRROR/content/"
  else
    rm -rf "$MIRROR/content"
    mkdir -p "$MIRROR/content"
    cp -R "$DIR/content/." "$MIRROR/content/"
  fi

  git add -A content
  if git diff --cached --quiet; then
    echo "内容没变，不提交"
  else
    git -c user.name="personal-site backup" -c user.email="backup@localhost" \
        commit --quiet -m "content $(date +%Y-%m-%d\ %H:%M)"
    if git push --quiet origin HEAD 2>/dev/null; then
      echo "已推到 GitHub：$(git log -1 --format=%h)"
    else
      echo "推 GitHub 失败（网络或密钥？）—— 本地提交还在 $MIRROR，下次会重试" >&2
    fi
  fi
fi
