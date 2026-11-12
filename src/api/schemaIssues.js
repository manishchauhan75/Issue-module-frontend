import { request } from "./client";

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

/**
 * Run one element's micro-XSLT ({element}.xsl) over one file, in place.
 * filePath is the file's absolute path from /schema/groups.
 * Issue statuses are only updated by a re-check (rerun) afterwards.
 */
export function applyMicroXslt({ snapshotId, filePath, element }) {
  return request(`${BASE}/microfix`, {
    method: "POST",
    body: { snapshot_id: snapshotId, targets: [{ file_path: filePath, elements: [element] }] },
  });
}

/** Run the master XSLT over every file with pending schema issues, in place. */
export function applyMasterXslt({ snapshotId }) {
  // The server uses the workspace the snapshot was validated against.
  return request(`${BASE}/bulkfix`, { method: "POST", body: { snapshot_id: snapshotId } });
}
