// Broken Links module — backend not built yet.
// Keep the same shapes as the schema module so the UI needs no changes:
//   validate -> { total_findings, total_errors, total_warnings, total_info, ... }
//   getGroups -> { total_files, total_issues, limit, offset, files: [FileGroup] }

import { ApiError } from "./client";

export async function validateBrokenLinks({ snapshotId, workspacePath }) {
  void snapshotId, workspacePath;
  throw new ApiError(501, "Broken link validation is not available yet.");
  // return request("/api/v1/issues/links/validation", { method: "POST", body: { snapshot_id: snapshotId, workspace_path: workspacePath } });
}

export async function getBrokenLinkGroups({ snapshotId, limit, offset }) {
  void snapshotId, limit, offset;
  throw new ApiError(501, "Broken link groups are not available yet.");
  // return request("/api/v1/issues/links/groups", { query: { snapshot_id: snapshotId, limit, offset } });
}
