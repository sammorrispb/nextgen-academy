"use client";

import { useState } from "react";

export default function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          window.prompt("Copy this link", url);
        }
      }}
      className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-ngpa-teal text-ngpa-deep font-bold text-xs hover:bg-ngpa-teal-bright transition-colors min-h-[36px]"
    >
      {copied ? "Copied ✓" : "Copy parent link"}
    </button>
  );
}
