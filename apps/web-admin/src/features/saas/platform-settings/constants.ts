import type { PlatformSettingsLanguage } from "./types";

export const platformLanguageOptions = [
  { label: "English", value: "en" },
  { label: "Français", value: "fr" },
  { label: "中文 (简体)", value: "zh-CN" },
] as const satisfies ReadonlyArray<{
  label: string;
  value: PlatformSettingsLanguage;
}>;

