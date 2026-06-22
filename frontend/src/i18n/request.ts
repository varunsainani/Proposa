import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";
import { defaultLocale, LOCALE_COOKIE, locales, type Locale } from "./config";

function pickLocale(cookieVal: string | undefined, acceptLang: string | null): Locale {
  if (cookieVal && (locales as readonly string[]).includes(cookieVal)) {
    return cookieVal as Locale;
  }
  if (acceptLang) {
    for (const part of acceptLang.split(",")) {
      const code = part.trim().slice(0, 2).toLowerCase();
      if ((locales as readonly string[]).includes(code)) return code as Locale;
    }
  }
  return defaultLocale;
}

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const locale = pickLocale(
    cookieStore.get(LOCALE_COOKIE)?.value,
    headerStore.get("accept-language"),
  );
  const messages = (await import(`../messages/${locale}.json`)).default;
  return { locale, messages };
});
