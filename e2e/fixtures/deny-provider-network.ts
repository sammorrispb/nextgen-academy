import http from "node:http";
import https from "node:https";
import net from "node:net";
import tls from "node:tls";
import { syncBuiltinESMExports } from "node:module";

interface NetworkAttempt {
  operation: string;
  destination: string;
}

// Report only host/port: URLs, request headers and bodies can contain secrets
// or child fields and must never become a failed-test diagnostic.
function destination(args: unknown[]): string {
  const first = args[0];
  if (first instanceof URL || (typeof first === "string" && first.includes("://"))) {
    try {
      const url = first instanceof URL ? first : new URL(first);
      return `${url.hostname}:${url.port || "default"}`;
    } catch {
      return "invalid URL";
    }
  }
  if (typeof first === "number") return `${typeof args[1] === "string" ? args[1] : "unspecified"}:${first}`;
  if (first && typeof first === "object") {
    const options = first as { hostname?: unknown; host?: unknown; port?: unknown };
    return `${options.hostname ?? options.host ?? "unspecified"}:${options.port ?? "default"}`;
  }
  return "unspecified socket";
}

/**
 * Fail closed for SDK transports that bypass FetchStub. This fixture never
 * permits a real connection, including localhost. The socket boundary also
 * catches a request function captured before installation. Assert attempts
 * after exercising runtime code: fail-soft handlers can swallow the throw.
 */
export class DenyProviderNetwork {
  readonly attempts: NetworkAttempt[] = [];
  private undo: Array<() => void> = [];

  install(): this {
    if (this.undo.length) return this;
    this.attempts.length = 0;
    const patch = (target: object, key: string, operation: string) => {
      const object = target as Record<string, unknown>;
      const previous = object[key];
      object[key] = (...args: unknown[]): never => {
        const attempt = { operation, destination: destination(args) };
        this.attempts.push(attempt);
        throw new Error(`[deny-provider-network] blocked ${operation} ${attempt.destination}`);
      };
      this.undo.push(() => { object[key] = previous; });
    };
    for (const [module, label] of [[http, "http"], [https, "https"]] as const) {
      patch(module, "request", `${label}.request`);
      patch(module, "get", `${label}.get`);
    }
    patch(net, "connect", "net.connect");
    patch(net, "createConnection", "net.createConnection");
    patch(net.Socket.prototype, "connect", "net.Socket.connect");
    patch(tls, "connect", "tls.connect");
    // Named ESM imports must see the same guard as require()/default imports.
    syncBuiltinESMExports();
    return this;
  }

  uninstall(): void {
    for (const undo of this.undo.reverse()) undo();
    this.undo = [];
    syncBuiltinESMExports();
  }
}
