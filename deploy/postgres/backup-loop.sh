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
: "${BACKUP_JOB_POLL_SECONDS:=30}"

case "$BACKUP_INTERVAL_SECONDS" in
  *[!0-9]*|"") echo "BACKUP_INTERVAL_SECONDS must be an integer." >&2; exit 1 ;;
esac
if [ "$BACKUP_INTERVAL_SECONDS" -lt 60 ]; then
  echo "BACKUP_INTERVAL_SECONDS must be at least 60." >&2
  exit 1
fi
case "$BACKUP_JOB_POLL_SECONDS" in
  *[!0-9]*|"") echo "BACKUP_JOB_POLL_SECONDS must be an integer." >&2; exit 1 ;;
esac
if [ "$BACKUP_JOB_POLL_SECONDS" -lt 5 ]; then
  echo "BACKUP_JOB_POLL_SECONDS must be at least 5." >&2
  exit 1
fi

mkdir -p "$BACKUP_DIRECTORY"
# A hard power loss can leave an unfinished archive behind. It is never a
# valid restore point and must not be mistaken for the next successful backup.
find "$BACKUP_DIRECTORY" -maxdepth 1 -type f -name '*.partial' -delete
export PGPASSWORD="$POSTGRES_PASSWORD"

run_backup() {
  BACKUP_BASE_NAME=
  BACKUP_CHECKSUM=
  BACKUP_SIZE_BYTES=
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
  BACKUP_BASE_NAME="$base_name"
  BACKUP_CHECKSUM="$checksum"
  BACKUP_SIZE_BYTES="$(wc -c < "$final_path" | tr -d ' ')"
  echo "PostgreSQL backup ${base_name} completed and verified."
}

query_jobs() {
  psql --host "$POSTGRES_HOST" --port "$POSTGRES_PORT" \
    --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
    --no-psqlrc --quiet --tuples-only --no-align \
    --set ON_ERROR_STOP=1 -c "$1"
}

claim_pending_jobs() {
  query_jobs "UPDATE backup_jobs
    SET status = 'running', started_at = now(), updated_at = now(),
        failure_reason = NULL, version = version + 1
    WHERE status = 'pending' AND deleted_at IS NULL
    RETURNING id"
}

finish_jobs() {
  job_ids="$1"
  result="$2"
  for job_id in $job_ids; do
    case "$job_id" in
      *[!0-9A-HJKMNP-TV-Z]*|"") echo "Invalid backup job ID returned by database." >&2; continue ;;
    esac
    if [ "${#job_id}" -ne 26 ]; then
      echo "Invalid backup job ID length returned by database." >&2
      continue
    fi
    if [ "$result" = succeeded ]; then
      query_jobs "UPDATE backup_jobs
        SET status = 'succeeded', finished_at = now(), updated_at = now(),
            result_metadata = jsonb_build_object(
              'storageType', 'local-volume',
              'physicalScope', 'platform',
              'dumpKey', '$BACKUP_BASE_NAME.dump',
              'sizeBytes', $BACKUP_SIZE_BYTES,
              'checksum', '$BACKUP_CHECKSUM'
            ), version = version + 1
        WHERE id = '$job_id' AND status = 'running'" >/dev/null ||
        echo "Could not record successful backup job $job_id." >&2
    else
      query_jobs "UPDATE backup_jobs
        SET status = 'failed', finished_at = now(), updated_at = now(),
            failure_reason = 'PostgreSQL dump or archive verification failed',
            version = version + 1
        WHERE id = '$job_id' AND status = 'running'" >/dev/null ||
        echo "Could not record failed backup job $job_id." >&2
    fi
  done
}

run_cycle() {
  pending_ids=
  if ! pending_ids="$(claim_pending_jobs)"; then
    echo "Could not claim SaaS backup jobs; scheduled backup will still run." >&2
  fi
  if run_backup; then
    finish_jobs "$pending_ids" succeeded
  else
    finish_jobs "$pending_ids" failed
    echo "PostgreSQL backup failed; the previous verified backup is preserved." >&2
  fi
}

run_requested_backup() {
  pending_ids=
  if ! pending_ids="$(claim_pending_jobs)"; then
    echo "Could not poll SaaS backup jobs." >&2
    return
  fi
  [ -n "$pending_ids" ] || return 0
  if run_backup; then
    finish_jobs "$pending_ids" succeeded
  else
    finish_jobs "$pending_ids" failed
    echo "Requested PostgreSQL backup failed." >&2
  fi
}

# A container restart interrupts pg_dump; do not leave its job marked running.
query_jobs "UPDATE backup_jobs
  SET status = 'failed', finished_at = now(), updated_at = now(),
      failure_reason = 'Backup worker restarted before verification',
      version = version + 1
  WHERE status = 'running' AND deleted_at IS NULL" >/dev/null ||
  echo "Could not reconcile interrupted backup jobs." >&2

while true; do
  cycle_started_at="$(date +%s)"
  next_cycle_at=$((cycle_started_at + BACKUP_INTERVAL_SECONDS))
  run_cycle
  while [ "$(date +%s)" -lt "$next_cycle_at" ]; do
    remaining=$((next_cycle_at - $(date +%s)))
    sleep_seconds="$BACKUP_JOB_POLL_SECONDS"
    [ "$remaining" -lt "$sleep_seconds" ] && sleep_seconds="$remaining"
    [ "$sleep_seconds" -gt 0 ] && sleep "$sleep_seconds"
    [ "$(date +%s)" -lt "$next_cycle_at" ] && run_requested_backup
  done
done
