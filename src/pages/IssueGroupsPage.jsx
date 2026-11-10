import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useSnapshot } from "../context/SnapshotContext";
import { moduleByKey } from "../modules";
import {
  Alert,
  Button,
  ButtonLink,
  Card,
  ComingSoon,
  SEVERITY,
  SEVERITY_ORDER,
  SeverityBadge,
  Spinner,
  fmt,
} from "../components/ui";

const PAGE_SIZE = 20;

function SeverityCounts({ elements }) {
  const counts = {};
  elements.forEach((g) => g.issues.forEach((i) => (counts[i.severity] = (counts[i.severity] || 0) + 1)));
  return (
    <span className="ml-auto flex gap-1.5">
      {SEVERITY_ORDER.filter((s) => counts[s]).map((s) => (
        <span key={s} className={`rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${SEVERITY[s].badge}`}>
          {fmt(counts[s])} {s}
        </span>
      ))}
    </span>
  );
}

function IssueTable({ issues, lineHref }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
            <th className="py-2 pr-4 font-medium">Severity</th>
            <th className="py-2 pr-4 font-medium">Description</th>
            <th className="py-2 text-right font-medium">Line</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {issues.map((issue) => (
            <tr key={issue.finding_key} className="align-top">
              <td className="py-2 pr-4">
                <SeverityBadge severity={issue.severity} />
              </td>
              <td className="py-2 pr-4 text-slate-800">{issue.description}</td>
              <td className="py-2 text-right tabular-nums text-slate-500">
                {!issue.line ? (
                  "—"
                ) : lineHref ? (
                  <Link to={lineHref(issue.line)} className="text-brand-700 hover:underline">
                    {issue.line}
                  </Link>
                ) : (
                  issue.line
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ElementGroup({ group, canFix, fixing, onFix, onFilter, lineHref }) {
  const [open, setOpen] = useState(true);
  const fixable = canFix && group.xslt_available;
  return (
    <div className="rounded-lg border border-slate-200">
      <div className="flex flex-wrap items-center gap-3 bg-slate-50 px-4 py-2.5">
        <button type="button" onClick={() => setOpen((o) => !o)} className="flex items-center gap-2" aria-expanded={open}>
          <span className={`text-[10px] text-slate-500 transition-transform ${open ? "" : "-rotate-90"}`}>▼</span>
          {group.element ? (
            <code className="rounded bg-white px-1.5 py-0.5 text-sm font-semibold text-brand-700 ring-1 ring-slate-200">
              &lt;{group.element}&gt;
            </code>
          ) : (
            <span className="text-sm font-medium text-slate-500">Unknown element</span>
          )}
          <span className="text-sm text-slate-500">
            {group.issue_count} issue{group.issue_count === 1 ? "" : "s"}
          </span>
        </button>
        {group.element && (
          <button
            type="button"
            onClick={() => onFilter(group.element)}
            className="text-xs text-slate-500 underline-offset-2 hover:text-brand-700 hover:underline"
          >
            only this element
          </button>
        )}
        <div className="ml-auto flex items-center gap-2">
          {group.xslt && (
            <span
              className={`font-mono text-xs ${group.xslt_available ? "text-emerald-700" : "text-slate-400 line-through"}`}
              title={group.xslt_available ? "Micro-XSLT available" : "No micro-XSLT for this element yet"}
            >
              {group.xslt}
            </span>
          )}
          <Button size="sm" variant="secondary" disabled={!fixable || fixing} onClick={onFix}>
            {fixing && <Spinner className="h-3.5 w-3.5" />}
            Apply micro-XSLT
          </Button>
          {!canFix && <ComingSoon />}
        </div>
      </div>
      {open && (
        <div className="px-4 pb-2">
          <IssueTable issues={group.issues} lineHref={lineHref} />
        </div>
      )}
    </div>
  );
}

function FileCard({ file, ...groupProps }) {
  const [open, setOpen] = useState(false);
  return (
    <Card>
      <div className="flex items-center gap-3 px-5 py-4">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 text-left"
          aria-expanded={open}
        >
          <span className={`text-xs text-slate-500 transition-transform ${open ? "" : "-rotate-90"}`}>▼</span>
          <span className="font-semibold text-slate-900">{file.file_title || file.relative_path}</span>
          <span className="rounded bg-brand-50 px-1.5 py-0.5 text-xs font-medium text-brand-700">{file.dita_type}</span>
          <SeverityCounts elements={file.elements} />
          <span className="w-full truncate pl-6 font-mono text-xs text-slate-500" title={file.file_path}>
            {file.relative_path}
          </span>
        </button>
        {groupProps.fileHref && (
          <ButtonLink size="sm" to={groupProps.fileHref(file)}>
            View errors →
          </ButtonLink>
        )}
      </div>
      {open && (
        <div className="space-y-3 border-t border-slate-100 px-5 py-4">
          {file.elements.map((g) => (
            <ElementGroup
              key={g.element ?? "__unknown"}
              group={g}
              fixing={groupProps.fixingKey === `${file.file_id}:${g.element}`}
              canFix={groupProps.canFix}
              lineHref={groupProps.fileHref && ((line) => groupProps.fileHref(file, line))}
              onFix={() => groupProps.onFix(file, g)}
              onFilter={groupProps.onFilter}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

function Pagination({ total, offset, limit, onChange }) {
  if (total <= limit) return null;
  const page = Math.floor(offset / limit) + 1;
  const pages = Math.ceil(total / limit);
  return (
    <div className="flex items-center justify-between text-sm text-slate-600">
      <span>
        Files {fmt(offset + 1)}–{fmt(Math.min(offset + limit, total))} of {fmt(total)}
      </span>
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onChange(offset - limit)}>
          ← Previous
        </Button>
        <span className="tabular-nums">
          {page} / {pages}
        </span>
        <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => onChange(offset + limit)}>
          Next →
        </Button>
      </div>
    </div>
  );
}

function NotConnected({ module }) {
  return (
    <Card className="px-6 py-16 text-center">
      <p className="text-lg font-semibold text-slate-900">{module.title} is not connected yet</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
        Issues will be listed here, grouped by file, once the {module.title.toLowerCase()} API is available. Set{" "}
        <code className="font-mono">enabled: true</code> for this module in <code className="font-mono">src/modules.js</code>.
      </p>
      <ButtonLink variant="secondary" to="/dashboard" className="mt-6">
        Back to dashboard
      </ButtonLink>
    </Card>
  );
}

export default function IssueGroupsPage({ moduleKey }) {
  const module = moduleByKey(moduleKey);
  const { snapshotId, workspacePath, runValidation, running } = useSnapshot();

  const [elementInput, setElementInput] = useState("");
  const [element, setElement] = useState("");
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [fixingKey, setFixingKey] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);
  const reload = useCallback(() => setReloadToken((t) => t + 1), []);

  useEffect(() => {
    if (!module.enabled) return;
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    module
      .getGroups({ snapshotId, element: element || undefined, limit: PAGE_SIZE, offset, signal: ctrl.signal })
      .then(setData)
      .catch((err) => err.name !== "AbortError" && setError(err.message))
      .finally(() => !ctrl.signal.aborted && setLoading(false));
    return () => ctrl.abort();
  }, [module, snapshotId, element, offset, reloadToken]);

  if (!module.enabled) return <NotConnected module={module} />;

  function applyFilter(value) {
    const v = value.trim();
    setElementInput(v);
    setElement(v);
    setOffset(0);
  }

  async function recheck() {
    setNotice(null);
    const { results, errors } = await runValidation({ snapshotId, workspacePath, mode: "rerun", only: [moduleKey] });
    if (errors[moduleKey]) setNotice({ tone: "error", text: errors[moduleKey] });
    else setNotice({ tone: "success", text: results[moduleKey]?.message || "Re-check completed." });
    reload();
  }

  async function fix(action, key) {
    setNotice(null);
    setFixingKey(key);
    try {
      await action();
      await recheck();
    } catch (err) {
      setNotice({ tone: "error", text: err.message });
    } finally {
      setFixingKey(null);
    }
  }

  const fixElement = (file, group) =>
    fix(() => module.fixElement({ snapshotId, fileId: file.file_id, element: group.element }), `${file.file_id}:${group.element}`);
  const fixAll = () => fix(() => module.fixAll({ snapshotId }), "__all");
  const fileHref = module.getFileErrors
    ? (file, line) => `${module.path}/files/${encodeURIComponent(file.file_id)}${line ? `?line=${line}` : ""}`
    : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{module.title}</h1>
          <p className="mt-1 text-slate-500">
            {data ? `${fmt(data.total_issues)} pending issues in ${fmt(data.total_files)} files` : "Loading…"}
            {element && (
              <>
                {" "}
                · element <code className="font-mono">&lt;{element}&gt;</code>
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ButtonLink variant="secondary" to="/dashboard">
            ← Dashboard
          </ButtonLink>
          <Button variant="secondary" onClick={recheck} disabled={running || !!fixingKey}>
            {running && !fixingKey && <Spinner />}
            Re-check pending
          </Button>
          {module.fixAll && (
            <Button onClick={fixAll} disabled={!module.features.masterXslt || !!fixingKey || running}>
              {fixingKey === "__all" && <Spinner />}
              Apply master XSLT
              {!module.features.masterXslt && <span className="text-xs font-normal opacity-80">(soon)</span>}
            </Button>
          )}
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          applyFilter(elementInput);
        }}
        className="flex flex-wrap items-center gap-2"
      >
        <label htmlFor="element" className="text-sm text-slate-600">
          Element
        </label>
        <input
          id="element"
          value={elementInput}
          onChange={(e) => setElementInput(e.target.value)}
          placeholder="e.g. image"
          maxLength={64}
          className="w-48 rounded-md border border-slate-300 bg-white px-3 py-1.5 font-mono text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
        />
        <Button type="submit" size="sm" variant="secondary">
          Filter
        </Button>
        {element && (
          <Button size="sm" variant="ghost" onClick={() => applyFilter("")}>
            Clear
          </Button>
        )}
        {loading && <Spinner className="ml-2 h-4 w-4 text-slate-400" />}
      </form>

      {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}
      {error && <Alert>{error}</Alert>}

      {data && !data.files.length && !loading && (
        <Card className="px-6 py-12 text-center text-slate-500">
          {element ? `No pending issues for <${element}>.` : "No pending issues. Everything is fixed."}
        </Card>
      )}

      {data && (
        <div className={`space-y-4 transition-opacity ${loading ? "opacity-60" : ""}`}>
          {data.files.map((file) => (
            <FileCard
              key={file.file_id + file.file_path}
              file={file}
              canFix={module.features.microXslt}
              fileHref={fileHref}
              fixingKey={fixingKey}
              onFix={fixElement}
              onFilter={applyFilter}
            />
          ))}
          <Pagination total={data.total_files} offset={data.offset} limit={data.limit} onChange={setOffset} />
        </div>
      )}
    </div>
  );
}
