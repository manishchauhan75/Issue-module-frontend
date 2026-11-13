import { request } from "./client";

const BASE = "/api/v1/issues/missing-metadata";

/**
 * mode: "rerun" re-checks only files with pending findings; any other mode
 * returns the snapshot's stored results, validating only a new snapshot.
 */
export function validateMissingMetadata({ snapshotId, workspacePath, mode = "normal" }) {
  return request(`${BASE}/validation`, {
    method: "POST",
    body: {
      snapshot_id: snapshotId,
      workspace_path: workspacePath,
      rerun: mode === "rerun",
    },
  });
}

/** One file's content with its pending findings as highlight markers. */
export function getMissingMetadataFileErrors({ snapshotId, fileId, signal }) {
  return request(`${BASE}/view-missing-metadata`, {
    query: { snapshot_id: snapshotId, file_id: fileId },
    signal,
  });
}

/** Groups are per file, then per metadata item (sent back in "element", like the schema groups). */
export function getMissingMetadataGroups({ snapshotId, fileId, element, limit = 20, offset = 0, signal }) {
  return request(`${BASE}/groups`, {
    query: { snapshot_id: snapshotId, file_id: fileId, metadata_name: element, limit, offset },
    signal,
  });
}
