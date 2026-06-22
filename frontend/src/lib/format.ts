// Locale-aware formatting helpers.
// Prices are stored as integer minor units (cents); we divide by 100 for display.

const LOCALE_TAGS: Record<string, string> = {
  en: "en-US",
  es: "es-ES",
  pt: "pt-BR",
};

/** Map an app locale (en|es|pt) to a BCP-47 tag for Intl. */
export function intlLocale(locale: string | undefined): string {
  if (!locale) return "en-US";
  return LOCALE_TAGS[locale] ?? locale;
}

/**
 * Format integer minor units (cents) + ISO currency code into a localized
 * currency string. Falls back gracefully if the currency code is unknown.
 */
export function formatCurrency(
  cents: number,
  currency: string,
  locale: string = "en",
): string {
  const amount = (cents ?? 0) / 100;
  try {
    return new Intl.NumberFormat(intlLocale(locale), {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    // Unknown currency code: render the number + the raw code.
    const n = new Intl.NumberFormat(intlLocale(locale), {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
    return `${currency} ${n}`;
  }
}

/** Format a plain number with locale grouping. */
export function formatNumber(
  value: number,
  locale: string = "en",
  opts?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat(intlLocale(locale), opts).format(value ?? 0);
}

/** Format a 0-1 score as a percentage (e.g. 0.82 -> "82%"). */
export function formatScore(score: number, locale: string = "en"): string {
  return new Intl.NumberFormat(intlLocale(locale), {
    style: "percent",
    maximumFractionDigits: 0,
  }).format(Math.max(0, Math.min(1, score ?? 0)));
}

/** Format an exchange rate with sensible precision. */
export function formatRate(rate: number, locale: string = "en"): string {
  return new Intl.NumberFormat(intlLocale(locale), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(rate ?? 0);
}

function toDate(value: string | number | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

/** Format a date as a medium localized date (e.g. "Jun 22, 2026"). */
export function formatDate(
  value: string | number | Date,
  locale: string = "en",
): string {
  const d = toDate(value);
  if (isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(intlLocale(locale), {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(d);
}

/** Format a date + time. */
export function formatDateTime(
  value: string | number | Date,
  locale: string = "en",
): string {
  const d = toDate(value);
  if (isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(intlLocale(locale), {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

const DIVISIONS: { amount: number; unit: Intl.RelativeTimeFormatUnit }[] = [
  { amount: 60, unit: "second" },
  { amount: 60, unit: "minute" },
  { amount: 24, unit: "hour" },
  { amount: 7, unit: "day" },
  { amount: 4.34524, unit: "week" },
  { amount: 12, unit: "month" },
  { amount: Number.POSITIVE_INFINITY, unit: "year" },
];

/** Format a relative time (e.g. "3 days ago"). */
export function formatRelativeTime(
  value: string | number | Date,
  locale: string = "en",
): string {
  const d = toDate(value);
  if (isNaN(d.getTime())) return "";
  const rtf = new Intl.RelativeTimeFormat(intlLocale(locale), {
    numeric: "auto",
  });
  let duration = (d.getTime() - Date.now()) / 1000;
  for (const division of DIVISIONS) {
    if (Math.abs(duration) < division.amount) {
      return rtf.format(Math.round(duration), division.unit);
    }
    duration /= division.amount;
  }
  return formatDate(d, locale);
}
