import assert from "node:assert/strict";

import "../../../config/env.js";
import {
  closeDbConnection,
  getDb,
  runWithSystemDatabaseContext,
  userProfiles,
  users,
} from "@cleanhub/db";
import { createId } from "@cleanhub/id";
import { eq } from "drizzle-orm";

import { AuthRepository } from "../../auth/auth.repository.js";
import {
  findSaasUserDetailById,
  updateSaasUserRecord,
} from "../users/saas-users.repository.js";
import { upsertPlatformSettings } from "./platform-settings.repository.js";
import { saasLanguagePreferenceKey } from "./saas-language.js";

const rollback = new Error("SAAS_LANGUAGE_INTEGRATION_ROLLBACK");

async function run() {
  try {
    await runWithSystemDatabaseContext(async () => {
      try {
        await getDb().transaction(async (tx) => {
          const userId = createId();
          await tx.insert(users).values({
            id: userId,
            userType: "saas",
            email: `language-${userId.toLowerCase()}@integration.cleanhub.local`,
            normalizedEmail: `language-${userId.toLowerCase()}@integration.cleanhub.local`,
            passwordHash: "integration-test-only",
            pinHash: "integration-test-only",
            status: "active",
          });
          await tx.insert(userProfiles).values({
            userId,
            displayName: "Language test administrator",
            language: "en",
            metadata: { preserveMe: true },
          });

          const platform = async (language: "en" | "fr" | "zh-CN") =>
            upsertPlatformSettings(tx, {
              actorUserId: userId,
              defaultLanguage: language,
              defaultCurrency: "XOF",
              timezone: "UTC",
              maintenanceMode: false,
            });
          const auth = new AuthRepository(tx);
          const user = await auth.findUserById(userId);
          assert.ok(user);
          const sessionLanguage = async () =>
            (await auth.getUserAccess(user, "web")).language;

          await platform("zh-CN");
          assert.equal(await sessionLanguage(), "zh-CN", "untouched SaaS accounts inherit the platform default");
          assert.equal((await findSaasUserDetailById(tx, userId))?.language, "zh-CN");

          await updateSaasUserRecord(tx, { userId, language: "fr" });
          assert.equal(await sessionLanguage(), "fr", "an explicit account choice persists in sessions");
          await platform("en");
          assert.equal(await sessionLanguage(), "fr", "platform changes do not replace a personal choice");

          await updateSaasUserRecord(tx, { userId, language: "en" });
          await platform("zh-CN");
          assert.equal(await sessionLanguage(), "en", "explicit English remains distinct from the old implicit default");
          const [profile] = await tx.select({ metadata: userProfiles.metadata })
            .from(userProfiles).where(eq(userProfiles.userId, userId));
          assert.equal(profile?.metadata?.preserveMe, true);
          assert.equal(profile?.metadata?.[saasLanguagePreferenceKey], "en");
          assert.equal((await findSaasUserDetailById(tx, userId))?.language, "en");
          throw rollback;
        });
      } catch (error) {
        if (error !== rollback) throw error;
      }
    });
  } finally {
    await closeDbConnection();
  }
}

run().then(() => console.log("SaaS language integration passed with a clean rollback."));
