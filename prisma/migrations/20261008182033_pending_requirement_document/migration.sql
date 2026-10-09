/*
  Warnings:

  - A unique constraint covering the columns `[documentId]` on the table `PendingRequirement` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "PendingRequirement" ADD COLUMN     "documentId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "PendingRequirement_documentId_key" ON "PendingRequirement"("documentId");

-- AddForeignKey
ALTER TABLE "PendingRequirement" ADD CONSTRAINT "PendingRequirement_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;
