import { getDb, type Database } from "@cleanhub/db";

import { findBackupJobs } from "./backups.repository.js";
import type { BackupJobListInput, BackupJobListItem } from "./backups.types.js";

export async function listBackupJobs(
  input: BackupJobListInput,
  db: Database = getDb(),
): Promise<BackupJobListItem[]> {
  return findBackupJobs(db, input);
}
