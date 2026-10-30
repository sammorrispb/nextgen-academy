import type { Metadata } from "next";
import { notFound } from "next/navigation";
import MvfSeriesReceipt from "@/components/MvfSeriesReceipt";
import { findMvfJuniorSeriesEvent } from "@/data/mvf-junior-series";
export const metadata: Metadata = { title: { absolute: "MVF tournament invoice status" }, robots: { index: false, follow: false }, referrer: "no-referrer" };
export default async function Page({ params }: { params: Promise<{ event: string }> }) {
  const { event } = await params;
  if (!findMvfJuniorSeriesEvent(event)) notFound();
  return <article className="max-w-2xl mx-auto px-5 py-16"><h1 className="font-heading text-3xl font-bold">Tournament invoice status</h1><MvfSeriesReceipt event={event} /></article>;
}
