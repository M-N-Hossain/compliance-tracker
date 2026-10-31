// Loaded before every test file: cuts the outside phone line.
// Connections to this computer still work, so the test database stays reachable.
import net from "node:net";
import { afterEach } from "vitest";

const LOCAL_HOSTS = ["localhost", "127.0.0.1", "::1"];

// Kept on globalThis, so every import of this file shares one list.
const shared = globalThis as typeof globalThis & { blockedNetworkCalls?: string[] };
const blockedCalls = (shared.blockedNetworkCalls ??= []);

// Returns the blocked calls and clears the list. Only the block's own tests need this.
export function takeBlockedCalls(): string[] {
  return blockedCalls.splice(0);
}

// Finds the host in the different ways socket.connect can be called.
// Returns null for a local pipe, which has a path instead of a host.
function hostOf(args: unknown[]): string | null {
  const first = Array.isArray(args[0]) ? args[0][0] : args[0];
  if (typeof first === "number") return typeof args[1] === "string" ? args[1] : "localhost";
  if (typeof first === "string") return null;
  const options = first as { host?: string; path?: string };
  return options.path ? null : (options.host ?? "localhost");
}

// Every connection in Node ends up here, so this one place covers fetch, https and the SDKs.
const realConnect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (this: net.Socket, ...args: unknown[]) {
  const host = hostOf(args);
  if (host !== null && !LOCAL_HOSTS.includes(host)) {
    blockedCalls.push(host);
    throw new Error(`Blocked network call to ${host}. Tests must use a fake for this service.`);
  }
  return realConnect.apply(this, args as never);
} as typeof net.Socket.prototype.connect;

// App code often catches errors, which would hide the throw above.
// So this check runs after each test and fails it anyway.
afterEach(() => {
  const calls = takeBlockedCalls();
  if (calls.length > 0) {
    throw new Error(`This test tried to reach the network: ${calls.join(", ")}`);
  }
});
