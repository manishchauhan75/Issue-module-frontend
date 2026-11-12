// Shared by the issue groups page and the file error view: how an XSLT run's
// result is shown, and which micro-XSLTs already ran on which file.

import { fmt } from "./components/ui";

export const XSLT_TONE = { completed: "success", partial: "warning", failed: "error" };

const plural = (n, word) => `${fmt(n)} ${word}${n === 1 ? "" : "s"}`;

/** One-line result of an XSLT run (master or micro). */
export function xsltSummary(run) {
  const what = run.run_type === "master" ? "Master XSLT" : `Micro-XSLT ${run.stylesheets.join(", ")}`;
  let text =
    run.files_changed || run.files_failed
      ? `${what}: ${plural(run.files_changed, "file")} changed, ${plural(run.total_changes, "change")} recorded.`
      : `${what} made no changes.`;
  if (run.files_failed) {
    const shown = run.failed_files.slice(0, 3).map((f) => `${f.file_path} (${f.reason})`);
    const more = run.failed_files.length > 3 ? ` and ${run.failed_files.length - 3} more` : "";
    text += ` ${plural(run.files_failed, "file")} failed and were left unchanged: ${shown.join("; ")}${more}.`;
  }
  return text;
}

// "{file_id}:{element}" pairs whose micro-XSLT already ran, per snapshot (kept across reloads).
// Running a micro-XSLT again on its own output cannot fix what it left, so it is not offered again.
export const appliedKey = (fileId, element) => `${fileId}:${element}`;
const appliedStorageKey = (snapshotId) => `metr-issues:micro-applied:${snapshotId}`;

export function loadApplied(snapshotId) {
  try {
    return new Set(JSON.parse(localStorage.getItem(appliedStorageKey(snapshotId))) || []);
  } catch {
    return new Set();
  }
}

export function saveApplied(snapshotId, applied) {
  try {
    localStorage.setItem(appliedStorageKey(snapshotId), JSON.stringify([...applied]));
  } catch {
    // storage unavailable; the state still lives in memory
  }
}
