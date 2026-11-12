import { request } from "./client";

const BASE = "/api/v1/issues/broken-link";

/**
 * mode: "rerun" re-checks only files with pending broken links; any other mode
 * returns the snapshot's stored results, validating only a new snapshot
 * (this API has no force re-validation).
 */
export function validateBrokenLinks({ snapshotId, workspacePath, mode = "normal" }) {
  return request(`${BASE}/validation`, {
    method: "POST",
    body: {
      snapshot_id: snapshotId,
      workspace_path: workspacePath,
      rerun: mode === "rerun",
    },
  });
}

/** One file's content with its pending broken links as highlight markers on the broken attributes. */
export function getBrokenLinkFileErrors({ snapshotId, fileId, signal }) {
  return request(`${BASE}/view-broken-links`, {
    query: { snapshot_id: snapshotId, file_id: fileId },
    signal,
  });
}

/** Groups are per file, then per link type (sent back in "element", like the schema groups). */
export function getBrokenLinkGroups({ snapshotId, fileId, element, limit = 20, offset = 0, signal }) {
  return request(`${BASE}/groups`, {
    query: { snapshot_id: snapshotId, file_id: fileId, link_type: element, limit, offset },
    signal,
  });
}
