import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { Providers } from "@/components/providers";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: { template: "%s | Dash Meal", default: "Dash Meal" },
  description: "Plateforme Dash Meal — gestion livraisons, commandes et livreurs CEMAC",
  keywords: ["dash meal", "restaurant", "livraison", "admin", "CEMAC", "livreur"],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Dash Meal",
    startupImage: ["/icons/icon-512.png"],
  },
  formatDetection: { telephone: false },
  other: {
    "mobile-web-app-capable": "yes",
    "msapplication-TileColor": "#f97316",
    "msapplication-TileImage": "/icons/icon-144.png",
    "msapplication-config": "none",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f97316" },
    { media: "(prefers-color-scheme: dark)", color: "#f97316" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
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
        <link rel="icon" href="/icons/icon-192.png" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <link rel="apple-touch-icon" sizes="152x152" href="/icons/icon-152.png" />
        <link rel="apple-touch-icon" sizes="512x512" href="/icons/icon-512.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className="bg-surface-950 text-slate-900 antialiased">
        <NextIntlClientProvider messages={messages} locale={locale} now={now} timeZone={timeZone}>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
