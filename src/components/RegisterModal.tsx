"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface RegisterModalProps {
  embedCode: string;
  fallbackUrl: string;
  levelLabel: string;
  levelColor: string;
  onClose: () => void;
}

export default function RegisterModal({
  embedCode,
  fallbackUrl,
  levelLabel,
  levelColor,
  onClose,
}: RegisterModalProps) {
  const [iframeHeight, setIframeHeight] = useState(400);
  const backdropRef = useRef<HTMLDivElement>(null);

  // Listen for CourtReserve postMessage to auto-size iframe
  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      if (e.origin !== "https://app.courtreserve.com") return;
      try {
        const data = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
        if (data.action === "setHeight" && typeof data.height === "number") {
          setIframeHeight(data.height);
        }
      } catch {
        // ignore non-JSON messages
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // Escape key + body scroll lock
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === backdropRef.current) onClose();
  }

  return createPortal(
    <div
      ref={backdropRef}
      onClick={handleBackdropClick}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 pt-12 sm:pt-20"
    >
      <div className="w-full max-w-2xl rounded-2xl bg-ngpa-navy border border-ngpa-slate shadow-lg">
        {/* Header */}
        <div
          className="flex items-center justify-between rounded-t-2xl px-5 py-3"
          style={{ borderBottom: `2px solid ${levelColor}` }}
        >
          <h2 className="font-heading text-lg font-bold text-ngpa-white">
            Register — {levelLabel}
          </h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-ngpa-muted transition-colors hover:bg-ngpa-slate hover:text-ngpa-white"
            aria-label="Close registration"
          >
            ✕
          </button>
        </div>

        {/* Iframe */}
        <div className="p-1">
          <iframe
            src={embedCode}
            title={`Register for ${levelLabel}`}
            className="w-full rounded-b-xl border-0"
            style={{ minHeight: 400, height: iframeHeight }}
            allow="payment"
          />
        </div>

        {/* Fallback link */}
        <div className="px-5 py-3 text-center">
          <a
            href={fallbackUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-ngpa-muted underline hover:text-ngpa-cyan"
          >
            Open in CourtReserve ↗
          </a>
        </div>
      </div>
    </div>,
    document.body
  );
}
