import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { hash, writeFiles } from "./build.mjs";
import ts from "typescript";
const lock = JSON.parse(await fs.readFile(fileURLToPath(new URL("../source-lock.json", import.meta.url)), "utf8"));
export function dependencyPaths(file, content, available, aliasRoot, workspaceAliases = {}) {
  const matches = ts.preProcessFile(content, true, true).importedFiles.map(f => f.fileName);
  const resolved = [], unresolved = [];
  for (const spec of matches) {
    if (spec.startsWith("@community-os/")) {
      const target = workspaceAliases[spec];
      if (target && available.has(target)) resolved.push(target); else unresolved.push({ file, specifier: spec });
      continue;
    }
    if (!spec.startsWith(".") && !spec.startsWith("@/")) continue;
    const base = path.posix.normalize(spec.startsWith("@/") ? `${aliasRoot}/${spec.slice(2)}` : path.posix.join(path.posix.dirname(file), spec));
    const candidates = [base, base.replace(/\.[cm]?js$/, ".ts"), base.replace(/\.[cm]?js$/, ".tsx"), ...[".ts", ".tsx", ".mjs", ".js", ".json", ".css"].flatMap(ext => [base + ext, base + "/index" + ext])];
    const target = candidates.find(candidate => available.has(candidate));
    if (target) resolved.push(target); else unresolved.push({ file, specifier: spec });
  }
  return { resolved, unresolved };
}
export function selectSourceFiles(component, paths) {
  return paths.filter(file => component.include.some(pattern => pattern.endsWith("/") ? file.startsWith(pattern) : file === pattern));
}
export async function collectSources(roots, output, { components: selected = lock.components.map(c => c.id) } = {}) {
  const out = path.resolve(output);
  try { await fs.lstat(out); throw new Error("Reference output already exists"); } catch (e) { if (e.code !== "ENOENT") throw e; }
  const files = {}, components = [];
  for (const component of lock.components.filter(c => selected.includes(c.id))) {
    const root = roots[component.id]; if (!root) throw new Error(`Provide the ${component.id} checkout`);
    if (!/^[a-f0-9]{40}$/.test(component.commit)) throw new Error("Invalid source pin");
    const git = args => execFileSync("git", ["-C", path.resolve(root), ...args], { maxBuffer: 32 * 1024 * 1024 });
    const names = git(["ls-tree", "-r", "--name-only", component.commit]).toString().trim().split("\n"), available = new Set(names);
    const queue = [...component.entrypoints, ...selectSourceFiles(component, names)], seen = new Set(), unresolved = [];
    while (queue.length) {
      const name = queue.shift(); if (seen.has(name)) continue;
      if (!available.has(name) || name.startsWith("/") || name.split("/").some(p => p === ".." || p === "node_modules" || p.startsWith(".env"))) throw new Error("Source file missing or excluded by export policy");
      const bytes = git(["show", `${component.commit}:${name}`]); seen.add(name); files[component.id + "/" + name] = bytes;
      if (/\.(?:[cm]?js|tsx?)$/.test(name)) {
        const deps = dependencyPaths(name, bytes.toString(), available, component.aliasRoot, component.workspaceAliases); queue.push(...deps.resolved); unresolved.push(...deps.unresolved);
      }
    }
    if (unresolved.length) throw new Error(`Unresolved local source imports in ${component.id}: ${JSON.stringify(unresolved)}`);
    components.push({ id: component.id, repository: component.repository, commit: component.commit, files: seen.size, role: component.role });
  }
  await writeFiles(out, files);
  const manifest = { schemaVersion: 1, components, files: Object.fromEntries(Object.entries(files).map(([name, bytes]) => [name, hash(bytes)])), credentialsIncluded: false, participantRecordsIncluded: false };
  await writeFiles(out, { "source-manifest.json": JSON.stringify(manifest, null, 2) + "\n" });
  return { directory: out, components, files: Object.keys(files).length };
}
