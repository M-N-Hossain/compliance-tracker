// app/api/documents/[id]/file/route.ts
import { NextResponse } from "next/server";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getCurrentUser } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { r2, R2_BUCKET } from "@/lib/r2";

// How long a signed link works. Long enough to open it, short enough
// that a forwarded or leaked link is useless soon after.
const LINK_SECONDS = 5 * 60;

// GET /api/documents/:id/file
// Opened by clicking "View PDF" (a normal link, not fetch), so it answers
// with redirects and plain errors a person can use, not JSON.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Which document?
  const { id } = await params;
  const documentId = Number(id);
  if (!Number.isInteger(documentId)) {
    return new NextResponse("Not found", { status: 404 });
  }

  // 3. IDOR protection, with one exception for admins (they review
  //    other companies' pending requests). isAdmin comes from the DATABASE.
  if (!user.isAdmin && !user.company) {
    return new NextResponse("Not found", { status: 404 });
  }
  const document = await prisma.document.findFirst({
    where: user.isAdmin
      ? { id: documentId } // admin: any document
      : { id: documentId, companyId: user.company!.id }, // owner: only their own
    select: { fileUrl: true, extractedType: true },
  });
  if (!document) {
    return new NextResponse("Not found", { status: 404 });
  }

  // 4. A friendly file name for the tab title and "Save as".
  //    Only safe characters, so nothing can break the header below.
  const safeName =
    (document.extractedType ?? "certificate").replace(/[^\w\- ]/g, "").trim() || "certificate";

  // 5. Describe the request we want to allow ("GET this one file"),
  //    then sign it. Nothing is sent to R2 here: signing happens locally
  //    with the secret key. R2 only checks the signature when the link is opened.
  const command = new GetObjectCommand({
    Bucket: R2_BUCKET,
    Key: document.fileUrl, // the key we stored at upload, e.g. company-36/4b0f...pdf
    // Ask R2 to send these headers with the file:
    ResponseContentType: "application/pdf",
    // "inline" = show it in the browser tab instead of downloading.
    ResponseContentDisposition: `inline; filename="${safeName}.pdf"`,
  });
  const signedUrl = await getSignedUrl(r2, command, { expiresIn: LINK_SECONDS });

  // 6. Send the browser to R2. no-store: never cache this redirect,
  //    because the signed link inside it expires.
  const res = NextResponse.redirect(signedUrl);
  res.headers.set("Cache-Control", "no-store");
  return res;
}
