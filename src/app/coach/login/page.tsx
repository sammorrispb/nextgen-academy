import type { Metadata } from "next";
import LoginForm from "./LoginForm";

export const metadata: Metadata = {
  title: "Coach sign-in · NGA",
  robots: { index: false, follow: false },
};

interface PageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function CoachLoginPage({ searchParams }: PageProps) {
  const { error } = await searchParams;
  return (
    <main className="min-h-screen bg-ngpa-deep flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        <p className="text-xs font-bold tracking-[0.2em] uppercase text-ngpa-teal mb-3">
          Coach Dashboard
        </p>
        <h1 className="font-heading text-3xl sm:text-4xl font-black text-ngpa-white tracking-tight mb-2">
          Sign in
        </h1>
        <p className="text-base text-ngpa-white/70 leading-relaxed mb-8">
          Enter the email associated with your coach access. We&rsquo;ll send a
          one-time sign-in link.
        </p>
        {error === "expired" && (
          <div
            role="alert"
            className="mb-6 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/40 text-sm text-red-300"
          >
            That sign-in link expired or wasn&rsquo;t valid. Request a new one
            below.
          </div>
        )}
        <LoginForm />
      </div>
    </main>
  );
}
