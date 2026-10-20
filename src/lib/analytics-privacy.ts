// A standings URL is a credential. Drop the event rather than retain a copy
// in telemetry, including when a caller puts the URL in a nested property.
export function containsStandingsCapability(value: unknown): boolean {
  if (typeof value !== "string") return false;
  let decoded = value;
  for (let i = 0; i < 3; i++) {
    if (/\/(?:fall\/)?standings(?:\/|$|[?#])/i.test(decoded)) return true;
    // Decode ASCII escapes independently: an unrelated malformed UTF-8 or
    // percent escape must not hide an encoded slash in the capability path.
    const next = decoded.replace(/%([0-7][0-9a-f])/gi, (_match, hex: string) =>
      String.fromCharCode(Number.parseInt(hex, 16)));
    if (next === decoded) return false;
    decoded = next;
  }
  // Unknown additional encoding is refused rather than copied upstream.
  return /\/(?:fall\/)?standings(?:\/|$|[?#])/i.test(decoded) || /%[0-7][0-9a-f]/i.test(decoded);
}

export function analyticsPayloadHasCapability(value: unknown): boolean {
  const pending: unknown[] = [value];
  const seen = new Set<object>();
  let inspected = 0;
  try {
    while (pending.length > 0) {
      if (++inspected > 10000) return true;
      const item = pending.pop();
      if (containsStandingsCapability(item)) return true;
      if (item && typeof item === "object" && !seen.has(item)) {
        seen.add(item);
        for (const [key, value] of Object.entries(item)) pending.push(key, value);
      }
    }
  } catch {
    return true;
  }
  return false;
}
