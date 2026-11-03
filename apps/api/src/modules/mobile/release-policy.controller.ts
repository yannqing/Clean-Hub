import {
  getDb,
  platformSettings,
  runWithSystemDatabaseContext,
} from "@cleanhub/db";
import { eq } from "drizzle-orm";
import type { Context } from "hono";
import type { AppBindings } from "../../http/types.js";

export async function mobileReleasePolicyController(c: Context<AppBindings>) {
  const policy = await runWithSystemDatabaseContext(async () => {
    const [settings] = await getDb()
      .select({
        minimumVersion: platformSettings.mobileMinimumVersion,
        updateUrl: platformSettings.mobileUpdateUrl,
        version: platformSettings.version,
      })
      .from(platformSettings)
      .where(eq(platformSettings.settingKey, "default"))
      .limit(1);
    return settings ?? { minimumVersion: "0.0.0", updateUrl: null, version: 0 };
  });
  c.header("Cache-Control", "no-store");
  return c.json(policy);
}
