#!/usr/bin/env bash
# =====================================================================
# EduSkill -- MySQL backup (master-dev-prompt Section I: "Backups and a
# tested recovery path in case of DB failure or accidental bulk
# delete/demap" -- there was none before this).
#
# Usage on the server:
#   bash /var/www/eduskill/scripts/backup-db.sh
#
# Cron (daily at 2am, keeps the last 14 days locally):
#   crontab -e
#   0 2 * * * bash /var/www/eduskill/scripts/backup-db.sh >> /var/log/eduskill-backup.log 2>&1
#
# Restore (DESTRUCTIVE -- overwrites the live DB with the dump):
#   gunzip -c backups/eduskill-YYYYMMDD-HHMMSS.sql.gz | mysql -u<user> -p <dbname>
# =====================================================================
set -euo pipefail

# Base dir defaults to this script's own parent (normal cron usage, run
# from inside the live release once this file has been deployed once).
# deploy-server.sh passes the live release dir explicitly as $1 on its
# pre-deploy safety backup, since that's the one guaranteed to already
# have a real .env even on the very first deploy after this file lands.
BASE="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
ENV_FILE="$BASE/.env"
BACKUP_DIR="$BASE/backups"
RETENTION_DAYS=14

if [ ! -f "$ENV_FILE" ]; then
  echo "❌ No .env found at $ENV_FILE -- can't read DB credentials." >&2
  exit 1
fi

# Minimal .env reader -- avoids a dotenv dependency for a shell script.
get_env() { grep -E "^$1=" "$ENV_FILE" | head -1 | cut -d '=' -f2- | tr -d '"'"'"; }

DB_HOST="$(get_env DB_HOST)"; DB_HOST="${DB_HOST:-localhost}"
DB_PORT="$(get_env DB_PORT)"; DB_PORT="${DB_PORT:-3306}"
DB_USER="$(get_env DB_USER)"; DB_USER="${DB_USER:-eduskill}"
DB_PASSWORD="$(get_env DB_PASSWORD)"
DB_NAME="$(get_env DB_NAME)"; DB_NAME="${DB_NAME:-eduskill}"

mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y%m%d-%H%M%S)"
OUT="$BACKUP_DIR/eduskill-$STAMP.sql.gz"

echo "==> Dumping '$DB_NAME' from $DB_HOST:$DB_PORT to $OUT"
MYSQL_PWD="$DB_PASSWORD" mysqldump \
  -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" \
  --single-transaction --routines --triggers \
  "$DB_NAME" | gzip > "$OUT"

echo "==> Pruning backups older than $RETENTION_DAYS days"
find "$BACKUP_DIR" -name 'eduskill-*.sql.gz' -mtime "+$RETENTION_DAYS" -delete

echo "✅ Backup complete: $OUT ($(du -h "$OUT" | cut -f1))"
