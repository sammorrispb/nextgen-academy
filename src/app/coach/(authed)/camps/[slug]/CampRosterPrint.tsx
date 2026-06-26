"use client";

// Print button for the camp roster. window.print() is the whole feature — the
// page itself carries `print:hidden` on nav/chrome so the printed sheet is just
// the roster table.
export default function CampRosterPrint() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="print:hidden inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-ngpa-lime text-ngpa-deep font-bold text-sm hover:brightness-110 transition-all min-h-[40px]"
    >
      Print roster
    </button>
  );
}
