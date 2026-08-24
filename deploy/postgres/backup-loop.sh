#!/bin/sh
set -eu

umask 077

: "${POSTGRES_HOST:=postgres}"
: "${POSTGRES_PORT:=5432}"
: "${POSTGRES_DB:=cleanhub}"
: "${POSTGRES_USER:?POSTGRES_USER is required}"
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}"
: "${BACKUP_DIRECTORY:=/backups}"
: "${BACKUP_INTERVAL_SECONDS:=900}"
: "${BACKUP_LOCAL_RETENTION_DAYS:=7}"

case "$BACKUP_INTERVAL_SECONDS" in
  *[!0-9]*|"") echo "BACKUP_INTERVAL_SECONDS must be an integer." >&2; exit 1 ;;
esac
if [ "$BACKUP_INTERVAL_SECONDS" -lt 60 ]; then
  echo "BACKUP_INTERVAL_SECONDS must be at least 60." >&2
  exit 1
fi

mkdir -p "$BACKUP_DIRECTORY"
# A hard power loss can leave an unfinished archive behind. It is never a
# valid restore point and must not be mistaken for the next successful backup.
find "$BACKUP_DIRECTORY" -maxdepth 1 -type f -name '*.partial' -delete
export PGPASSWORD="$POSTGRES_PASSWORD"

run_backup() {
  timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
  base_name="cleanhub-${POSTGRES_DB}-${timestamp}"
  partial_path="$BACKUP_DIRECTORY/.${base_name}.dump.partial"
  final_path="$BACKUP_DIRECTORY/${base_name}.dump"
  checksum_partial="$BACKUP_DIRECTORY/.${base_name}.sha256.partial"
  checksum_final="$BACKUP_DIRECTORY/${base_name}.sha256"

  cleanup_partial_backup() {
    rm -f "$partial_path" "$checksum_partial"
  }
  trap cleanup_partial_backup EXIT INT TERM

  echo "Creating PostgreSQL backup ${base_name}."
  if ! pg_dump \
    --host "$POSTGRES_HOST" \
    --port "$POSTGRES_PORT" \
    --username "$POSTGRES_USER" \
    --dbname "$POSTGRES_DB" \
    --format custom \
    --compress 6 \
    --no-owner \
    --no-privileges \
    --file "$partial_path"; then
    cleanup_partial_backup
    trap - EXIT INT TERM
    return 1
  fi

  # This detects truncated/corrupt custom archives before they can be marked
  # successful or uploaded. A full isolated restore drill is provided
  # separately and remains part of the release checklist.
  if ! pg_restore --list "$partial_path" >/dev/null; then
    cleanup_partial_backup
    trap - EXIT INT TERM
    return 1
  fi
  if ! checksum_line="$(sha256sum "$partial_path")"; then
    cleanup_partial_backup
    trap - EXIT INT TERM
    return 1
  fi
  checksum="${checksum_line%% *}"
  if [ -z "$checksum" ]; then
    cleanup_partial_backup
    trap - EXIT INT TERM
    return 1
  fi
  if ! printf '%s  %s\n' "$checksum" "${base_name}.dump" > "$checksum_partial"; then
    cleanup_partial_backup
    trap - EXIT INT TERM
    return 1
  fi

  # Publish the checksum first. The cloud mirror may briefly see a checksum
  # without an archive, but it can never see a newly published archive without
  # its verifier.
  if ! mv "$checksum_partial" "$checksum_final"; then
    cleanup_partial_backup
    trap - EXIT INT TERM
    return 1
  fi
  if ! mv "$partial_path" "$final_path"; then
    rm -f "$checksum_final"
    cleanup_partial_backup
    trap - EXIT INT TERM
    return 1
  fi
  if ! touch "$BACKUP_DIRECTORY/.last-success"; then
    echo "Backup archive is valid, but its health marker could not be updated." >&2
    trap - EXIT INT TERM
    return 1
  fi

  if ! find "$BACKUP_DIRECTORY" -maxdepth 1 -type f \
    \( -name 'cleanhub-*.dump' -o -name 'cleanhub-*.sha256' \) \
    -mtime "+$BACKUP_LOCAL_RETENTION_DAYS" -delete; then
    echo "Backup retention cleanup failed; verified backups were preserved." >&2
  fi

  cleanup_partial_backup
  trap - EXIT INT TERM
  echo "PostgreSQL backup ${base_name} completed and verified."
}

while true; do
  cycle_started_at="$(date +%s)"
  if ! run_backup; then
    echo "PostgreSQL backup failed; the previous verified backup is preserved." >&2
  fi
  cycle_finished_at="$(date +%s)"
  cycle_elapsed_seconds=$((cycle_finished_at - cycle_started_at))
  sleep_seconds=$((BACKUP_INTERVAL_SECONDS - cycle_elapsed_seconds))
  if [ "$sleep_seconds" -lt 1 ]; then
    sleep_seconds=1
  fi
  sleep "$sleep_seconds"
done
