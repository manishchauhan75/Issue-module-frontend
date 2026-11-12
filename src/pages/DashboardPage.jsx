import { useState } from "react";
import { useSnapshot } from "../context/SnapshotContext";
import { MODULES } from "../modules";
import { Alert, Button, ButtonLink, Card, ComingSoon, SEVERITY, Spinner, StatusBadge, fmt } from "../components/ui";

function StatCard({ value, label, tone = "text-slate-900" }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/60 px-6 py-5">
      <div className={`text-3xl font-bold ${tone}`}>{fmt(value)}</div>
      <div className="mt-1 text-sm text-slate-500">{label}</div>
    </div>
  );
}

const LINK_TYPES = [
  ["image", "Images"],
  ["external", "External"],
  ["cross_reference", "Cross-references"],
  ["keyref", "Keyrefs"],
  ["conref", "Conrefs"],
];

function Stats({ module, result }) {
  // Broken links have no severities: total plus one card per link type.
  if (module.key === "brokenLinks") {
    return (
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard value={result?.total_findings} label="Total Broken Links" />
        {LINK_TYPES.map(([key, label]) => (
          <StatCard key={key} value={result?.broken_links?.[key]} label={label} />
        ))}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatCard value={result?.total_findings} label="Total Issues" />
      <StatCard value={result?.total_errors} label="Errors" tone={SEVERITY.error.text} />
      <StatCard value={result?.total_warnings} label="Warnings" tone={SEVERITY.warning.text} />
      <StatCard value={result?.total_info} label="Info" tone={SEVERITY.info.text} />
    </div>
  );
}

function RerunSummary({ summary }) {
  if (!summary) return null;
  const items = [
    ["Files selected", summary.files_selected],
    ["Files validated", summary.files_validated],
    ["Issues fixed", summary.issues_fixed],
    ["Still pending", summary.issues_retained],
    ["New issues", summary.issues_inserted],
    ["Reopened", summary.issues_reopened],
  ];
  return (
    <div>
      <h3 className="flex items-center gap-2 text-sm font-medium text-slate-700">
        Last re-check <StatusBadge status={summary.status} />
      </h3>
      <dl className="mt-2 grid grid-cols-3 gap-x-4 gap-y-2 text-sm sm:grid-cols-6">
        {items.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-slate-500">{label}</dt>
            <dd className="font-semibold tabular-nums">{fmt(value)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function FailedFiles({ files }) {
  if (!files?.length) return null;
  return (
    <details className="rounded-lg border border-amber-200 bg-amber-50/50 text-sm">
      <summary className="cursor-pointer px-4 py-2 font-medium text-amber-800">
        {files.length} file{files.length > 1 ? "s" : ""} could not be fully validated
      </summary>
      <ul className="max-h-64 divide-y divide-amber-100 overflow-auto border-t border-amber-200">
        {files.map((f, i) => (
          <li key={`${f.file_path}-${i}`} className="px-4 py-2">
            <p className="font-mono text-xs break-all text-slate-800">{f.file_path}</p>
            <p className="text-xs text-slate-600">
              {f.gate != null && `Gate ${f.gate} · `}
              {f.schematron && `${f.schematron} · `}
              {f.reason}
            </p>
          </li>
        ))}
      </ul>
    </details>
  );
}

function SchemaDetails({ result }) {
  return (
    <div className="mt-6 space-y-6 border-t border-slate-100 pt-6">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-600">
        <span className="flex items-center gap-2">
          Status <StatusBadge status={result.status} />
        </span>
        <span>
          Files validated <b className="text-slate-900">{fmt(result.files_validated ?? result.files_checked)}</b> /{" "}
          {fmt(result.total_files)}
        </span>
        {result.files_failed > 0 && (
          <span>
            Failed <b className="text-amber-700">{fmt(result.files_failed)}</b>
          </span>
        )}
        {result.completed_at && <span>Completed {new Date(result.completed_at).toLocaleString()}</span>}
      </div>
      {result.message && <p className="text-sm text-slate-500">{result.message}</p>}
      <RerunSummary summary={result.rerun_summary} />
      <FailedFiles files={result.failed_files} />
    </div>
  );
}

function ModuleSection({ module, result, error }) {
  const [open, setOpen] = useState(true);
  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-3 text-left"
          aria-expanded={open}
        >
          <span className={`text-xs text-slate-500 transition-transform ${open ? "" : "-rotate-90"}`}>▼</span>
          <h2 className="text-xl font-semibold">{module.title}</h2>
          {!module.enabled && <ComingSoon />}
        </button>
        {module.enabled ? (
          <ButtonLink to={module.path}>{module.viewAllLabel} →</ButtonLink>
        ) : (
          <Button disabled>{module.viewAllLabel} →</Button>
        )}
      </div>

      {open && (
        <div className="mt-6">
          {error && (
            <div className="mb-4">
              <Alert>{error}</Alert>
            </div>
          )}
          <Stats module={module} result={result} />
          {!module.enabled && (
            <p className="mt-4 text-sm text-slate-500">This module is not connected yet. Results will appear here once its API is available.</p>
          )}
          {module.enabled && result && <SchemaDetails result={result} />}
        </div>
      )}
    </Card>
  );
}

export default function DashboardPage() {
  const { results, errors, running } = useSnapshot();
  const available = Object.values(results);
  const totalIssues = available.reduce((sum, r) => sum + (r.total_findings || 0), 0);
  const topics = results.schema?.total_files;
  const firstEnabled = MODULES.find((m) => m.enabled);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Issues</h1>
          <p className="mt-1 text-slate-500">
            {fmt(totalIssues)} issues across {fmt(topics)} topics
          </p>
        </div>
        <div className="flex items-center gap-3">
          {running && (
            <span className="flex items-center gap-2 text-sm text-slate-500">
              <Spinner /> Validating…
            </span>
          )}
          <ButtonLink variant="secondary" to="/">
            New validation
          </ButtonLink>
          {firstEnabled && <ButtonLink to={firstEnabled.path}>View All Issues →</ButtonLink>}
        </div>
      </div>

      {MODULES.map((m) => (
        <ModuleSection
          key={m.key}
          module={m}
          result={results[m.key]}
          error={errors[m.key]}
        />
      ))}
    </div>
  );
}
