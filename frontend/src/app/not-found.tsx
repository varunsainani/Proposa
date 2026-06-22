import Link from "next/link";
import { getTranslations } from "next-intl/server";

export default async function NotFound() {
  const t = await getTranslations("common");
  return (
    <div className="bg-paper flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <p className="font-serif text-6xl text-[var(--primary)]">404</p>
      <h1 className="mt-4 font-serif text-2xl text-fg">{t("notFoundTitle")}</h1>
      <p className="mt-2 max-w-sm text-muted">{t("notFoundBody")}</p>
      <Link
        href="/"
        className="mt-6 inline-flex h-10 items-center rounded-md bg-[var(--primary)] px-5 text-sm font-medium text-white hover:bg-[var(--primary-strong)] focus-ring"
      >
        {t("goHome")}
      </Link>
    </div>
  );
}
