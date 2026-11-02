export const VERSION = "1.0.0";
export const GATES = ["eventDetails", "format", "registration", "payments", "capacity", "waiver", "privacy", "operations", "mobileQA", "desktopQA"];
export const NATIVE_EVENTS = {
  "november-2026": { revision: "launch-2026-11-02", start: "2026-11-14T10:00:00-05:00", end: "2026-11-14T12:00:00-05:00", closes: "2026-11-13T10:00:00-05:00" },
  "january-2027": { revision: "launch-2026-10-31", start: "2027-01-17T10:00:00-05:00", end: "2027-01-17T13:00:00-05:00", closes: "2027-01-07T10:00:00-05:00" },
  "february-2027": { revision: "launch-2026-10-31", start: "2027-02-14T10:00:00-05:00", end: "2027-02-14T13:00:00-05:00", closes: "2027-02-04T10:00:00-05:00" },
};

export function safeUrl(value, { empty = false } = {}) {
  if (empty && value === "") return true;
  if (typeof value !== "string") return false;
  try {
    const u = new URL(value);
    return u.protocol === "https:" && !u.username && !u.password && !u.port &&
      ![...u.searchParams.keys()].some(k => /token|secret|password|signature|auth|api.?key|vercel_share/i.test(k)) &&
      !/receipt=|cancel=|access_token=/i.test(u.hash);
  } catch { return false; }
}
function text(v, max = 2000) { return typeof v === "string" && v.trim().length > 0 && v.length <= max && !/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(v); }
function integer(v, min, max) { return Number.isSafeInteger(v) && v >= min && v <= max; }
export function zonedInstant(value, timezone) {
  if (typeof value !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d[+-]\d\d:\d\d$/.test(value) || !Number.isFinite(Date.parse(value))) return false;
  try {
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).formatToParts(new Date(value)).map(p => [p.type, p.value]));
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}` === value.slice(0, 19);
  } catch { return false; }
}
export function validate(config, now = Date.now()) {
  const errors = [], warnings = [];
  const error = (field, message) => errors.push({ field, message });
  if (!config || typeof config !== "object" || Array.isArray(config)) return { errors: [{ field: "config", message: "Expected a tournament object" }], warnings };
  const c = config, r = c.registration ?? {}, f = c.format ?? {}, p = c.payments ?? {}, o = c.operations ?? {};
  const wire = JSON.stringify(c);
  if (/(?:sk|rk)_(?:live|test)_[A-Za-z0-9]|whsec_[A-Za-z0-9]|Bearer\s+[A-Za-z0-9]/.test(wire)) error("config", "Remove credentials; this package stores configuration and evidence references only");
  const inspectKeys = value => {
    if (!value || typeof value !== "object") return;
    for (const [key, child] of Object.entries(value)) {
      if (/^(?:password|secret|token|apiKey|privateKey|serviceRoleKey)$/i.test(key)) error("config", "Credential fields are not allowed");
      inspectKeys(child);
    }
  }; inspectKeys(c);
  if (c.schemaVersion !== 1) error("schemaVersion", "Use schemaVersion 1");
  if (!/^[a-z][a-z0-9-]{2,79}$/.test(c.slug ?? "")) error("slug", "Use a unique lowercase event slug (3–80 characters)");
  for (const field of ["title", "timezone", "publicUrl"]) if (!text(c[field])) error(field, "Enter a value");
  if (!safeUrl(c.publicUrl)) error("publicUrl", "Use a public HTTPS event URL without credentials");
  if (!["junior", "adult"].includes(c.audience)) error("audience", "Choose junior or adult");
  try { new Intl.DateTimeFormat("en-US", { timeZone: c.timezone }); } catch { error("timezone", "Use a valid IANA timezone"); }
  if (!zonedInstant(c.startAt, c.timezone)) error("startAt", "Enter a real date/time with the correct explicit offset for the event timezone");
  if (!zonedInstant(c.endAt, c.timezone) || Date.parse(c.endAt) <= Date.parse(c.startAt)) error("endAt", "End must follow start and use the event timezone offset");
  for (const field of ["name", "address"]) if (!text(c.venue?.[field], 400)) error(`venue.${field}`, "Enter the confirmed venue detail");
  if (typeof c.venue?.indoors !== "boolean") error("venue.indoors", "Choose indoor or outdoor");
  if (!text(c.brand?.name, 100) || !/^#[0-9a-f]{6}$/i.test(c.brand?.accent ?? "")) error("brand", "Enter a brand name and six-digit hex accent");
  if (!text(c.contact?.name, 100) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.contact?.email ?? "") || !text(c.contact?.phone, 40)) error("contact", "Enter the public organizer contact");
  if (!Array.isArray(c.divisions) || !c.divisions.length || c.divisions.length > 20) error("divisions", "Provide 1–20 divisions");
  const divisionIds = new Set();
  for (const [i, d] of (Array.isArray(c.divisions) ? c.divisions : []).entries()) {
    if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(d.id ?? "") || divisionIds.has(d.id)) error(`divisions.${i}.id`, "Use distinct division IDs");
    divisionIds.add(d.id);
    if (!text(d.label, 100) || !text(d.eligibility, 800) || !integer(d.capacity, 1, 500)) error(`divisions.${i}`, "Enter a label, eligibility and capacity");
  }
  if (!["draft", "open", "closed"].includes(r.state)) error("registration.state", "Choose draft, open or closed");
  if (!["external", "nga-series"].includes(r.provider)) error("registration.provider", "Choose external or nga-series");
  if (!safeUrl(r.url, { empty: r.state !== "open" })) error("registration.url", "Enter the registration provider's public HTTPS URL");
  if (!zonedInstant(r.closesAt, c.timezone) || Date.parse(r.closesAt) >= Date.parse(c.startAt)) error("registration.closesAt", "Registration must close before the event, using the correct timezone offset");
  if (r.state === "open" && Date.parse(r.closesAt) <= now) error("registration.state", "The registration deadline has passed");
  if (r.state === "open" && /\b(?:TBD|to be confirmed|replace|edit this|before opening|illustrative|example configuration|choose the|your confirmed|name the|write and approve|set the verified|publish the game count|verify event-day coverage)\b/i.test(JSON.stringify([c.title, c.venue, f, c.policies, p.owner, o.director]))) error("readiness", "Resolve placeholders in the event details, format and policies before opening");
  if (!["optional", "required", "hidden"].includes(r.homeAddress)) error("registration.homeAddress", "Choose optional, required or hidden");
  if (!Array.isArray(r.fees) || !r.fees.length) error("registration.fees", "Provide the fee options in integer cents");
  const feeIds = new Set();
  for (const [i, fee] of (Array.isArray(r.fees) ? r.fees : []).entries()) {
    if (!text(fee.id, 60) || feeIds.has(fee.id) || !text(fee.label, 100) || !integer(fee.amountCents, 0, 10000000)) error(`registration.fees.${i}`, "Use distinct fee IDs, labels and nonnegative integer cents");
    feeIds.add(fee.id);
  }
  if (!text(f.label, 100) || !["individual", "pair", "team"].includes(f.entryUnit) || !text(f.description) || !text(f.gamesDescription)) error("format", "Describe the format, entry unit and game count without assuming a field size");
  for (const phase of ["roundRobin", "medals"]) if (!integer(f[phase]?.target, 1, 100) || !integer(f[phase]?.winBy, 1, 10) || !text(f[phase]?.scoring, 100)) error(`format.${phase}`, "Specify target score, win-by margin and scoring method");
  for (const field of ["tiebreakers", "medalRules", "turnoutRules"]) if (!Array.isArray(f[field]) || !f[field].length || f[field].some(v => !text(v))) error(`format.${field}`, "Provide the actual rules in order");
  if (!safeUrl(f.source)) error("format.source", "Link to the format source; the link stays in the private operations pack");
  for (const field of ["refund", "weather", "minimumEnrollment", "waiver"]) if (!text(c.policies?.[field])) error(`policies.${field}`, "Write the event policy explicitly");
  if (!text(p.owner, 200) || !text(p.reconciliation, 1500)) error("payments", "Name the payment owner and reconciliation procedure");
  if (!text(o.director, 100) || !integer(o.courts, 1, 100) || !integer(o.checkinMinutes, 0, 180)) error("operations", "Name the director, court count and check-in lead time");
  for (const field of ["scoringUrl", "privateRosterUrl"]) if (!safeUrl(o[field], { empty: true })) error(`operations.${field}`, "Use HTTPS without private access tokens");
  if (r.provider === "nga-series") {
    const installed = NATIVE_EVENTS[r.native?.event];
    if (!installed) error("registration.native.event", "This adapter is installed only for the three MVF events. A new native event needs the bundled integration procedure; otherwise select an external provider");
    else {
      if (r.native.revision !== installed.revision || c.startAt !== installed.start || c.endAt !== installed.end || r.closesAt !== installed.closes) error("registration.native", "The installed event revision and schedule must match the existing server release");
      const base = `https://nextgenpbacademy.com/mvf-junior-tournament/${r.native.event}`;
      if (c.publicUrl !== base || r.url !== `${base}#register`) error("publicUrl", "The native form must be served on its installed NGA event origin/path");
    }
    if (c.audience !== "junior" || f.entryUnit !== "individual" || r.homeAddress !== "optional" || JSON.stringify((c.divisions ?? []).map(d => [d.id, d.capacity])) !== JSON.stringify([["12u", 10], ["16u", 10]]) || JSON.stringify((r.fees ?? []).map(v => [v.id, v.amountCents])) !== JSON.stringify([["resident", 5000], ["nonresident", 6000]])) error("registration.native", "The current native adapter requires junior 12U/16U, ten seats per division, optional address and the installed $50/$60 fees");
  }
  for (const gate of GATES) {
    const proof = c.readiness?.[gate];
    const verified = proof?.status === "verified" && text(proof.evidence, 1000) && Number.isFinite(Date.parse(proof.verifiedAt)) && Date.parse(proof.verifiedAt) <= now;
    if (!verified) {
      const issue = { field: `readiness.${gate}`, message: "Record a dated verification and evidence for this tournament" };
      (r.state === "open" ? errors : warnings).push(issue);
    }
  }
  if (r.state !== "open") warnings.push({ field: "registration.state", message: "The generated package will not accept registrations" });
  return { errors, warnings };
}

