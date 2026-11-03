import type { TranslationKey } from "@cleanhub/i18n";

import { posMessage } from "@/lib/pos-message";

/**
 * Settings section names, resolved per call.
 *
 * The same six names were written out four times -- the sidebar, the settings
 * index, the section headings and the terminal card -- each as its own
 * Chinese Record. The keys already matched, so they all read from
 * `pos.settingsNav.*` now.
 */
export function getSettingsSectionTitle(section: string): string {
  return posMessage(`pos.settingsNav.${section}.title` as TranslationKey);
}

export function getSettingsSectionDescription(section: string): string {
  return posMessage(`pos.settingsNav.${section}.description` as TranslationKey);
}
