import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigationType, useSearchParams } from "react-router-dom";
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
import { XSLT_TONE, appliedKey, loadApplied, saveApplied, xsltSummary } from "../xsltRuns";

const PAGE_SIZE = 20;

// Open file cards and scroll position, per tab, so going back from a file's
// error view shows the list exactly as it was.
function sessionGet(key, fallback) {
  try {
    const raw = sessionStorage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function sessionSet(key, value) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage unavailable; the list just opens in its default state
  }
}

function SeverityCounts({ elements }) {
  const counts = {};
  elements.forEach((g) => g.issues.forEach((i) => i.severity && (counts[i.severity] = (counts[i.severity] || 0) + 1)));
  if (!Object.keys(counts).length) {
    // Modules without severities (broken links): just the number of issues.
    const total = elements.reduce((sum, g) => sum + g.issue_count, 0);
    return (
      <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
        {fmt(total)} issue{total === 1 ? "" : "s"}
      </span>
    );
  }
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
  // Broken-link findings carry the reference as written and why it failed.
  const isLink = issues.some((i) => i.broken_link !== undefined);
  const hasSeverity = issues.some((i) => i.severity);
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
            {hasSeverity && <th className="py-2 pr-4 font-medium">Severity</th>}
            {isLink && <th className="py-2 pr-4 font-medium">Broken link</th>}
            {isLink && <th className="py-2 pr-4 font-medium">Reason</th>}
            <th className="py-2 pr-4 font-medium">Description</th>
            <th className="py-2 text-right font-medium">Line</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {issues.map((issue) => (
            <tr key={issue.finding_key} className="align-top">
              {hasSeverity && (
                <td className="py-2 pr-4">
                  <SeverityBadge severity={issue.severity} />
                </td>
              )}
              {isLink && (
                <td className="py-2 pr-4 font-mono text-xs break-all text-slate-800" title={issue.resolved_target || undefined}>
                  {issue.broken_link || "(empty)"}
                </td>
              )}
              {isLink && <td className="py-2 pr-4 font-mono text-xs whitespace-nowrap text-slate-600">{issue.reason}</td>}
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

function ElementGroup({ group, canFix, showFix, fixing, applied, onFix, lineHref }) {
  const [open, setOpen] = useState(false);
  const fixable = canFix && group.xslt_available && !applied;
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
        <div className="ml-auto flex items-center gap-2">
          {group.xslt && (
            <span
              className={`font-mono text-xs ${group.xslt_available ? "text-emerald-700" : "text-slate-400 line-through"}`}
              title={group.xslt_available ? "Micro-XSLT available" : "No micro-XSLT for this element yet"}
            >
              {group.xslt}
            </span>
          )}
          {showFix && (
            <Button
              size="sm"
              variant="secondary"
              disabled={!fixable || fixing}
              onClick={onFix}
              title={applied ? "Already applied to this file; these issues remain after the re-check." : undefined}
            >
              {fixing && <Spinner className="h-3.5 w-3.5" />}
              {applied ? "Micro-XSLT applied" : "Apply micro-XSLT"}
            </Button>
          )}
          {showFix && !canFix && <ComingSoon />}
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

function FileCard({ file, open, onToggle, ...groupProps }) {
  return (
    <Card>
      <div className="flex items-center gap-3 px-5 py-4">
        <button
          type="button"
          onClick={onToggle}
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
              fixing={groupProps.fixingKey === appliedKey(file.file_id, g.element)}
              applied={groupProps.applied.has(appliedKey(file.file_id, g.element))}
              canFix={groupProps.canFix}
              showFix={groupProps.showFix}
              lineHref={groupProps.fileHref && ((line) => groupProps.fileHref(file, line))}
              onFix={() => groupProps.onFix(file, g)}
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

  // Filter and page live in the URL (?element=&offset=), so "back" returns to them.
  const [searchParams, setSearchParams] = useSearchParams();
  const element = searchParams.get("element") || "";
  const offset = Math.max(0, Number(searchParams.get("offset")) || 0);
  const setQuery = (next) => {
    const params = {};
    if (next.element) params.element = next.element;
    if (next.offset) params.offset = String(next.offset);
    setSearchParams(params, { replace: true });
  };
  const setOffset = (value) => setQuery({ element, offset: value });

  const [elementInput, setElementInput] = useState(element);
  const openKey = `metr-issues:open-files:${snapshotId}:${moduleKey}`;
  const scrollKey = `metr-issues:scroll:${snapshotId}:${moduleKey}`;
  const [openFiles, setOpenFiles] = useState(() => sessionGet(openKey, []));
  const navigationType = useNavigationType();
  const scrollRestored = useRef(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [fixingKey, setFixingKey] = useState(null);
  const [applied, setApplied] = useState(() => loadApplied(snapshotId));
  const [reloadToken, setReloadToken] = useState(0);
  const reload = useCallback(() => setReloadToken((t) => t + 1), []);

  useEffect(() => setApplied(loadApplied(snapshotId)), [snapshotId]);

  function markApplied(key) {
    setApplied((prev) => {
      const next = new Set(prev).add(key);
      saveApplied(snapshotId, next);
      return next;
    });
  }

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

  // Remember the scroll position when leaving; restore it when coming back (back arrow / browser back).
  useEffect(() => () => sessionSet(scrollKey, window.scrollY), [scrollKey]);
  useEffect(() => {
    if (!data || scrollRestored.current) return;
    scrollRestored.current = true;
    const y = sessionGet(scrollKey, 0);
    if (navigationType === "POP" && y) requestAnimationFrame(() => window.scrollTo(0, y));
  }, [data, navigationType, scrollKey]);

  if (!module.enabled) return <NotConnected module={module} />;

  function toggleFile(fileId) {
    setOpenFiles((prev) => {
      const next = prev.includes(fileId) ? prev.filter((id) => id !== fileId) : [...prev, fileId];
      sessionSet(openKey, next);
      return next;
    });
  }

  function applyFilter(value) {
    const v = value.trim();
    setElementInput(v);
    setQuery({ element: v, offset: 0 });
  }

  /** Re-validate files with pending issues; returns {error} or {message}. */
  async function runRecheck() {
    const { results, errors } = await runValidation({ snapshotId, workspacePath, mode: "rerun", only: [moduleKey] });
    reload();
    return errors[moduleKey]
      ? { error: errors[moduleKey] }
      : { message: results[moduleKey]?.message || "Re-check completed." };
  }

  async function recheck() {
    setNotice(null);
    const check = await runRecheck();
    setNotice(check.error ? { tone: "error", text: check.error } : { tone: "success", text: check.message });
  }

  // XSLT fixes rewrite files in place. After the master XSLT a re-check marks the
  // issues it fixed; after a micro-XSLT Schematron is not run again ("Re-check
  // pending" does that when wanted). A micro-XSLT that ran is not offered again
  // for that file and element: running it on its own output cannot fix what it left.
  async function fix(action, key) {
    const isMaster = key === "__all";
    setNotice(null);
    setFixingKey(key);
    try {
      const run = await action();
      if (!isMaster && run.status !== "failed") markApplied(key);
      let detail;
      if (isMaster) {
        const check = await runRecheck();
        detail = check.error ? `Re-check failed: ${check.error}` : check.message;
      } else {
        reload();
        if (run.files_changed) detail = "Issues stay pending until you click “Re-check pending”.";
      }
      setNotice({
        tone: XSLT_TONE[run.status] || "info",
        text: xsltSummary(run),
        detail,
      });
    } catch (err) {
      setNotice({ tone: "error", text: err.message });
    } finally {
      setFixingKey(null);
    }
  }

  const fixElement = (file, group) =>
    fix(
      () => module.fixElement({ snapshotId, filePath: file.file_path, element: group.element }),
      appliedKey(file.file_id, group.element)
    );
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

      {notice && (
        <Alert tone={notice.tone}>
          <p>{notice.text}</p>
          {notice.detail && <p className="mt-1">{notice.detail}</p>}
        </Alert>
      )}
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
              open={openFiles.includes(file.file_id)}
              onToggle={() => toggleFile(file.file_id)}
              canFix={module.features.microXslt}
              showFix={!!module.fixElement}
              fileHref={fileHref}
              fixingKey={fixingKey}
              applied={applied}
              onFix={fixElement}
            />
          ))}
          <Pagination total={data.total_files} offset={data.offset} limit={data.limit} onChange={setOffset} />
        </div>
      )}
    </div>
  );
}
