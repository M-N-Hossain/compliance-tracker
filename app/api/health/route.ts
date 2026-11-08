import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// A cached "ok" would hide an outage from whoever asks next.
const NO_STORE = { "Cache-Control": "no-store" };

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", database: "up" }, { headers: NO_STORE });
  } catch (error) {
    // Log only name and code: a connection error message can quote the host and connection string.
    const { name, code } = (error ?? {}) as { name?: string; code?: string };
    console.error("Health check could not reach the database:", name, code);
    return NextResponse.json(
      { status: "error", database: "down" },
      { status: 503, headers: NO_STORE },
    );
  }
}
