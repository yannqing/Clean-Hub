import { cookies } from "next/headers";

import {
  getWebAdminHtmlLang,
  parseWebAdminLocale,
  webAdminLocaleCookieName,
  type WebAdminLocale,
} from "./locale";

export async function getWebAdminLocaleFromCookies(): Promise<WebAdminLocale> {
  const cookieStore = await cookies();

  return parseWebAdminLocale(cookieStore.get(webAdminLocaleCookieName)?.value);
}

export { getWebAdminHtmlLang };
