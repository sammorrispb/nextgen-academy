import type { Metadata } from "next";
import { Montserrat, Inter, Roboto_Mono } from "next/font/google";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import JsonLd from "@/components/JsonLd";
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
    default: "Next Gen PB Academy | Youth Pickleball in Montgomery County, MD",
    template: "%s | Next Gen Pickleball Academy",
  },
  description:
    "Youth pickleball for ages 5\u201316 at Dill Dinkers Rockville & North Bethesda. Structured coaching, small groups, beginner to tournament in Montgomery County.",
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
      "Youth pickleball academy for ages 5\u201316 at Dill Dinkers in Rockville & North Bethesda, MD. Structured coaching with a clear pathway from beginner to tournament play.",
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
    description: "Youth pickleball lessons for ages 5\u201316 at Dill Dinkers in Montgomery County, MD. Small groups, real strategy, tournament pathway.",
    images: ["/images/og-image.png"],
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
          description: "Structured youth pickleball coaching for ages 5\u201316 in Montgomery County, MD.",
          url: "https://nextgenpbacademy.com",
          telephone: "301-325-4731",
          email: "nextgenacademypb@gmail.com",
          sameAs: ["https://www.instagram.com/nextgenpickleballacademy"],
          areaServed: {
            "@type": "AdministrativeArea",
            name: "Montgomery County, MD",
          },
          founder: [
            { "@type": "Person", name: "Sam Morris" },
            { "@type": "Person", name: "Amine Belkadi" },
          ],
          location: [
            {
              "@type": "Place",
              name: "Dill Dinkers Rockville",
              address: {
                "@type": "PostalAddress",
                streetAddress: "40 Southlawn Court, Suite C",
                addressLocality: "Rockville",
                addressRegion: "MD",
                postalCode: "20850",
                addressCountry: "US",
              },
            },
            {
              "@type": "Place",
              name: "Dill Dinkers North Bethesda",
              address: {
                "@type": "PostalAddress",
                streetAddress: "4942 Boiling Brook Parkway",
                addressLocality: "North Bethesda",
                addressRegion: "MD",
                postalCode: "20852",
                addressCountry: "US",
              },
            },
          ],
        }} />
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:bg-ngpa-lime focus:text-ngpa-black focus:font-bold focus:rounded-lg"
        >
          Skip to content
        </a>
        <Navbar />
        <main id="main">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
