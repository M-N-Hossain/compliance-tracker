// PreToolUse hook for the Bash tool. Generic: nothing here depends on this project's stack
// except the Prisma rules, which are marked below.
// Exit 2 blocks the command. Exit 0 lets the normal permission rules decide.
import { readFileSync } from "node:fs";

// Matches "git" plus any options that come before the subcommand, such as -C . or -c a=b.
const GIT_PREFIX = String.raw`(?:^|[\s/(\x60])git(?:\.exe)?(?:\s+(?:--(?:git-dir|work-tree|namespace|exec-path)\s+\S+|-[Cc]\s+\S+|--?[\w-]+(?:=\S+)?))*\s+`;

// Returns the text after a git subcommand, or null if this segment does not run it.
function gitArgs(segment, subcommand) {
  const match = segment.match(new RegExp(`${GIT_PREFIX}${subcommand}(?:\\s+(.*))?$`));
  return match ? (match[1] ?? "") : null;
}

// True if a short flag is present, alone or combined, as in -f or -vf.
const hasShort = (args, letter) =>
  new RegExp(`(?:^|\\s)-[a-zA-Z]*${letter}[a-zA-Z]*(?:\\s|$)`).test(args);

// True if a long flag is present, including longer forms such as --force-with-lease.
const hasLong = (args, flag) => new RegExp(`(?:^|\\s)--${flag}`).test(args);

// Each rule returns true when a segment must be blocked. "why" is shown to Claude.
const RULES = [
  {
    why: "force push rewrites remote history",
    // A leading + on a refspec, as in +main, is also a force push.
    test: (s) => {
      const a = gitArgs(s, "push");
      return a !== null && (hasLong(a, "force") || hasShort(a, "f") || /(?:^|\s)\+\S/.test(a));
    },
  },
  {
    why: "this push deletes or mirrors remote branches",
    // A leading : on a refspec, as in :main, deletes that branch.
    test: (s) => {
      const a = gitArgs(s, "push");
      return (
        a !== null &&
        (hasLong(a, "delete") || hasLong(a, "mirror") || hasShort(a, "d") || /(?:^|\s):\S/.test(a))
      );
    },
  },
  {
    why: "--no-verify skips the git hooks",
    test: (s) => {
      const push = gitArgs(s, "push");
      const commit = gitArgs(s, "commit");
      return (
        (push !== null && hasLong(push, "no-verify")) ||
        (commit !== null && (hasLong(commit, "no-verify") || hasShort(commit, "n")))
      );
    },
  },
  {
    why: "git reset --hard destroys uncommitted work",
    test: (s) => {
      const a = gitArgs(s, "reset");
      return a !== null && hasLong(a, "hard");
    },
  },
  {
    why: "git clean deletes untracked files",
    test: (s) => gitArgs(s, "clean") !== null,
  },
  {
    why: "force deleting a branch can lose commits",
    test: (s) => {
      const a = gitArgs(s, "branch");
      if (a === null) return false;
      const deletes = hasLong(a, "delete") || hasShort(a, "d");
      const forces = hasLong(a, "force") || hasShort(a, "f");
      return hasShort(a, "D") || (deletes && forces);
    },
  },
  {
    why: "--no-index can print any file, including .env, and --output writes files",
    test: (s) => {
      const diff = gitArgs(s, "diff");
      const log = gitArgs(s, "log");
      return (
        (diff !== null && (hasLong(diff, "no-index") || hasLong(diff, "output"))) ||
        (log !== null && hasLong(log, "output"))
      );
    },
  },
  {
    why: "removing compose volumes can delete a database",
    test: (s) => {
      const match = s.match(/\bdocker[\s-]compose\b.*\bdown\b(.*)$/);
      return match !== null && (hasLong(match[1], "volumes") || hasShort(match[1], "v"));
    },
  },
  {
    why: "docker volume rm and prune can delete a database",
    test: (s) => /\bdocker\b.*\bvolume\s+(?:rm|remove|prune)\b/.test(s),
  },
  {
    why: "docker system prune can delete volumes and images",
    test: (s) => /\bdocker\b.*\bsystem\s+prune\b/.test(s),
  },
  {
    why: "docker compose config prints resolved secrets",
    test: (s) => /\bdocker[\s-]compose\b.*\sconfig\b/.test(s),
  },
  {
    why: "this prints environment variables, which can hold secrets",
    test: (s) => /(?:^|\s)printenv\b/.test(s) || /^env$/.test(s),
  },
  // Project-specific: Prisma commands that can lose data or touch the wrong database.
  {
    why: "prisma migrate reset wipes the database",
    test: (s) => /\bprisma\b.*\bmigrate\s+reset\b/.test(s),
  },
  {
    why: "prisma migrate deploy only runs through the Docker service or the guarded test setup",
    test: (s) => /\bprisma\b.*\bmigrate\s+deploy\b/.test(s),
  },
  {
    why: "prisma db execute runs raw SQL",
    test: (s) => /\bprisma\b.*\bdb\s+execute\b/.test(s),
  },
  {
    why: "these prisma db push flags can drop data",
    test: (s) => /\bprisma\b.*\bdb\s+push\b.*--(?:force-reset|accept-data-loss)/.test(s),
  },
];

// Rewrites a command into a plain form, then cuts it at shell separators.
function toSegments(command) {
  return command
    .replace(/\\\r?\n/g, " ") // Join lines continued with a backslash.
    .replace(/\\/g, "/") // Make Windows paths look like POSIX paths.
    .replace(/["']/g, "") // Drop quotes, so git 'push' reads as git push.
    .split(/;|&&?|\|\|?|\r?\n/) // One segment per command.
    .map((segment) => segment.trim().replace(/\s+/g, " ")) // Collapse repeated spaces.
    .filter(Boolean);
}

// Stops the command. Claude Code shows stderr to Claude as the reason.
function block(reason) {
  console.error(`Blocked by .claude/hooks/block-destructive.mjs: ${reason}.`);
  process.exit(2);
}

// Reads the tool call from stdin. Anything unexpected blocks, so a bug cannot open a hole.
let command;
try {
  command = JSON.parse(readFileSync(0, "utf8")).tool_input.command;
  if (typeof command !== "string") throw new Error("no command");
} catch {
  block("the hook could not read the command, so it fails closed");
}

const segments = toSegments(command);

// Any forbidden segment blocks the whole command.
for (const segment of segments) {
  const rule = RULES.find((r) => r.test(segment));
  if (rule) block(rule.why);
}

// A safe push must still ask, even when reworded so that the ask rule misses it.
if (segments.some((segment) => gitArgs(segment, "push") !== null)) {
  console.log(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "ask",
        permissionDecisionReason: "git push leaves this machine, so it needs your approval.",
      },
    }),
  );
}

// Nothing matched: the normal permission rules decide.
process.exit(0);
