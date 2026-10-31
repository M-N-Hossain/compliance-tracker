// Loaded inside the app's server during Playwright runs: cuts its outside phone line.
// The Vitest block cannot reach this process, so this is a small copy for the server.
import { appendFileSync } from "node:fs";
import net from "node:net";

const LOCAL_HOSTS = ["localhost", "127.0.0.1", "::1"];

// The smoke test reads this file, because the app may catch the error thrown below.
const LOG_FILE = "e2e/.blocked-network.log";

// next dev checks this host for newer versions. It is still blocked, but it is not the
// app's doing, so it does not count as a test failure.
const TOOL_HOSTS = ["registry.npmjs.org"];

// Finds the host in the different ways socket.connect can be called.
// Returns null for a local pipe, which has a path instead of a host.
function hostOf(args) {
  const first = Array.isArray(args[0]) ? args[0][0] : args[0];
  if (typeof first === "number") return typeof args[1] === "string" ? args[1] : "localhost";
  if (typeof first === "string") return null;
  return first.path ? null : (first.host ?? "localhost");
}

// Every connection in Node ends up here.
const realConnect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  const host = hostOf(args);
  if (host !== null && !LOCAL_HOSTS.includes(host)) {
    if (!TOOL_HOSTS.includes(host)) appendFileSync(LOG_FILE, `${host}\n`);
    throw new Error(`Blocked network call to ${host} during a Playwright run.`);
  }
  return realConnect.apply(this, args);
};
