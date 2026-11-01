-- One-time cleanup: remove AI values that were saved before the user confirmed them.
-- A document is unconfirmed when it has no checklist link and no pending request.
-- Confirmed documents keep their values, because the user saw them and acted on them.
-- No row is deleted, and the schema does not change.
UPDATE "Document" d
SET "extractedType" = NULL, "expiryDate" = NULL
WHERE d."requirementTemplateId" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "PendingRequirement" p WHERE p."documentId" = d.id
  );
