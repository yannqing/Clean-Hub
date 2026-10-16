export type OperationLogErrorCode = "OPERATION_LOG_NOT_FOUND";

export class OperationLogError extends Error {
  constructor(
    public readonly code: OperationLogErrorCode,
    message: string,
    public readonly status: 404,
  ) {
    super(message);
    this.name = "OperationLogError";
  }
}
