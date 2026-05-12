"use client";

import { useState } from "react";

interface Props {
  url: string;
  title?: string;
  text?: string;
  label?: string;
  className?: string;
}

export default function ShareButton({
  url,
  title,
  text,
  label = "Share",
  className,
}: Props) {
  const [copied, setCopied] = useState(false);

  async function onShare() {
    const data: ShareData = { url };
    if (title) data.title = title;
    if (text) data.text = text;

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share(data);
        return;
      } catch {
        // User canceled or share failed — fall through to clipboard.
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Last-resort fallback: prompt with the URL.
      window.prompt("Copy this link:", url);
    }
  }

  return (
    <button
      type="button"
      onClick={onShare}
      aria-label="Share this session"
      className={
        className ??
        "inline-flex items-center gap-1.5 px-3 py-2 rounded-full border border-ngpa-slate/60 text-ngpa-white/80 text-xs font-bold hover:border-ngpa-teal hover:text-ngpa-teal transition-colors min-h-[36px]"
      }
    >
      <svg
        className="w-3.5 h-3.5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
        />
      </svg>
      {copied ? "Link copied" : label}
    </button>
  );
}
