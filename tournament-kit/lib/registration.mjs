// Served unchanged to the browser; no storage, analytics or payment SDK.
export function createRegistrationClient(config, fetcher = fetch, mint = () => crypto.randomUUID()) {
  if (!["november-2026", "january-2027", "february-2027"].includes(config.event) || config.apiPath !== `/api/mvf-series/${config.event}/register`) throw new Error("Unrecognized native registration contract");
  const attempts = new Map();
  return async function register(fields) {
    if (config.state !== "open" || !Number.isFinite(Date.parse(config.closesAt)) || Date.now() >= Date.parse(config.closesAt)) return { code: "registration_closed" };
    const snapshot = JSON.stringify(fields);
    if (!attempts.has(snapshot)) attempts.set(snapshot, mint());
    const body = { ...fields, revision: config.revision, submissionId: attempts.get(snapshot) };
    const response = await fetcher(config.apiPath, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), redirect: "error" });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) return { code: result.code ?? "verification_required", errors: result.errors };
    const prefix = `/mvf-junior-tournament/${config.event}/status#receipt=`;
    if (typeof result.receiptUrl !== "string" || !result.receiptUrl.startsWith(prefix) || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(result.receiptUrl.slice(prefix.length))) return { code: "verification_required" };
    return { receiptUrl: result.receiptUrl };
  };
}

if (typeof document !== "undefined") {
  const form = document.querySelector("#native-form");
  if (form) {
    const config = await fetch("./native-registration.json", { cache: "no-store" }).then(r => r.json());
    const submit = form.querySelector('button[type="submit"]'), status = document.querySelector("#form-status");
    const register = createRegistrationClient(config);
    let sending = false;
    form.addEventListener("submit", async event => {
      event.preventDefault(); if (sending || !form.reportValidity()) return;
      sending = true; submit.disabled = true; status.replaceChildren();
      const raw = Object.fromEntries(new FormData(form));
      const fields = {
        division: raw.division, resident: raw.fee === "resident", parentName: raw.parentName, email: raw.email, phone: raw.phone,
        homeAddress: raw.homeAddress ?? "", childFirstName: raw.childFirstName, childLastName: raw.childLastName, childDob: raw.childDob,
        emergencyName: raw.emergencyName, emergencyPhone: raw.emergencyPhone, allergies: raw.allergies ?? "",
        smsConsent: raw.smsConsent === "on", policyAccepted: raw.policyAccepted === "on",
      };
      try {
        const result = await register(fields);
        if (result.receiptUrl) { window.location.assign(result.receiptUrl); return; }
        const messages = { waiver_required: "Please sign the one-time waiver, then return here and submit these same details.", full: "This division is full. Contact the organizer; no place is confirmed.", duplicate: "This player already has an entry. Check your invoice email before trying again.", request_conflict: "This attempt needs review. Check your invoice email and contact the organizer.", registration_closed: "Registration is closed." };
        status.textContent = messages[result.code] ?? "We could not verify your registration. Retry these same details and check your invoice email before starting again.";
        if (result.errors && typeof result.errors === "object") for (const value of Object.values(result.errors)) {
          const p = document.createElement("p"); p.textContent = String(value); status.append(p);
        }
        if (result.code === "waiver_required") {
          const link = document.createElement("a"); link.href = `/waiver/sign?next=${encodeURIComponent(window.location.pathname)}`;
          link.target = "_blank"; link.rel = "noopener"; link.textContent = "Open the waiver"; status.append(link);
        }
      } catch { status.textContent = "The connection dropped. Retry these same details; check your invoice email before creating another entry."; }
      finally { sending = false; submit.disabled = false; }
    });
  }
  const checkDeadline = () => {
    const region = document.querySelector("#registration");
    if (region?.dataset.closes && Date.now() >= Date.parse(region.dataset.closes)) {
      for (const node of region.querySelectorAll("input,select,textarea,button")) node.disabled = true;
      region.querySelector(".registration-action")?.remove();
      const status = region.querySelector(".registration-status"); if (status) status.textContent = "Registration is closed.";
      for (const link of document.querySelectorAll("[data-register-jump]")) link.textContent = "Registration closed";
    }
  };
  checkDeadline(); setInterval(checkDeadline, 15000);
}