export function cloneConfig(source, slug) {
  const c = structuredClone(source);
  c.slug = slug; c.title = "New tournament — edit this title";
  c.publicUrl = "https://example.invalid/replace-event-url";
  c.startAt = ""; c.endAt = ""; c.venue = { name: "", address: "", indoors: false };
  c.registration.state = "draft"; c.registration.provider = "external"; c.registration.url = ""; c.registration.closesAt = ""; delete c.registration.native;
  c.operations.director = ""; c.operations.privateRosterUrl = ""; c.operations.scoringUrl = "";
  c.operations.courts = 0;
  c.divisions = c.divisions.map(d => ({ ...d, eligibility: "" }));
  c.policies = Object.fromEntries(Object.keys(c.policies).map(key => [key, ""]));
  c.payments.owner = ""; c.payments.reconciliation = "";
  c.readiness = Object.fromEntries(GATES.map(gate => [gate, { status: "pending", evidence: "", verifiedAt: "" }]));
  return c;
}
export function publicEvent(c) {
  return {
    schemaVersion: 1, id: c.slug, title: c.title, audience: c.audience, timezone: c.timezone,
    startAt: c.startAt, endAt: c.endAt, venue: { name: c.venue.name, address: c.venue.address, indoors: c.venue.indoors }, url: c.publicUrl,
    contact: { name: c.contact.name, email: c.contact.email, phone: c.contact.phone },
    divisions: c.divisions.map(d => ({ id: d.id, label: d.label, eligibility: d.eligibility, capacity: d.capacity })),
    format: { ...Object.fromEntries(["label", "entryUnit", "description", "gamesDescription", "tiebreakers", "medalRules", "turnoutRules"].map(key => [key, c.format[key]])), ...Object.fromEntries(["roundRobin", "medals"].map(key => [key, { target: c.format[key].target, winBy: c.format[key].winBy, scoring: c.format[key].scoring }])) },
    policies: Object.fromEntries(["refund", "weather", "minimumEnrollment", "waiver"].map(key => [key, c.policies[key]])),
    registration: { configuredState: c.registration.state, closesAt: c.registration.closesAt, fees: c.registration.fees.map(f => ({ id: f.id, label: f.label, amountCents: f.amountCents })), provider: c.registration.provider,
      nextAction: c.registration.state === "open" ? { type: "register", url: c.registration.url, validUntil: c.registration.closesAt } : { type: "check-opening-updates", url: c.publicUrl } },
  };
}
export const money = cents => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
export const when = (value, timezone) => new Intl.DateTimeFormat("en-US", { timeZone: timezone, dateStyle: "full", timeStyle: "short" }).format(new Date(value));
