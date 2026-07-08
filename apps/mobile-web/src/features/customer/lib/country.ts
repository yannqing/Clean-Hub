import type { SupportedLocale } from "@cleanhub/i18n";

export type CountryOption = {
  code: string;
  fallbackLabel: string;
};

const intlLocales: Record<SupportedLocale, string> = {
  fr: "fr-FR",
  en: "en-US",
  "zh-CN": "zh-CN",
};

const addressCountryOptions: CountryOption[] = [
  "AF",
  "AX",
  "AL",
  "DZ",
  "AS",
  "AD",
  "AO",
  "AI",
  "AQ",
  "AG",
  "AR",
  "AM",
  "AW",
  "AU",
  "AT",
  "AZ",
  "BS",
  "BH",
  "BD",
  "BB",
  "BY",
  "BE",
  "BZ",
  "BJ",
  "BM",
  "BT",
  "BO",
  "BQ",
  "BA",
  "BW",
  "BV",
  "BR",
  "IO",
  "BN",
  "BG",
  "BF",
  "BI",
  "CV",
  "KH",
  "CM",
  "CA",
  "KY",
  "CF",
  "TD",
  "CL",
  "CN",
  "CX",
  "CC",
  "CO",
  "KM",
  "CG",
  "CD",
  "CK",
  "CR",
  "CI",
  "HR",
  "CU",
  "CW",
  "CY",
  "CZ",
  "DK",
  "DJ",
  "DM",
  "DO",
  "EC",
  "EG",
  "SV",
  "GQ",
  "ER",
  "EE",
  "SZ",
  "ET",
  "FK",
  "FO",
  "FJ",
  "FI",
  "FR",
  "GF",
  "PF",
  "TF",
  "GA",
  "GM",
  "GE",
  "DE",
  "GH",
  "GI",
  "GR",
  "GL",
  "GD",
  "GP",
  "GU",
  "GT",
  "GG",
  "GN",
  "GW",
  "GY",
  "HT",
  "HM",
  "VA",
  "HN",
  "HK",
  "HU",
  "IS",
  "IN",
  "ID",
  "IR",
  "IQ",
  "IE",
  "IM",
  "IL",
  "IT",
  "JM",
  "JP",
  "JE",
  "JO",
  "KZ",
  "KE",
  "KI",
  "KP",
  "KR",
  "KW",
  "KG",
  "LA",
  "LV",
  "LB",
  "LS",
  "LR",
  "LY",
  "LI",
  "LT",
  "LU",
  "MO",
  "MG",
  "MW",
  "MY",
  "MV",
  "ML",
  "MT",
  "MH",
  "MQ",
  "MR",
  "MU",
  "YT",
  "MX",
  "FM",
  "MD",
  "MC",
  "MN",
  "ME",
  "MS",
  "MA",
  "MZ",
  "MM",
  "NA",
  "NR",
  "NP",
  "NL",
  "NC",
  "NZ",
  "NI",
  "NE",
  "NG",
  "NU",
  "NF",
  "MK",
  "MP",
  "NO",
  "OM",
  "PK",
  "PW",
  "PS",
  "PA",
  "PG",
  "PY",
  "PE",
  "PH",
  "PN",
  "PL",
  "PT",
  "PR",
  "QA",
  "RE",
  "RO",
  "RU",
  "RW",
  "BL",
  "SH",
  "KN",
  "LC",
  "MF",
  "PM",
  "VC",
  "WS",
  "SM",
  "ST",
  "SA",
  "SN",
  "RS",
  "SC",
  "SL",
  "SG",
  "SX",
  "SK",
  "SI",
  "SB",
  "SO",
  "ZA",
  "GS",
  "SS",
  "ES",
  "LK",
  "SD",
  "SR",
  "SJ",
  "SE",
  "CH",
  "SY",
  "TW",
  "TJ",
  "TZ",
  "TH",
  "TL",
  "TG",
  "TK",
  "TO",
  "TT",
  "TN",
  "TR",
  "TM",
  "TC",
  "TV",
  "UG",
  "UA",
  "AE",
  "GB",
  "US",
  "UM",
  "UY",
  "UZ",
  "VU",
  "VE",
  "VN",
  "VG",
  "VI",
  "WF",
  "EH",
  "YE",
  "ZM",
  "ZW",
].map((code) => ({ code, fallbackLabel: code }));

const countryDefaultsByTimeZone: Record<string, string> = {
  "Africa/Abidjan": "CI",
  "Africa/Algiers": "DZ",
  "Africa/Bamako": "ML",
  "Africa/Bangui": "CM",
  "Africa/Casablanca": "MA",
  "Africa/Dakar": "SN",
  "Africa/Lagos": "NG",
  "Africa/Lome": "TG",
  "Africa/Ouagadougou": "BF",
  "Africa/Porto-Novo": "BJ",
  "Africa/Tunis": "TN",
  "America/Chicago": "US",
  "America/Los_Angeles": "US",
  "America/New_York": "US",
  "America/Toronto": "CA",
  "Asia/Bangkok": "TH",
  "Asia/Shanghai": "CN",
  "Europe/London": "GB",
  "Europe/Paris": "FR",
};

export function getIntlLocale(locale: SupportedLocale): string {
  return intlLocales[locale];
}

export function normalizeCountryCode(value: string | null | undefined): string {
  const code = value?.trim().toUpperCase().replace(/[^A-Z]/g, "").slice(0, 2);

  return code || "TH";
}

export function getDeviceCountry(): string {
  if (typeof Intl !== "undefined") {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const timeZoneCountry = countryDefaultsByTimeZone[timeZone];

    if (timeZoneCountry) {
      return timeZoneCountry;
    }
  }

  if (typeof navigator !== "undefined") {
    const languages = navigator.languages?.length ? navigator.languages : [navigator.language];

    for (const language of languages) {
      const region = getLocaleRegion(language);

      if (region) {
        return region;
      }
    }
  }

  return "TH";
}

function getLocaleRegion(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  try {
    const locale = new Intl.Locale(value).maximize();

    return locale.region ? normalizeCountryCode(locale.region) : null;
  } catch {
    const region = value.match(/[-_]([A-Za-z]{2})\b/)?.[1];

    return region ? normalizeCountryCode(region) : null;
  }
}

export function getCountryOptions(
  locale: SupportedLocale,
  selectedCountry: string,
): CountryOption[] {
  const selectedCode = normalizeCountryCode(selectedCountry);
  const options = addressCountryOptions.some((option) => option.code === selectedCode)
    ? addressCountryOptions
    : [{ code: selectedCode, fallbackLabel: selectedCode }, ...addressCountryOptions];

  return options
    .map((option) => ({
      ...option,
      fallbackLabel: getCountryLabel(locale, option),
    }))
    .sort((left, right) => left.fallbackLabel.localeCompare(right.fallbackLabel));
}

export function getCountryFlag(countryCode: string): string {
  const code = normalizeCountryCode(countryCode);

  if (code.length !== 2) {
    return "";
  }

  return String.fromCodePoint(
    ...[...code].map((character) => 0x1f1e6 + character.charCodeAt(0) - 65),
  );
}

function getCountryLabel(locale: SupportedLocale, option: CountryOption): string {
  try {
    const displayNames = new Intl.DisplayNames([getIntlLocale(locale)], {
      type: "region",
    });

    return displayNames.of(option.code) ?? option.fallbackLabel;
  } catch {
    return option.fallbackLabel;
  }
}
