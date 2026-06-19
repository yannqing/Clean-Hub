export class BackupsError extends Error {
  constructor(
    public readonly code: "BACKUP_JOB_NOT_FOUND",
    message: string,
    public readonly status: 404,
  ) {
    super(message);
    this.name = "BackupsError";
  }
}
