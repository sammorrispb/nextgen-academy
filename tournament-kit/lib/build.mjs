import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { validate, publicEvent, VERSION } from "./config.mjs";
import { renderPage, playerGuide, operationFiles, css } from "./render.mjs";
import { zip } from "./zip.mjs";
const kitRoot = fileURLToPath(new URL("../", import.meta.url));
export const hash = bytes => createHash("sha256").update(bytes).digest("hex");
export async function walk(root, prefix = "", ignore = new Set()) {
  const result = [];
  for (const entry of (await fs.readdir(root, { withFileTypes: true })).toSorted((a, b) => a.name.localeCompare(b.name))) {
    if (ignore.has(entry.name)) continue;
    if (entry.isSymbolicLink()) throw new Error("Symbolic links are not allowed in packages");
    const relative = prefix + entry.name;
    if (entry.isDirectory()) result.push(...await walk(path.join(root, entry.name), relative + "/", ignore));
    else if (entry.isFile()) result.push(relative);
  }
  return result;
}
export async function writeFiles(root, files) {
  for (const [relative, bytes] of Object.entries(files)) {
    if (relative.startsWith("/") || relative.split("/").includes("..")) throw new Error("Unsafe package path");
    const target = path.join(root, relative); await fs.mkdir(path.dirname(target), { recursive: true }); await fs.writeFile(target, bytes);
  }
}
const json = value => JSON.stringify(value, null, 2) + "\n";
export async function build(c, output, { references, now = Date.now() } = {}) {
  const report = validate(c, now);
  if (report.errors.length) throw new Error(report.errors.map(v => `${v.field}: ${v.message}`).join("\n"));
  const out = path.resolve(output); await fs.mkdir(path.dirname(out), { recursive: true });
  if (out === kitRoot.slice(0, -1) || out.startsWith(kitRoot)) throw new Error("Build outside the kit source folder");
  try { await fs.lstat(out); throw new Error("Output already exists; choose a new folder to preserve previous evidence"); } catch (e) { if (e.code !== "ENOENT") throw e; }
  const temp = await fs.mkdtemp(path.join(path.dirname(out), ".tournament-build-"));
  try {
    const files = {
      "README.md": `# ${c.title} — tournament launch package\n\nVersion ${VERSION}. Registration state: **${c.registration.state}**.\n\n- Host **public/** only. It contains the event page, player guide, public JSON and any enabled registration assets.\n- Keep **private/**, **kit/** and **reference/** private. They contain operating links, evidence, source code and configuration. No participant records are included.\n- Start with private/launch-checklist.md, private/director-runbook.md and private/integrations.md.\n- To copy: npm ci --prefix kit, then node kit/cli.mjs init --from private/tournament.json --id NEW-UNIQUE-ID --out ../new-tournament. Dates, bindings and verification reset.\n- Edit the new tournament.json, validate, then build a new version. Never reuse an old event's registrations, invoices or capacity pools.\n- Verify this package: node kit/cli.mjs verify .\n\nThis package does not deploy, open a provider, provision a roster/database, send messages, or move money. Local readiness records are attestations, not live provider verification.\n\nSource snapshots included: ${references ? "yes — see reference/source-manifest.json" : "no — see private/source-lock.json and collect them before calling this a full source bundle"}.\n`,
      "public/index.html": renderPage(c), "public/event.json": json(publicEvent(c)), "public/player-guide.md": playerGuide(c),
      "public/assets/style.css": css, "public/assets/registration.mjs": await fs.readFile(path.join(kitRoot, "lib/registration.mjs")),
      "private/tournament.json": json(c), "private/readiness.json": json({ packageVersion: VERSION, checkedAt: new Date(now).toISOString(), scope: "Local configuration and recorded evidence only; providers were not queried", ...report }),
      "private/source-lock.json": await fs.readFile(path.join(kitRoot, "source-lock.json")), "private/integrations.md": await fs.readFile(path.join(kitRoot, "docs/integrations.md")),
      "private/audit.md": await fs.readFile(path.join(kitRoot, "docs/audit.md")),
      ...Object.fromEntries(Object.entries(operationFiles(c, report)).map(([name, data]) => ["private/" + name, data])),
    };
    if (c.registration.provider === "nga-series" && c.registration.state === "open") files["public/native-registration.json"] = json({ state: "open", closesAt: c.registration.closesAt, event: c.registration.native.event, revision: c.registration.native.revision, apiPath: `/api/mvf-series/${c.registration.native.event}/register` });
    if (c.publicUrl) {
      const { default: QRCode } = await import("qrcode");
      const target = c.registration.state === "open" ? c.registration.url : c.publicUrl;
      files["public/assets/registration-qr.svg"] = await QRCode.toString(target, { type: "svg", errorCorrectionLevel: "M", margin: 4 });
      files["public/assets/registration-qr.png"] = await QRCode.toBuffer(target, { type: "png", width: 640, margin: 4, errorCorrectionLevel: "M" });
      files["private/qr-manifest.json"] = json({ target, use: c.registration.state === "open" ? "Registration" : "Event information; registration is closed", quietZoneModules: 4, proofRequired: "Scan the actual printed proof with a phone before distribution" });
    }
    await writeFiles(temp, files);
    for (const name of await walk(kitRoot, "", new Set(["node_modules", "output", ".git"]))) {
      if (name.split("/").some(p => ["node_modules", "output", ".git"].includes(p)) || name.endsWith(".zip")) continue;
      await writeFiles(temp, { ["kit/" + name]: await fs.readFile(path.join(kitRoot, name)) });
    }
    if (references) {
      const source = path.resolve(references);
      const manifest = JSON.parse(await fs.readFile(path.join(source, "source-manifest.json"), "utf8"));
      const sourceLock = JSON.parse(files["private/source-lock.json"]);
      if (sourceLock.components.some(pin => !manifest.components?.some(c => c.id === pin.id && c.commit === pin.commit))) throw new Error("The source bundle must include both pinned components");
      const inventory = (await walk(source)).filter(p => p !== "source-manifest.json").sort();
      if (JSON.stringify(inventory) !== JSON.stringify(Object.keys(manifest.files).sort())) throw new Error("Reference inventory differs from its manifest");
      for (const [name, digest] of Object.entries(manifest.files)) {
        if (name.startsWith("/") || name.split("/").includes("..")) throw new Error("Unsafe reference path");
        const bytes = await fs.readFile(path.join(source, name)); if (hash(bytes) !== digest) throw new Error("Source snapshot integrity check failed");
        await writeFiles(temp, { ["reference/" + name]: bytes });
      }
      await writeFiles(temp, { "reference/source-manifest.json": json(manifest) });
    }
    const digests = {};
    for (const name of await walk(temp)) digests[name] = hash(await fs.readFile(path.join(temp, name)));
    await writeFiles(temp, { "package-manifest.json": json({ packageVersion: VERSION, eventId: c.slug, configSha256: hash(json(c)), sourceSnapshots: !!references, files: digests }) });
    await fs.rename(temp, out); return { directory: out, eventId: c.slug, state: c.registration.state, sourceSnapshots: !!references, files: Object.keys(digests).length + 1, warnings: report.warnings };
  } catch (e) { await fs.rm(temp, { recursive: true, force: true }); throw e; }
}
export async function verify(directory) {
  const root = path.resolve(directory), manifest = JSON.parse(await fs.readFile(path.join(root, "package-manifest.json"), "utf8"));
  const actual = (await walk(root)).filter(p => p !== "package-manifest.json").sort(), expected = Object.keys(manifest.files).sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error("Package inventory differs from its manifest");
  for (const [name, digest] of Object.entries(manifest.files)) if (hash(await fs.readFile(path.join(root, name))) !== digest) throw new Error(`Integrity check failed: ${name}`);
  return { ok: true, eventId: manifest.eventId, files: actual.length + 1, sourceSnapshots: manifest.sourceSnapshots };
}
export async function pack(directory, archive) {
  await verify(directory);
  const dest = path.resolve(archive), root = path.resolve(directory);
  if (dest === root || dest.startsWith(root + path.sep)) throw new Error("Put the archive outside the package folder");
  const entries = await Promise.all((await walk(root)).map(async name => [name, await fs.readFile(path.join(root, name))]));
  await fs.mkdir(path.dirname(dest), { recursive: true }); await fs.writeFile(dest, zip(entries), { flag: "wx" });
  return { archive: dest, bytes: (await fs.stat(dest)).size, entries: entries.length };
}
