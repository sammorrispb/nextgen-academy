#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validate, cloneConfig, VERSION } from "./lib/config.mjs";
import { build, verify, pack, writeFiles } from "./lib/build.mjs";

const [command, ...args] = process.argv.slice(2), options = {}, positional = [];
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith("--")) { if (!args[i + 1] || args[i + 1].startsWith("--")) throw new Error("Option needs a value"); options[args[i].slice(2)] = args[++i]; }
  else positional.push(args[i]);
}
const read = async name => JSON.parse(await fs.readFile(name, "utf8"));
try {
  let result;
  if (command === "init") {
    if (!options.id || !options.out || !/^[a-z][a-z0-9-]{2,79}$/.test(options.id)) throw new Error("init requires --id UNIQUE-SLUG --out NEW-DIRECTORY");
    const example = options.preset === "adult" ? "adult-fixed.json" : "mvf-november.json";
    const source = await read(options.from ?? fileURLToPath(new URL("./examples/" + example, import.meta.url)));
    const out = path.resolve(options.out); await fs.mkdir(out, { recursive: false });
    await writeFiles(out, { "tournament.json": JSON.stringify(cloneConfig(source, options.id), null, 2) + "\n", "START-HERE.md": "# New tournament\n\nEdit tournament.json. Dates, venue, provider links, director, payment owner and evidence were reset. Re-confirm fees and policies for this event.\n\nRun the kit’s validate command, then build a new output directory. Registration stays closed until the chosen provider and all verification gates are ready.\n" });
    result = { directory: out, config: path.join(out, "tournament.json"), state: "draft", nextAction: "Fill the new event details, select its registration provider, and validate" };
  } else if (command === "validate") {
    if (!positional[0]) throw new Error("validate requires tournament.json"); result = validate(await read(positional[0]));
    if (result.errors.length) process.exitCode = 1;
  } else if (command === "build") {
    if (!positional[0] || !options.out) throw new Error("build requires tournament.json --out NEW-DIRECTORY");
    result = await build(await read(positional[0]), options.out, { references: options.references });
  } else if (command === "verify") {
    if (!positional[0]) throw new Error("verify requires a package directory"); result = await verify(positional[0]);
  } else if (command === "pack") {
    if (!positional[0] || !options.out) throw new Error("pack requires a verified package directory --out NEW-FILE.zip"); result = await pack(positional[0], options.out);
  } else if (command === "collect-sources") {
    if (!options.nextgen || !options.community || !options.out) throw new Error("collect-sources requires --nextgen CHECKOUT --community CHECKOUT --out NEW-DIRECTORY");
    const { collectSources } = await import("./lib/references.mjs"); result = await collectSources({ "nextgen-academy": options.nextgen, "community-os": options.community }, options.out);
  } else {
    result = { name: "Tournament Launch Kit", version: VERSION, commands: ["init --id EVENT --out NEW-DIRECTORY [--from tournament.json | --preset adult]", "validate tournament.json", "collect-sources --nextgen CHECKOUT --community CHECKOUT --out NEW-DIRECTORY", "build tournament.json --out NEW-DIRECTORY [--references SOURCE-DIRECTORY]", "verify PACKAGE-DIRECTORY", "pack PACKAGE-DIRECTORY --out NEW-FILE.zip"], effects: "Local files only. No deployment, provider provisioning, activation, messaging or money movement." };
  }
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
} catch (error) {
  process.stderr.write(JSON.stringify({ ok: false, error: error.message }) + "\n"); process.exitCode = 1;
}
