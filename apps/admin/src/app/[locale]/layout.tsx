import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { Providers } from "@/components/providers";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: { template: "%s | Dash Meal Admin", default: "Dash Meal Admin" },
  description: "Panneau d'administration Dash Meal — La plateforme de livraison de repas CEMAC",
  keywords: ["dash meal", "restaurant", "livraison", "admin", "CEMAC"],
};

async function getMessages(locale: string) {
  try {
    return (await import(`../../../messages/${locale}.json`)).default;
  } catch {
    throw new Error(`Locale ${locale} is not supported`);
  }
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!routing.locales.includes(locale as "fr" | "en")) notFound();

  const messages = await getMessages(locale);
  const now = new Date();
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-surface-950 text-slate-900 antialiased">
        <NextIntlClientProvider messages={messages} locale={locale} now={now} timeZone={timeZone}>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
