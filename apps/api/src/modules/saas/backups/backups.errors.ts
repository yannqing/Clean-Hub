export class BackupsError extends Error {
  constructor(
    public readonly code:
      | "BACKUP_JOB_NOT_FOUND"
      | "BACKUP_TENANT_NOT_FOUND"
      | "BACKUP_NOT_READY"
      | "RESTORE_REQUEST_NOT_FOUND"
      | "RESTORE_TRANSITION_CONFLICT"
      | "RESTORE_COMPLETION_NOTE_REQUIRED",
    message: string,
    public readonly status: 400 | 404 | 409,
  ) {
    super(message);
    this.name = "BackupsError";
  }
}
