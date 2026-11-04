import { ApiError, request } from "./client";

const BASE = "/api/v1/issues/schema";

/**
 * mode: "normal" (reuse stored results), "force" (force_rerun) or "rerun"
 * (re-validate only files with pending issues).
 */
export function validateSchema({ snapshotId, workspacePath, mode = "normal" }) {
  return request(`${BASE}/validation`, {
    method: "POST",
    body: {
      snapshot_id: snapshotId,
      workspace_path: workspacePath,
      force_rerun: mode === "force",
      rerun: mode === "rerun",
    },
  });
}

export function getSchemaIssueGroups({ snapshotId, fileId, element, limit = 20, offset = 0, signal }) {
  return request(`${BASE}/groups`, {
    query: { snapshot_id: snapshotId, file_id: fileId, element, limit, offset },
    signal,
  });
}

/** One file's content with its pending issues as highlight markers. */
export function getSchemaFileErrors({ snapshotId, fileId, signal }) {
  return request(`${BASE}/view-errors`, {
    query: { snapshot_id: snapshotId, file_id: fileId },
    signal,
  });
}

// --- Not yet implemented on the backend. Endpoints are placeholders. ---

/** Run one element's micro-XSLT over one file (then rerun to mark issues fixed). */
export async function applyMicroXslt({ snapshotId, fileId, element }) {
  void snapshotId, fileId, element;
  throw new ApiError(501, "Micro-XSLT fix is not available yet.");
  // return request(`${BASE}/fix/micro`, { method: "POST", body: { snapshot_id: snapshotId, file_id: fileId, element } });
}

/** Run the master XSLT over every file with pending issues. */
export async function applyMasterXslt({ snapshotId }) {
  void snapshotId;
  throw new ApiError(501, "Master XSLT fix is not available yet.");
  // return request(`${BASE}/fix/master`, { method: "POST", body: { snapshot_id: snapshotId } });
}
