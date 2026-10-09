import { S3Client } from "@aws-sdk/client-s3";

// Reads one value from .env.
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

// The account ID is only used to build the endpoint below.
const accountId = requireEnv("R2_ACCOUNT_ID");

// Every upload/download command must name the bucket,
// so routes import it from here instead of reading .env again.
export const R2_BUCKET = requireEnv("R2_BUCKET");

// No globalThis trick here, unlike lib/prisma.ts: this client holds no
// open connections, only settings. Each call is an independent HTTPS
// request, so a hot reload just creates a new small object.
export const r2 = new S3Client({
  // The AWS SDK requires a region. R2 has none, so Cloudflare says "auto".
  region: "auto",

  // Where requests go. Amazon S3 has one global address;
  // R2 gives each account its own.
  endpoint: `https://${accountId}.r2.cloudflarestorage.com`,

  // The SDK uses the secret to sign every request; it is never sent itself.
  credentials: {
    accessKeyId: requireEnv("R2_ACCESS_KEY_ID"),
    secretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY"),
  },

  // Newer SDK versions add integrity checksums to every request by default,
  // which R2 had trouble with. Only send them when an operation requires it.
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
});
