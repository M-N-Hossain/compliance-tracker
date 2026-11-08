import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// A cached "ok" would hide an outage from whoever asks next.
const NO_STORE = { "Cache-Control": "no-store" };

// The Pool in lib/prisma.ts has no timeout, so a hung database would make this wait forever.
const TIMEOUT_MS = 3000;

export async function GET() {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(Object.assign(new Error("Health check timed out"), { name: "TimeoutError" })),
      TIMEOUT_MS,
    );
  });

  try {
    // Losing the race only stops the waiting; the query itself stays in the Pool until it ends.
    await Promise.race([prisma.$queryRaw`SELECT 1`, timeout]);
    return NextResponse.json({ status: "ok", database: "up" }, { headers: NO_STORE });
  } catch (error) {
    // Log only name and code: a connection error message can quote the host and connection string.
    const { name, code } = (error ?? {}) as { name?: string; code?: string };
    console.error("Health check could not reach the database:", name, code);
    return NextResponse.json(
      { status: "error", database: "down" },
      { status: 503, headers: NO_STORE },
    );
  } finally {
    clearTimeout(timer);
  }
}
