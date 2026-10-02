import { cp, lstat, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { once } from "node:events";
import path from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";

// Only this process's deliberate test configuration reaches Next. No .env
// file, real service key, shell preload or authenticated home is inherited.
export function buildTestEnvironment(input, home, port) {
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error("Invalid isolated browser port");
  }
  return {
    PATH: input.PATH ?? "",
    HOME: home,
    TMPDIR: home,
    CI: "1",
    TZ: "UTC",
    NODE_ENV: "production",
    NEXT_TELEMETRY_DISABLED: "1",
    NEXT_PUBLIC_SITE_URL: `http://127.0.0.1:${port}`,
    RESEND_API_KEY: "re_browser_test_dummy",
  };
}

export function requestAllowed(target, method, port) {
  try {
    const url = new URL(target);
    if (url.username || url.password) return false;
    if (url.origin === `http://127.0.0.1:${port}`) return true;
    // next/font/google needs these public read-only assets to compile. No
    // provider API or external write is permitted, including on font hosts.
    return method.toUpperCase() === "GET" && url.protocol === "https:" &&
      !url.port && ["fonts.googleapis.com", "fonts.gstatic.com"].includes(url.hostname);
  } catch {
    return false;
  }
}

export function networkGuardSource(port) {
  return `
const allowed = ${requestAllowed.toString()};
function check(target, method) {
  if (!allowed(target, method || "GET", ${port})) {
    throw new Error("Browser test blocked an external service request");
  }
}
const originalFetch = globalThis.fetch;
globalThis.fetch = async function(input, options) {
  check(typeof input === "string" || input instanceof URL ? input : input.url,
    options?.method || input?.method || "GET");
  return originalFetch.call(this, input, options);
};
for (const protocol of ["http:", "https:"]) {
  const client = require(protocol === "https:" ? "node:https" : "node:http");
  for (const name of ["request", "get"]) {
    const original = client[name];
    client[name] = function(...args) {
      const first = args[0];
      const isUrl = typeof first === "string" || first instanceof URL;
      const options = isUrl ? (typeof args[1] === "object" ? args[1] : {}) : first;
      const url = isUrl ? new URL(first) : new URL(protocol + "//" + (options.hostname || options.host || "localhost"));
      if (options.hostname || options.host) url.hostname = options.hostname || options.host;
      if (options.port) url.port = String(options.port);
      if (options.protocol) url.protocol = options.protocol;
      check(url.href, options.method || "GET");
      return original.apply(this, args);
    };
  }
}
`;
}

// This runner creates a private app copy in a fresh temporary directory.
// The fixture route therefore never enters src/app or a production build.
export async function prepareWorkspace(root, port) {
  const workspace = await mkdtemp(path.join(tmpdir(), "nga-browser-"));
  try {
    // Explicit allowlist: credentials, workflows and private files cannot be
    // copied accidentally by adding a file at the repository root.
    for (const file of ["src", "public", "package.json", "tsconfig.json", "postcss.config.mjs"]) {
      await cp(path.join(root, file), path.join(workspace, file), {
        recursive: true,
        filter: async (entry) => {
          const name = path.basename(entry);
          return !name.startsWith(".env") && !/\.(?:pem|key)$/i.test(name) &&
            !(await lstat(entry)).isSymbolicLink();
        },
      });
    }
    await symlink(path.join(root, "node_modules"), path.join(workspace, "node_modules"), "dir");
    const originalConfig = await readFile(path.join(root, "next.config.ts"), "utf8");
    const nextConfig = originalConfig.replace("root: __dirname", `root: ${JSON.stringify(root)}`);
    if (nextConfig === originalConfig) throw new Error("Unrecognized Next filesystem-root configuration");
    await writeFile(path.join(workspace, "next.config.ts"), nextConfig);
    const fixtureDir = path.join(workspace, "src/app/browser-test-fixture/reservation");
    await mkdir(fixtureDir, { recursive: true });
    await cp(path.join(root, "e2e/fixtures/reservation-page.tsx"), path.join(fixtureDir, "page.tsx"));
    const guard = path.join(workspace, "network-guard.cjs");
    await writeFile(guard, networkGuardSource(port));
    // Next's child workers inherit this guard too; no secret is loaded.
    const env = {
      ...buildTestEnvironment(process.env, workspace, port),
      NODE_OPTIONS: `--require=${JSON.stringify(guard)}`,
    };
    return { workspace, env };
  } catch (error) {
    await rm(workspace, { recursive: true, force: true });
    throw error;
  }
}

async function main() {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const port = Number(process.argv[2] ?? 3191);
  // Validate before any filesystem mutation.
  buildTestEnvironment({}, root, port);
  const { workspace, env } = await prepareWorkspace(root, port);
  const next = path.join(root, "node_modules/next/dist/bin/next");
  let child;
  let stopped = false;
  const stop = () => {
    stopped = true;
    child?.kill("SIGTERM");
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
  try {
    child = spawn(process.execPath, [next, "build", "--webpack"], { cwd: workspace, env, stdio: "inherit" });
    const [buildCode] = await once(child, "exit");
    if (stopped) return;
    if (buildCode !== 0) throw new Error(`Isolated browser build failed (${buildCode})`);
    child = spawn(process.execPath, [next, "start", "--hostname", "127.0.0.1", "--port", String(port)], {
      cwd: workspace, env, stdio: "inherit",
    });
    const [serverCode] = await once(child, "exit");
    if (!stopped && serverCode !== 0) throw new Error(`Isolated browser server failed (${serverCode})`);
  } finally {
    process.removeListener("SIGINT", stop);
    process.removeListener("SIGTERM", stop);
    await rm(workspace, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
