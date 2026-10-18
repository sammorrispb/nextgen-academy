/** Freeze Date only inside a test; always restore it in afterEach. */
export function fixedDate(iso: string): () => void {
  const original = globalThis.Date;
  const now = new original(iso).getTime();
  globalThis.Date = new Proxy(original, {
    construct(target, args) { return Reflect.construct(target, args.length ? args : [now]); },
    get(target, property) { return property === "now" ? () => now : Reflect.get(target, property); },
  });
  return () => { globalThis.Date = original; };
}
