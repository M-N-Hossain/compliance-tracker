// Lives in utils/ (not in match-select.tsx) because both server and client code
// need it, and plain values exported from a "use client" file don't work on the server.

export const NOT_ON_CHECKLIST = "";
export const NOT_DECIDED = "choose";

// What a document's dropdown should show at first, based on the database.
//   linked to a template           -> that template's id, as text ("5")
//   not linked, has pending request -> NOT_ON_CHECKLIST (user said "none of these")
//   not linked, no pending request  -> NOT_DECIDED (nobody has decided yet)
export function initialMatchValue(doc: {
  requirementTemplateId: number | null;
  hasPendingRequest: boolean;
}): string {
  if (doc.requirementTemplateId !== null) return String(doc.requirementTemplateId);
  if (doc.hasPendingRequest) return NOT_ON_CHECKLIST;
  return NOT_DECIDED;
}
