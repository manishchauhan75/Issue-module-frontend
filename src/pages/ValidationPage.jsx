import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSnapshot } from "../context/SnapshotContext";
import { MODULES } from "../modules";
import { Alert, Button, Card, ComingSoon, Spinner } from "../components/ui";

// Mirrors SNAPSHOT_ID_PATTERN on the backend.
const SNAPSHOT_ID_RE = /^[A-Za-z0-9][A-Za-z0-9_.-]{0,127}$/;
const ABSOLUTE_PATH_RE = /^([A-Za-z]:[\\/]|\\\\|\/)/;

const MODES = [
  {
    value: "normal",
    label: "Validate",
    help: "Run validation, or return stored results if this snapshot was already validated.",
  },
  {
    value: "force",
    label: "Force re-run",
    help: "Validate every file again and replace the stored results.",
  },
  {
    value: "rerun",
    label: "Re-check pending",
    help: "Validate only files with pending issues; fixed issues are marked fixed.",
  },
];

function validate(snapshotId, workspacePath) {
  const errors = {};
  if (!snapshotId) errors.snapshotId = "Snapshot ID is required.";
  else if (!SNAPSHOT_ID_RE.test(snapshotId) || snapshotId.includes(".."))
    errors.snapshotId = "Start with a letter or digit; use only letters, digits, '_', '-', '.' (max 128, no '..').";
  if (!workspacePath) errors.workspacePath = "Workspace path is required.";
  else if (!ABSOLUTE_PATH_RE.test(workspacePath)) errors.workspacePath = "Use an absolute path, e.g. F:\\docs\\space.";
  return errors;
}

export default function ValidationPage() {
  const navigate = useNavigate();
  const snapshot = useSnapshot();
  const [snapshotId, setSnapshotId] = useState(snapshot.snapshotId);
  const [workspacePath, setWorkspacePath] = useState(snapshot.workspacePath);
  const [mode, setMode] = useState("normal");
  const [fieldErrors, setFieldErrors] = useState({});
  const [errors, setErrors] = useState(null);

  async function onSubmit(e) {
    e.preventDefault();
    const id = snapshotId.trim();
    const path = workspacePath.trim();
    const found = validate(id, path);
    setFieldErrors(found);
    setErrors(null);
    if (Object.keys(found).length) return;

    const { results, errors } = await snapshot.runValidation({ snapshotId: id, workspacePath: path, mode });
    if (Object.keys(results).length) navigate("/dashboard");
    else setErrors(errors);
  }

  const inputClass = (err) =>
    `mt-1.5 block w-full rounded-md border bg-white px-3 py-2 text-sm shadow-xs outline-none transition focus:ring-2 ${
      err ? "border-red-400 focus:ring-red-200" : "border-slate-300 focus:border-brand-600 focus:ring-brand-100"
    }`;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-3xl font-bold tracking-tight">Run validation</h1>
      <p className="mt-1 text-slate-500">Scan a DITA workspace for issues and open the dashboard.</p>

      <Card className="mt-8 p-6 sm:p-8">
        <form onSubmit={onSubmit} noValidate className="space-y-6">
          <div>
            <label htmlFor="snapshotId" className="text-sm font-medium text-slate-700">
              Snapshot ID
            </label>
            <input
              id="snapshotId"
              value={snapshotId}
              onChange={(e) => setSnapshotId(e.target.value)}
              placeholder="snapshot_2026_11_03"
              maxLength={128}
              autoComplete="off"
              className={`${inputClass(fieldErrors.snapshotId)} font-mono`}
            />
            {fieldErrors.snapshotId && <p className="mt-1 text-xs text-red-600">{fieldErrors.snapshotId}</p>}
          </div>

          <div>
            <label htmlFor="workspacePath" className="text-sm font-medium text-slate-700">
              Workspace path
            </label>
            <input
              id="workspacePath"
              value={workspacePath}
              onChange={(e) => setWorkspacePath(e.target.value)}
              placeholder="F:\dedub-testing-documents\MetR-Demo\space"
              autoComplete="off"
              className={`${inputClass(fieldErrors.workspacePath)} font-mono`}
            />
            {fieldErrors.workspacePath ? (
              <p className="mt-1 text-xs text-red-600">{fieldErrors.workspacePath}</p>
            ) : (
              <p className="mt-1 text-xs text-slate-500">Absolute path on the server running the Issues service.</p>
            )}
          </div>

          <fieldset>
            <legend className="text-sm font-medium text-slate-700">Mode</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {MODES.map((m) => (
                <label
                  key={m.value}
                  className={`cursor-pointer rounded-lg border p-3 text-sm transition ${
                    mode === m.value ? "border-brand-600 bg-brand-50 ring-1 ring-brand-600" : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <input
                    type="radio"
                    name="mode"
                    value={m.value}
                    checked={mode === m.value}
                    onChange={() => setMode(m.value)}
                    className="sr-only"
                  />
                  <span className="font-medium text-slate-900">{m.label}</span>
                  <span className="mt-1 block text-xs text-slate-500">{m.help}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div>
            <p className="text-sm font-medium text-slate-700">Modules</p>
            <ul className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200">
              {MODULES.map((m) => (
                <li key={m.key} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span className={m.enabled ? "text-slate-900" : "text-slate-400"}>{m.title}</span>
                  {m.enabled ? (
                    <span className="text-xs font-medium text-emerald-700">Included</span>
                  ) : (
                    <ComingSoon />
                  )}
                </li>
              ))}
            </ul>
          </div>

          {errors && (
            <Alert>
              <p className="font-medium">Validation failed</p>
              <ul className="mt-1 list-disc pl-5">
                {Object.entries(errors).map(([key, msg]) => (
                  <li key={key}>{msg}</li>
                ))}
              </ul>
            </Alert>
          )}

          <div className="flex items-center justify-end gap-3">
            {snapshot.snapshotId && (
              <Button variant="secondary" onClick={() => navigate("/dashboard")} disabled={snapshot.running}>
                Back to dashboard
              </Button>
            )}
            <Button type="submit" disabled={snapshot.running}>
              {snapshot.running && <Spinner />}
              {snapshot.running ? "Validating…" : "Run validation"}
            </Button>
          </div>
          {snapshot.running && (
            <p className="text-right text-xs text-slate-500">Large workspaces can take several minutes.</p>
          )}
        </form>
      </Card>
    </div>
  );
}
