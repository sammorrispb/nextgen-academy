import type { Metadata } from "next";
import { Montserrat, Inter, Roboto_Mono } from "next/font/google";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import StickyMobileCTA from "@/components/StickyMobileCTA";
import JsonLd from "@/components/JsonLd";
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
      "Youth pickleball academy for kids ages 6\u201316 in Montgomery County, MD. Real coaching for kids who can rally \u2014 and private lessons for any 6+ still learning.",
    url: "https://nextgenpbacademy.com",
    images: [{
      url: "/images/og-image.png",
      width: 512,
      height: 512,
      alt: "Next Gen Pickleball Academy",
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Next Gen Pickleball Academy",
    description:
      "Youth pickleball lessons for kids ages 6\u201316 in Montgomery County, MD. Small groups for rally-ready kids; privates for pre-rally players.",
    images: ["/images/og-image.png"],
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
        <JsonLd data={{
          "@context": "https://schema.org",
          "@type": "SportsActivityLocation",
          name: "Next Gen Pickleball Academy",
          description: "Structured youth pickleball coaching for kids ages 6\u201316 in Montgomery County, MD.",
          url: "https://nextgenpbacademy.com",
          telephone: "301-325-4731",
          email: "nextgenacademypb@gmail.com",
          address: {
            "@type": "PostalAddress",
            addressLocality: "Montgomery County",
            addressRegion: "MD",
            addressCountry: "US",
          },
          sameAs: [
            "https://www.instagram.com/nextgenpickleballacademy",
            "https://www.sammorrispb.com",
            "https://www.linkanddink.com",
          ],
          areaServed: [
            { "@type": "AdministrativeArea", name: "Montgomery County, MD" },
            { "@type": "City", name: "Bethesda" },
            { "@type": "City", name: "Rockville" },
            { "@type": "City", name: "Potomac" },
            { "@type": "City", name: "Gaithersburg" },
            { "@type": "City", name: "Chevy Chase" },
            { "@type": "City", name: "Olney" },
            { "@type": "City", name: "Silver Spring" },
          ],
          founder: [
            { "@type": "Person", name: "Sam Morris" },
            { "@type": "Person", name: "Amine Belkadi" },
          ],
        }} />
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
