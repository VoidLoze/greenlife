#!/bin/sh
# Runs inside the "backup" container: once a day at BACKUP_HOUR (Almaty time) dumps the database and archives the
# uploaded files into /backups, then removes copies older than BACKUP_KEEP_DAYS. One copy is made right at start.
# With BACKUP_WEBDAV_URL set, every copy also goes to a cloud disk (Yandex Disk or any WebDAV storage): the database
# dump as a file, the photos folder incrementally (only new files are sent). Failures are reported to Telegram.
# "once" as the first argument makes a single copy and exits: docker compose run --rm backup once
set -u

KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"
REMOTE_KEEP_DAYS="${BACKUP_REMOTE_KEEP_DAYS:-60}"
HOUR="${BACKUP_HOUR:-3}"
REMOTE_DIR="${BACKUP_REMOTE_DIR:-greenleaf-backups}"

if [ -n "${BACKUP_WEBDAV_URL:-}" ]; then
  export RCLONE_CONFIG=/tmp/rclone.conf
  : > "$RCLONE_CONFIG"
  export RCLONE_CONFIG_CLOUD_TYPE=webdav
  export RCLONE_CONFIG_CLOUD_URL="$BACKUP_WEBDAV_URL"
  export RCLONE_CONFIG_CLOUD_VENDOR=other
  export RCLONE_CONFIG_CLOUD_USER="${BACKUP_WEBDAV_USER:-}"
  RCLONE_CONFIG_CLOUD_PASS="$(rclone obscure "${BACKUP_WEBDAV_PASSWORD:-}")"
  export RCLONE_CONFIG_CLOUD_PASS
fi

# The bot token and chat set in the admin panel live in the database and win over the .env values, as in the app.
setting() {
  psql -tAq -c "select value from site_settings where key = 'store.$1' and value is not null" 2>/dev/null
}

alert() {
  echo "backup: $1" >&2
  token="$(setting telegram_bot_token)"
  chat="$(setting telegram_chat_id)"
  token="${token:-${TELEGRAM_BOT_TOKEN:-}}"
  chat="${chat:-${TELEGRAM_CHAT_ID:-}}"
  [ -n "$token" ] && [ -n "$chat" ] || return 0
  curl -s -m 20 -o /dev/null "https://api.telegram.org/bot$token/sendMessage" \
    --data-urlencode "chat_id=$chat" \
    --data-urlencode "text=⚠️ Резервная копия Greenleaf: $1" || true
}

upload() {
  stamp="$1"
  [ -n "${BACKUP_WEBDAV_URL:-}" ] || return 0
  ok=1
  if [ -f "/backups/db-$stamp.dump" ]; then
    rclone copyto --retries 3 "/backups/db-$stamp.dump" "cloud:$REMOTE_DIR/db/db-$stamp.dump" || ok=0
  fi
  rclone copy --retries 3 --transfers 2 /uploads "cloud:$REMOTE_DIR/uploads" || ok=0
  if [ "$ok" = 1 ]; then
    rclone delete --min-age "${REMOTE_KEEP_DAYS}d" "cloud:$REMOTE_DIR/db" >/dev/null 2>&1
    echo "backup: copied to the cloud ($REMOTE_DIR)"
  else
    alert "не удалось отправить копию в облако ($REMOTE_DIR). Проверьте BACKUP_WEBDAV_* в .env и место на диске."
  fi
}

backup() {
  stamp=$(date +%Y-%m-%d_%H%M)
  tmp="/backups/.db-$stamp.dump.partial"
  if pg_dump --format=custom --no-owner --file="$tmp"; then
    mv "$tmp" "/backups/db-$stamp.dump"
    echo "backup: database -> db-$stamp.dump"
  else
    rm -f "$tmp"
    alert "не удалось сохранить базу данных."
  fi
  if tar -czf "/backups/.uploads-$stamp.tar.gz.partial" -C /uploads . 2>/dev/null; then
    mv "/backups/.uploads-$stamp.tar.gz.partial" "/backups/uploads-$stamp.tar.gz"
    echo "backup: photos -> uploads-$stamp.tar.gz"
  else
    rm -f "/backups/.uploads-$stamp.tar.gz.partial"
    alert "не удалось сохранить архив фото."
  fi
  find /backups -maxdepth 1 -type f \( -name 'db-*.dump' -o -name 'uploads-*.tar.gz' \) -mtime +"$KEEP_DAYS" -delete
  upload "$stamp"
}

mkdir -p /backups
backup
[ "${1:-}" = "once" ] && exit 0
while true; do
  now_h=$(date +%H | sed 's/^0//')
  now_m=$(date +%M | sed 's/^0//')
  # Minutes until the next BACKUP_HOUR:00.
  wait_min=$(( ((HOUR - ${now_h:-0} + 24) % 24) * 60 - ${now_m:-0} ))
  [ "$wait_min" -le 0 ] && wait_min=$(( wait_min + 1440 ))
  sleep $(( wait_min * 60 ))
  backup
done
