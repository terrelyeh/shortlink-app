import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";

/**
 * Locale layout — wraps localised pages with NextIntlClientProvider so
 * client components can call useTranslations(). The <html>/<body> shell
 * lives in the root layout (src/app/layout.tsx) because Next.js only
 * allows one per render tree.
 */
export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as typeof routing.locales[number])) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>
  );
}
