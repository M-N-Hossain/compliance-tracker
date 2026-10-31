// Tests for block-destructive.mjs. Run with: node test/hook-test/block-destructive.test.mjs
// Commands are only passed to the hook as text. Nothing here ever runs them.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HOOK = fileURLToPath(new URL("../../.claude/hooks/block-destructive.mjs", import.meta.url));

// Commands the hook must refuse.
const BLOCK = [
  "git clean -n",
  "git -C . clean -fd",
  "git 'clean' -f",
  "git push --force",
  "git push -f origin main",
  "git push origin main --force-with-lease",
  "git -C . push -f",
  "git -c a=b push --force",
  "git push origin +main",
  "git push origin :main",
  "git push --delete origin main",
  "git push origin -d main",
  "git push --mirror",
  "git push --no-verify",
  "git commit --no-verify -m x",
  "git commit -n -m x",
  "git reset --hard",
  "git -C . reset --hard HEAD~1",
  "git branch -D old",
  "git branch --delete --force old",
  "git diff --no-index .env other",
  "git diff --output=x",
  "git log --output=x",
  "docker compose down -v",
  "docker compose down --volumes",
  "docker compose -p ct-fresh down -v",
  "docker-compose down -v",
  "docker volume rm x",
  "docker volume prune",
  "docker system prune -a",
  "docker compose config",
  "printenv",
  "env",
  "env | sort",
  "npx prisma migrate reset",
  "npx prisma migrate deploy",
  "npx prisma db execute --file x.sql",
  "npx prisma db push --force-reset",
  "npx prisma db push --accept-data-loss",
  "git status && git clean -f",
  "git status; git reset --hard",
  'sh -c "git clean -f"',
  "git push \\\n  --force",
  "C:\\Program Files\\Git\\bin\\git.exe clean -f",
];

// Commands that must reach the normal permission prompt instead of being refused.
const ASK = ["git push", "git push origin feat/001-foo", "git -C . push", "git 'push' origin x"];

// Everyday commands the hook must leave alone.
const PASS = [
  "git status",
  "git diff",
  "git log --oneline -5",
  "git branch -d merged",
  "git reset HEAD~1",
  "git commit -m x",
  "docker compose up -d db",
  "docker compose down",
  "docker volume ls",
  "npm run check",
  "npx prisma generate",
  "npx prisma migrate dev",
  "npx prisma db push",
  "env FOO=1 node x.js",
];

// Passes raw text to the hook on stdin and returns its result.
const run = (input) => spawnSync(process.execPath, [HOOK], { input, encoding: "utf8" });
const runCommand = (command) => run(JSON.stringify({ tool_input: { command } }));

let failed = 0;

// Prints one line for a failed case and counts it.
function check(ok, label, command) {
  if (!ok) {
    failed += 1;
    console.log(`FAIL ${label}: ${command}`);
  }
}

for (const command of BLOCK) check(runCommand(command).status === 2, "should block", command);

for (const command of ASK) {
  const { status, stdout } = runCommand(command);
  check(status === 0 && stdout.includes('"permissionDecision":"ask"'), "should ask", command);
}

for (const command of PASS) {
  const { status, stdout } = runCommand(command);
  check(status === 0 && stdout === "", "should pass", command);
}

// Input the hook cannot read must block, never pass.
check(run("not json").status === 2, "should fail closed", "not json");
check(run("{}").status === 2, "should fail closed", "{}");

const total = BLOCK.length + ASK.length + PASS.length + 2;
console.log(`${total - failed} of ${total} passed`);
process.exit(failed ? 1 : 0);
