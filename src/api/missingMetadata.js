// Missing Metadata module — backend not built yet.
// Keep the same shapes as the schema module so the UI needs no changes:
//   validate -> { total_findings, total_errors, total_warnings, total_info, ... }
//   getGroups -> { total_files, total_issues, limit, offset, files: [FileGroup] }

import { ApiError } from "./client";

export async function validateMissingMetadata({ snapshotId, workspacePath }) {
  void snapshotId, workspacePath;
  throw new ApiError(501, "Missing metadata validation is not available yet.");
  // return request("/api/v1/issues/metadata/validation", { method: "POST", body: { snapshot_id: snapshotId, workspace_path: workspacePath } });
}

export async function getMissingMetadataGroups({ snapshotId, limit, offset }) {
  void snapshotId, limit, offset;
  throw new ApiError(501, "Missing metadata groups are not available yet.");
  // return request("/api/v1/issues/metadata/groups", { query: { snapshot_id: snapshotId, limit, offset } });
}
