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
# 产物：backups/content-YYYYMMDD-HHMMSS.tar.gz，只留最近 30 份。
# 想更稳就在 deploy/backup-content.sh 末尾再加一段推到别处（对象存储 / 另一台机）。
# ==========================================================================
set -eu

DIR="${SITE_DIR:-/srv/personal-site}"
KEEP="${KEEP:-30}"

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
