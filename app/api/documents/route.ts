import { NextResponse } from "next/server";
import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getCurrentUser } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { r2, R2_BUCKET } from "@/lib/r2";
import { extractCertificate } from "@/lib/extractCertificate";
import { checklistCategories } from "@/utils/category";

// max 5mb pdf size.
const MAX_BYTES = 5 * 1024 * 1024;

// POST /api/documents
// Receives one PDF, stores it in R2, and records its key in Postgres.
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not logged in" }, { status: 401 });
  }

  const company = user.company;
  if (!company) {
    return NextResponse.json({ error: "Set up your company first" }, { status: 400 });
  }

  // Unpack the multipart body. Throws if the request isn't multipart.
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected a file upload" }, { status: 400 });
  }

  // formData.get() can return a string, a File, or null.
  // "instanceof File" makes sure we actually got a file.
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }

  // A real file, but with nothing in it.
  if (file.size === 0) {
    return NextResponse.json({ error: "The file is empty" }, { status: 400 });
  }

  // 413 = "Payload Too Large", the standard status for this.
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File is larger than 5 MB" }, { status: 413 });
  }

  // Read the bytes and check the magic bytes, not file.type.
  const bytes = Buffer.from(await file.arrayBuffer());
  const isPdf = bytes.subarray(0, 5).toString("ascii") === "%PDF-";
  if (!isPdf) {
    // 415 = "Unsupported Media Type".
    return NextResponse.json({ error: "Only PDF files are allowed" }, { status: 415 });
  }

  // Our own key: company folder + random ID. No user input in it.
  const key = `company-${company.id}/${crypto.randomUUID()}.pdf`;

  try {
    // The SDK builds a signed HTTPS request and sends it to R2.
    await r2.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
        Body: bytes,
        ContentType: "application/pdf",
      }),
    );
  } catch (err) {
    console.error("R2 upload failed:", err);
    return NextResponse.json({ error: "Could not store the file" }, { status: 500 });
  }

  // Record the key. If this fails, remove the file we just uploaded.
  let document;
  try {
    document = await prisma.document.create({
      data: { companyId: company.id, fileUrl: key },
    });
  } catch (err) {
    console.error("Saving document failed:", err);
    await r2
      .send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }))
      .catch((e) => console.error("Cleanup failed:", e));
    return NextResponse.json({ error: "Could not save the document" }, { status: 500 });
  }

  // AI extraction. if it fails (quota, bad answer),
  // the upload has still succeeded and the AI fields just stay empty.
  let extracted = null;
  try {
    // The company's checklist. Only its own category, so Gemini can't
    // match a food business's certificate to a construction requirement.
    // No category yet (setup unfinished) -> empty list -> always "NONE".
    const templates = company.category
      ? await prisma.requirementTemplate.findMany({
          where: { category: { in: checklistCategories(company.category) } },
          select: { id: true, name: true },
        })
      : [];

    extracted = await extractCertificate(bytes, templates);
    if (extracted) {
      await prisma.document.update({
        where: { id: document.id },
        data: {
          extractedType: extracted.certificateType,
          expiryDate: extracted.expiryDate,
        },
      });
    }
  } catch (err) {
    console.error("Certificate extraction failed:", err);
  }

  return NextResponse.json({ id: document.id, extracted }, { status: 201 });
}
