"use server";

/** Re-exports for colocated route imports; implementation lives in `@/lib/visitors/actions`. */
export {
  createVisitorVisit,
  duplicateVisitorVisit,
  issueVisitorPass,
  removeVisitorPhoto,
  updateDraftVisitor,
  uploadVisitorPhoto,
  visitorCheckIn,
  visitorCheckOut,
} from "@/lib/visitors/actions";
