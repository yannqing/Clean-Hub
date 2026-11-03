#!/bin/sh
set -eu

umask 077

: "${POSTGRES_HOST:=postgres}"
: "${POSTGRES_PORT:=5432}"
: "${POSTGRES_USER:?POSTGRES_USER is required}"
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}"
: "${BACKUP_DIRECTORY:=/backups}"

archive_path="${1:-}"
if [ -z "$archive_path" ]; then
  archive_path="$(find "$BACKUP_DIRECTORY" -maxdepth 1 -type f -name 'cleanhub-*.dump' | sort | tail -n 1)"
fi
if [ -z "$archive_path" ] || [ ! -f "$archive_path" ]; then
  echo "No backup archive was found for the restore drill." >&2
  exit 1
fi

export PGPASSWORD="$POSTGRES_PASSWORD"
drill_database="cleanhub_restore_drill_$(date -u +%Y%m%d%H%M%S)_$$"

cleanup() {
  dropdb \
    --if-exists \
    --force \
    --host "$POSTGRES_HOST" \
    --port "$POSTGRES_PORT" \
    --username "$POSTGRES_USER" \
    "$drill_database" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

checksum_path="${archive_path%.dump}.sha256"
if [ -f "$checksum_path" ]; then
  (cd "$(dirname "$archive_path")" && sha256sum -c "$(basename "$checksum_path")")
fi

createdb \
  --host "$POSTGRES_HOST" \
  --port "$POSTGRES_PORT" \
  --username "$POSTGRES_USER" \
  "$drill_database"
pg_restore \
  --exit-on-error \
  --no-owner \
  --no-privileges \
  --host "$POSTGRES_HOST" \
  --port "$POSTGRES_PORT" \
  --username "$POSTGRES_USER" \
  --dbname "$drill_database" \
  "$archive_path"
psql \
  --host "$POSTGRES_HOST" \
  --port "$POSTGRES_PORT" \
  --username "$POSTGRES_USER" \
  --dbname "$drill_database" \
  --tuples-only \
  --command "select count(*) from information_schema.tables where table_schema = 'public';" \
  | grep -Eq '[1-9][0-9]*'

echo "Restore drill succeeded for $(basename "$archive_path")."
