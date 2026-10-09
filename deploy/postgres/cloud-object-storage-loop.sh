#!/bin/sh
set -eu

umask 077

: "${MINIO_ROOT_USER:?MINIO_ROOT_USER is required}"
: "${MINIO_ROOT_PASSWORD:?MINIO_ROOT_PASSWORD is required}"
: "${OBJECT_STORAGE_BUCKET:=cleanhub-media}"
: "${BACKUP_S3_ENDPOINT:?BACKUP_S3_ENDPOINT is required}"
: "${BACKUP_S3_ACCESS_KEY:?BACKUP_S3_ACCESS_KEY is required}"
: "${BACKUP_S3_SECRET_KEY:?BACKUP_S3_SECRET_KEY is required}"
: "${BACKUP_S3_BUCKET:?BACKUP_S3_BUCKET is required}"
: "${BACKUP_MEDIA_S3_PREFIX:=object-storage}"
: "${BACKUP_MEDIA_SYNC_INTERVAL_SECONDS:=300}"

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

mc alias set cleanhub-source http://minio:9000 \
  "$MINIO_ROOT_USER" "$MINIO_ROOT_PASSWORD" --api S3v4
mc alias set cleanhub-backup "$BACKUP_S3_ENDPOINT" \
  "$BACKUP_S3_ACCESS_KEY" "$BACKUP_S3_SECRET_KEY" --api S3v4
mc mb --ignore-existing "cleanhub-backup/$BACKUP_S3_BUCKET"
mc anonymous set none "cleanhub-backup/$BACKUP_S3_BUCKET"

while true; do
  if mc mirror \
    --overwrite \
    "cleanhub-source/$OBJECT_STORAGE_BUCKET" \
    "cleanhub-backup/$BACKUP_S3_BUCKET/$BACKUP_MEDIA_S3_PREFIX"; then
    touch /tmp/.last-media-cloud-success
  else
    echo "Object-storage cloud synchronization failed; retrying." >&2
  fi
  sleep "$BACKUP_MEDIA_SYNC_INTERVAL_SECONDS"
done
