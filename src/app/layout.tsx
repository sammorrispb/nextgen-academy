import type { Metadata } from "next";
import { Montserrat, Inter, Roboto_Mono } from "next/font/google";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import StickyMobileCTA from "@/components/StickyMobileCTA";
import JsonLd from "@/components/JsonLd";
import { organizationJsonLd } from "@/lib/seo";
import PageViewTracker from "@/components/PageViewTracker";
import UtmCapture from "@/components/UtmCapture";
import "./globals.css";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["400", "600", "700", "800", "900"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const robotoMono = Roboto_Mono({
  variable: "--font-roboto-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://nextgenpbacademy.com"),
  title: {
    // ≤60 chars so Google doesn't truncate. Per-page `title` overrides this
    // via the template — those pages use `{ absolute }` when their copy
    // would exceed the budget.
    default: "Next Gen PB Academy — Youth Pickleball in MoCo, MD",
    template: "%s | Next Gen Pickleball Academy",
  },
  description:
    "Youth pickleball coaching for kids ages 6\u201316 in Montgomery County, MD. Free evaluations, group sessions, and private lessons with a clear pathway.",
  icons: {
    icon: "/images/og-image.png",
    apple: "/images/og-image.png",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Next Gen Pickleball Academy",
    title: "Next Gen Pickleball Academy",
    description:
      "Youth pickleball academy for kids ages 6\u201316 in Montgomery County, MD. Group sessions run a court for every level \u2014 Red, Orange, Green, Yellow \u2014 plus private lessons.",
    url: "https://nextgenpbacademy.com",
    images: [{
      url: "/opengraph-image",
      width: 1200,
      height: 630,
      alt: "Next Gen Pickleball Academy",
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Next Gen Pickleball Academy",
    description:
      "Youth pickleball lessons for kids ages 6\u201316 in Montgomery County, MD. A group court for every level, plus private lessons at any level.",
    images: ["/opengraph-image"],
  },
  verification: {
    google: "Ty8UVMg8N631eo1CfPQKrtauyqq8HCFzC6GvOBZnCcI",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${montserrat.variable} ${inter.variable} ${robotoMono.variable} antialiased bg-ngpa-navy text-ngpa-white`}
      >
        {/* The one organization node — every other JSON-LD node references it
            by @id (see organizationJsonLd in lib/seo.ts). */}
        <JsonLd data={organizationJsonLd()} />
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-ngpa-lime focus:text-ngpa-black focus:font-bold focus:rounded-lg"
        >
          Skip to content
        </a>
        <Navbar />
        <main id="main" className="pb-16 md:pb-0">{children}</main>
        <Footer />
        <StickyMobileCTA />
        <UtmCapture />
        <PageViewTracker />
      </body>
    </html>
  );
}
