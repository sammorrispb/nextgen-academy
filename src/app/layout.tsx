import type { Metadata } from "next";
import { Montserrat, Inter, Roboto_Mono } from "next/font/google";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
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
  title: {
    default: "Next Gen Pickleball Academy",
    template: "%s | Next Gen Pickleball Academy",
  },
  description:
    "Structured pickleball coaching for ages 5\u201316. We build confident players through competitive play, real strategy, and a growth mindset.",
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
      "Structured pickleball coaching for ages 5\u201316 in Montgomery County, MD. Better than yesterday\u2014together.",
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
    description: "Structured pickleball coaching for ages 5\u201316 in Montgomery County, MD.",
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
