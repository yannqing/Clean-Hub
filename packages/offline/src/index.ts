export type SyncQueueItem = {
  id: string;
  entity: string;
  operation: "create" | "update" | "delete";
  payload: unknown;
};
