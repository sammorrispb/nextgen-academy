import type { Metadata } from "next";
import { Montserrat, Inter } from "next/font/google";
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

export const metadata: Metadata = {
  title: {
    default: "Next Gen Pickleball Academy",
    template: "%s | Next Gen Pickleball Academy",
  },
  description:
    "Structured pickleball coaching for ages 5\u201316. We build confident players through competitive play, real strategy, and a growth mindset.",
  icons: {
    icon: "/favicon.svg",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Next Gen Pickleball Academy",
    title: "Next Gen Pickleball Academy",
    description:
      "Structured pickleball coaching for ages 5\u201316 in Montgomery County, MD. Better than yesterday\u2014together.",
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
        className={`${montserrat.variable} ${inter.variable} antialiased bg-white text-foreground`}
      >
        <Navbar />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
