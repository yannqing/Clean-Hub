#!/bin/sh
set -eu

umask 077

: "${BACKUP_DIRECTORY:=/backups}"
: "${BACKUP_S3_ENDPOINT:?BACKUP_S3_ENDPOINT is required}"
: "${BACKUP_S3_ACCESS_KEY:?BACKUP_S3_ACCESS_KEY is required}"
: "${BACKUP_S3_SECRET_KEY:?BACKUP_S3_SECRET_KEY is required}"
: "${BACKUP_S3_BUCKET:?BACKUP_S3_BUCKET is required}"
: "${BACKUP_S3_PREFIX:=postgres}"
: "${BACKUP_CLOUD_SYNC_INTERVAL_SECONDS:=60}"

case "$BACKUP_S3_ENDPOINT" in
  https://*) ;;
  http://*)
    if [ "${BACKUP_S3_ALLOW_INSECURE:-false}" != "true" ]; then
      echo "Cloud backup endpoint must use HTTPS." >&2
      exit 1
    fi
    ;;
  *) echo "BACKUP_S3_ENDPOINT must be an HTTP(S) URL." >&2; exit 1 ;;
esac

mc alias set cleanhub-backup \
  "$BACKUP_S3_ENDPOINT" \
  "$BACKUP_S3_ACCESS_KEY" \
  "$BACKUP_S3_SECRET_KEY" \
  --api S3v4
mc mb --ignore-existing "cleanhub-backup/$BACKUP_S3_BUCKET"
mc anonymous set none "cleanhub-backup/$BACKUP_S3_BUCKET"

sync_verified_backups() {
  found_backup=false
  sync_failed=false
  uploaded_marker_directory=/tmp/cleanhub-cloud-uploaded
  mkdir -p "$uploaded_marker_directory"
  if ! mc ls "cleanhub-backup/$BACKUP_S3_BUCKET" >/dev/null; then
    echo "External backup bucket is unreachable." >&2
    return 1
  fi

  for checksum_path in "$BACKUP_DIRECTORY"/cleanhub-*.sha256; do
    [ -f "$checksum_path" ] || continue
    found_backup=true
    archive_path="${checksum_path%.sha256}.dump"
    if [ ! -f "$archive_path" ]; then
      echo "Skipping checksum without an archive: $(basename "$checksum_path")." >&2
      sync_failed=true
      continue
    fi
    archive_name="$(basename "$archive_path")"
    checksum_name="$(basename "$checksum_path")"
    uploaded_marker="$uploaded_marker_directory/${archive_name}.uploaded"
    if [ -f "$uploaded_marker" ]; then
      continue
    fi
    if ! (
      cd "$BACKUP_DIRECTORY"
      sha256sum -c "$(basename "$checksum_path")" >/dev/null
    ); then
      echo "Refusing to upload an unverified backup: $(basename "$archive_path")." >&2
      sync_failed=true
      continue
    fi

    remote_prefix="cleanhub-backup/$BACKUP_S3_BUCKET/$BACKUP_S3_PREFIX"
    if mc stat "$remote_prefix/$archive_name" >/dev/null 2>&1 &&
       mc stat "$remote_prefix/$checksum_name" >/dev/null 2>&1; then
      touch "$uploaded_marker"
      continue
    fi
    # Publish the verifier first. Restore tooling must require both objects, so
    # an interrupted upload can never advertise an unverified restore point.
    if ! mc cp "$checksum_path" "$remote_prefix/$checksum_name" ||
       ! mc cp "$archive_path" "$remote_prefix/$archive_name"; then
      echo "Cloud upload failed for $archive_name." >&2
      sync_failed=true
      continue
    fi
    touch "$uploaded_marker"
  done

  [ "$found_backup" = true ] && [ "$sync_failed" = false ]
}

while true; do
  if sync_verified_backups; then
    touch /tmp/.last-cloud-success
  else
    echo "No fully verified cloud backup was synchronized; retrying without deleting local backups." >&2
  fi
  sleep "$BACKUP_CLOUD_SYNC_INTERVAL_SECONDS"
done
