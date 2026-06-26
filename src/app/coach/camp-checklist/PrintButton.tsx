"use client";

// Interactive island on an otherwise-static server-rendered page, so the page
// itself can keep its `metadata` export. Hidden in print output.
export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="print:hidden inline-flex items-center justify-center min-h-[48px] px-5 py-2 rounded-full border border-ngpa-slate/60 text-sm font-bold text-ngpa-white hover:border-ngpa-teal hover:text-ngpa-teal transition-colors"
    >
      Print checklist
    </button>
  );
}
