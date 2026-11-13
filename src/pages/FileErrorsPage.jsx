import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useSnapshot } from "../context/SnapshotContext";
import { moduleByKey } from "../modules";
import { XSLT_TONE, appliedKey, loadApplied, saveApplied, xsltSummary } from "../xsltRuns";
import { Alert, Button, Card, SEVERITY, SEVERITY_ORDER, SeverityBadge, Spinner, fmt } from "../components/ui";

const markerKey = (m) => `${m.start_line}:${m.start_column}`;

const LINK_TYPES = [
  ["image", "Images"],
  ["external", "External"],
  ["cross_reference", "Cross-references"],
  ["keyref", "Keyrefs"],
  ["conref", "Conrefs"],
];

// How a module's issues are filtered: by severity (schema) or by link type
// (broken links). Highlights are always coloured by severity.
const VIEWS = {
  severity: {
    field: "severity",
    noun: "issue",
    counts: (data) => data.counts,
    options: SEVERITY_ORDER.map((s) => ({ key: s, label: SEVERITY[s].label, tone: SEVERITY[s] })),
  },
  link_type: {
    field: "link_type",
    noun: "broken link",
    counts: (data) => data.broken_links,
    // keyrefs are warnings; every other link type is an error
    options: LINK_TYPES.map(([key, label]) => ({
      key,
      label,
      tone: key === "keyref" ? SEVERITY.warning : SEVERITY.error,
    })),
  },
};

/** Tone of the most severe issue, or of the issue's filter option when issues have no severity. */
function toneOf(issues, view) {
  const severity = SEVERITY_ORDER.find((s) => issues.some((i) => i.severity === s));
  if (severity) return SEVERITY[severity];
  return view.options.find((o) => issues.some((i) => i[view.field] === o.key))?.tone || SEVERITY.info;
}

/**
 * Markers narrowed to the visible options, each with the per-line ranges it covers.
 * A marker takes the rank of the first option, in view order, among its issues, and the
 * tone of its most severe issue.
 * API columns are 1-based code-point indexes; ranges here are 0-based, end exclusive.
 */
function buildView(markers, active, view) {
  const visible = [];
  const byLine = new Map();
  for (const m of markers) {
    const issues = m.issues.filter((i) => active.has(i[view.field]));
    if (!issues.length) continue;
    const rank = view.options.findIndex((o) => issues.some((i) => i[view.field] === o.key));
    const shown = { ...m, key: markerKey(m), issues, rank, tone: toneOf(issues, view) };
    visible.push(shown);
    for (let ln = m.start_line; ln <= m.end_line; ln++) {
      const start = ln === m.start_line ? m.start_column - 1 : 0;
      const end = ln === m.end_line ? m.end_column - 1 : Infinity;
      if (!byLine.has(ln)) byLine.set(ln, []);
      byLine.get(ln).push({ start, end, marker: shown });
    }
  }
  byLine.forEach((segs) => segs.sort((a, b) => a.start - b.start));
  return { visible, byLine };
}

function LineContent({ text, segments, selectedKey, onSelect }) {
  if (!segments) return text || " ";
  const chars = Array.from(text); // code points, matching the API's columns
  const out = [];
  let pos = 0;
  segments.forEach((seg, i) => {
    const s = Math.max(seg.start, pos);
    const e = Math.min(seg.end, chars.length);
    if (s > pos) out.push(chars.slice(pos, s).join(""));
    if (e > s) {
      const sev = seg.marker.tone;
      const active = seg.marker.key === selectedKey;
      out.push(
        <mark
          key={i}
          onClick={() => onSelect(seg.marker.key)}
          title={seg.marker.issues.map((x) => x.description).join("\n")}
          className={`cursor-pointer rounded-sm text-inherit underline decoration-wavy decoration-1 underline-offset-4 ${
            active ? sev.markActive : sev.mark
          }`}
        >
          {chars.slice(s, e).join("")}
        </mark>
      );
    }
    pos = Math.max(pos, e);
  });
  if (pos < chars.length) out.push(chars.slice(pos).join(""));
  return out.length ? out : " ";
}

/** Severity badge, plus a link-type badge for broken links. */
function IssueBadge({ issue }) {
  const severity = issue.severity && <SeverityBadge severity={issue.severity} />;
  if (!issue.link_type) return severity;
  const label = LINK_TYPES.find(([key]) => key === issue.link_type)?.[1] || issue.link_type;
  return (
    <div className="flex shrink-0 flex-col items-start gap-1 self-start">
      {severity}
      <span className="inline-flex h-6 items-center rounded-full bg-slate-100 px-2.5 text-xs font-medium whitespace-nowrap text-slate-700 ring-1 ring-slate-200 ring-inset">
        {label}
      </span>
    </div>
  );
}

/** The broken value as written and why it is broken (broken links only). */
function LinkDetail({ issue }) {
  if (issue.broken_link === undefined) return null;
  return (
    <p className="mt-0.5 font-mono text-xs break-all text-slate-500">
      {issue.attribute}="{issue.broken_link}" · {issue.reason}
    </p>
  );
}

function IssueDetails({ issues }) {
  return (
    <ul className="divide-y divide-slate-100">
      {issues.map((issue) => (
        <li key={issue.finding_key} className="flex gap-3 py-2">
          <IssueBadge issue={issue} />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-slate-800">{issue.description}</p>
            <LinkDetail issue={issue} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Popover shown under the selected marker's last line. */
function InlineAnnotation({ marker }) {
  const sev = marker.tone;
  return (
    <div className="sticky left-0 w-[min(48rem,calc(100vw-4rem))] py-1.5 pl-14 font-sans whitespace-normal">
      <div className={`rounded-md border border-l-4 border-slate-200 bg-white px-3 shadow-sm ${sev.border}`}>
        <IssueDetails issues={marker.issues} />
      </div>
    </div>
  );
}

function IssueFilter({ options, counts, active, onToggle }) {
  return (
    <div className={`grid gap-3 ${options.length > 3 ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5" : "grid-cols-3"}`}>
      {options.map(({ key, label, tone }) => {
        const on = active.has(key);
        return (
          <button
            key={key}
            type="button"
            onClick={() => onToggle(key)}
            aria-pressed={on}
            className={`rounded-lg border px-4 py-3 text-left transition ${
              on ? "border-slate-200 bg-white" : "border-dashed border-slate-200 bg-slate-50 opacity-50"
            }`}
          >
            <span className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${tone.dot}`} />
              <span className={`text-2xl font-bold ${tone.text}`}>{fmt(counts?.[key] ?? 0)}</span>
            </span>
            <span className="mt-0.5 block text-sm text-slate-500">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** One row per element with pending issues in this file, each with its micro-XSLT. */
function MicroXsltPanel({ groups, applied, fixing, onApply }) {
  if (!groups?.length) return null;
  return (
    <Card className="p-5">
      <h2 className="text-sm font-semibold">Fix with micro-XSLT</h2>
      <p className="mt-0.5 text-xs text-slate-500">
        Applies the element's stylesheet to this file only. Issues stay pending until a re-check.
      </p>
      <ul className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-200">
        {groups.map((g) => {
          const done = applied.has(g.element);
          const busy = fixing === g.element;
          return (
            <li key={g.element ?? "__unknown"} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
              {g.element ? (
                <code className="rounded bg-white px-1.5 py-0.5 text-sm font-semibold text-brand-700 ring-1 ring-slate-200">
                  &lt;{g.element}&gt;
                </code>
              ) : (
                <span className="text-sm font-medium text-slate-500">Unknown element</span>
              )}
              <span className="text-sm text-slate-500">
                {g.issue_count} issue{g.issue_count === 1 ? "" : "s"}
              </span>
              <span className="ml-auto flex items-center gap-2">
                {g.xslt && (
                  <span
                    className={`font-mono text-xs ${g.xslt_available ? "text-emerald-700" : "text-slate-400 line-through"}`}
                    title={g.xslt_available ? "Micro-XSLT available" : "No micro-XSLT for this element yet"}
                  >
                    {g.xslt}
                  </span>
                )}
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!g.element || !g.xslt_available || done || !!fixing}
                  onClick={() => onApply(g.element)}
                  title={done ? "Already applied to this file; these issues remain after the re-check." : undefined}
                >
                  {busy && <Spinner className="h-3.5 w-3.5" />}
                  {done ? "Fix applied" : "Fix"}
                </Button>
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

export default function FileErrorsPage({ moduleKey }) {
  const module = moduleByKey(moduleKey);
  const { fileId } = useParams();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { snapshotId } = useSnapshot();
  const view = VIEWS[module.viewBy || "severity"];

  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(() => new Set(view.options.map((o) => o.key)));
  const [selectedKey, setSelectedKey] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);
  const codeRef = useRef(null);
  const listRef = useRef(null);

  // Micro-XSLT: this file's element groups (with stylesheet availability) and run state.
  const canFix = Boolean(module.fixElement && module.features?.microXslt);
  const [groups, setGroups] = useState(null);
  const [applied, setApplied] = useState(() => loadApplied(snapshotId));
  const [fixing, setFixing] = useState(null);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    module
      .getFileErrors({ snapshotId, fileId, signal: ctrl.signal })
      .then(setData)
      .catch((err) => err.name !== "AbortError" && setError(err.message))
      .finally(() => !ctrl.signal.aborted && setLoading(false));
    return () => ctrl.abort();
  }, [module, snapshotId, fileId, reloadToken]);

  useEffect(() => {
    if (!canFix) return;
    const ctrl = new AbortController();
    module
      .getGroups({ snapshotId, fileId, limit: 1, offset: 0, signal: ctrl.signal })
      .then((res) => setGroups(res.files[0]?.elements || []))
      .catch((err) => err.name !== "AbortError" && setGroups([]));
    return () => ctrl.abort();
  }, [module, canFix, snapshotId, fileId, reloadToken]);

  useEffect(() => setApplied(loadApplied(snapshotId)), [snapshotId]);

  // Same as on the groups page: the file is rewritten in place, Schematron is not re-run.
  async function applyMicro(element) {
    setNotice(null);
    setFixing(element);
    try {
      const run = await module.fixElement({ snapshotId, filePath: data.file_path, element });
      if (run.status !== "failed") {
        const next = new Set(loadApplied(snapshotId)).add(appliedKey(fileId, element));
        saveApplied(snapshotId, next);
        setApplied(next);
      }
      setNotice({
        tone: XSLT_TONE[run.status] || "info",
        text: xsltSummary(run),
        detail: run.files_changed ? "Issues stay pending until you click “Re-check pending” on the issues page." : null,
      });
      setReloadToken((t) => t + 1);   // show the transformed content
    } catch (err) {
      setNotice({ tone: "error", text: err.message });
    } finally {
      setFixing(null);
    }
  }

  const appliedHere = useMemo(
    () => new Set((groups || []).map((g) => g.element).filter((e) => applied.has(appliedKey(fileId, e)))),
    [groups, applied, fileId]
  );

  const { visible, byLine } = useMemo(() => buildView(data?.markers || [], active, view), [data, active, view]);
  const unpositioned = useMemo(
    () => (data?.unpositioned || []).filter((i) => active.has(i[view.field])),
    [data, active, view]
  );
  const selected = visible.find((m) => m.key === selectedKey) || null;
  const selectedIndex = selected ? visible.indexOf(selected) : -1;

  // The highest-ranked marker starting on each line (most severe, for schema), for the gutter dot.
  const gutter = useMemo(() => {
    const map = new Map();
    for (const m of visible) {
      const prev = map.get(m.start_line);
      if (!prev || m.rank < prev.rank) map.set(m.start_line, m);
    }
    return map;
  }, [visible]);

  const scrollToLine = useCallback((line) => {
    codeRef.current?.querySelector(`[data-line="${line}"]`)?.scrollIntoView({ block: "center" });
  }, []);

  const select = useCallback(
    (key, { scrollCode = false } = {}) => {
      setSelectedKey(key);
      const m = data?.markers.find((x) => markerKey(x) === key);
      if (m && scrollCode) scrollToLine(m.start_line);
      listRef.current?.querySelector(`[data-key="${key}"]`)?.scrollIntoView({ block: "nearest" });
    },
    [data, scrollToLine]
  );

  // ?line=N (from the groups page): jump to the marker on that line, or just the line.
  useEffect(() => {
    if (!data) return;
    const line = Number(searchParams.get("line"));
    if (!line) return;
    const m = data.markers.find((x) => x.start_line <= line && line <= x.end_line);
    requestAnimationFrame(() => (m ? select(markerKey(m), { scrollCode: true }) : scrollToLine(line)));
  }, [data]); // only on load, not on every selection change

  function toggle(key) {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function step(delta) {
    if (!visible.length) return;
    const i = selectedIndex < 0 ? (delta > 0 ? 0 : visible.length - 1) : (selectedIndex + delta + visible.length) % visible.length;
    select(visible[i].key, { scrollCode: true });
  }

  // Back to where the user came from (page, filter, open files, scroll); the
  // module's list if this page was opened directly (no earlier entry in the app).
  const backLink = (
    <Button
      variant="secondary"
      onClick={() => (location.key !== "default" ? navigate(-1) : navigate(module.path))}
    >
      ← {module.title}
    </Button>
  );

  if (loading && !data) {
    return (
      <div className="flex items-center gap-2 text-slate-500">
        <Spinner /> Loading file…
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="space-y-4">
        {backLink}
        <Alert>{error}</Alert>
      </div>
    );
  }

  const selectedEndLine = selected?.end_line;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{data.file_title || data.relative_path}</h1>
            <span className="rounded bg-brand-50 px-1.5 py-0.5 text-xs font-medium text-brand-700">{data.dita_type}</span>
          </div>
          <p className="mt-1 truncate font-mono text-sm text-slate-500" title={data.file_path}>
            {data.relative_path}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {fmt(data.total_issues)} pending {view.noun}
            {data.total_issues === 1 ? "" : "s"} · {fmt(data.lines.length)} lines
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => setReloadToken((t) => t + 1)} disabled={loading}>
            {loading && <Spinner />}
            Reload
          </Button>
          {backLink}
        </div>
      </div>

      {data.stale && (
        <Alert tone="warning">
          This file changed after it was validated, so highlights may be on the wrong lines. Run{" "}
          <Link to={module.path} className="font-medium underline">
            Re-check pending
          </Link>{" "}
          to refresh them.
        </Alert>
      )}
      {error && <Alert>{error}</Alert>}
      {notice && (
        <Alert tone={notice.tone}>
          <p>{notice.text}</p>
          {notice.detail && <p className="mt-1">{notice.detail}</p>}
        </Alert>
      )}

      <IssueFilter options={view.options} counts={view.counts(data)} active={active} onToggle={toggle} />

      {canFix && <MicroXsltPanel groups={groups} applied={appliedHere} fixing={fixing} onApply={applyMicro} />}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2 text-sm">
            <span className="text-slate-500">
              {selected ? `Issue ${selectedIndex + 1} of ${visible.length}` : `${visible.length} highlighted tag${visible.length === 1 ? "" : "s"}`}
            </span>
            <span className="flex gap-1">
              <Button size="sm" variant="ghost" onClick={() => step(-1)} disabled={!visible.length}>
                ↑ Prev
              </Button>
              <Button size="sm" variant="ghost" onClick={() => step(1)} disabled={!visible.length}>
                ↓ Next
              </Button>
            </span>
          </div>
          <div ref={codeRef} className="max-h-[75vh] overflow-auto bg-white font-mono text-[13px] leading-6 [tab-size:4]">
            <div className="min-w-max py-2">
              {data.lines.map((text, i) => {
                const n = i + 1;
                const dot = gutter.get(n)?.tone;
                const bg = selected && n >= selected.start_line && n <= selected.end_line ? "bg-slate-50" : "bg-white";
                return (
                  <Fragment key={n}>
                    <div
                      data-line={n}
                      className={`flex ${bg}`}
                      style={{ contentVisibility: "auto", containIntrinsicSize: "auto 1.5rem" }}
                    >
                      <span className={`sticky left-0 flex w-14 shrink-0 items-center justify-end gap-1.5 pr-3 text-slate-400 select-none ${bg}`}>
                        {dot && <span className={`h-2 w-2 rounded-full ${dot.dot}`} />}
                        {n}
                      </span>
                      <span className="pr-6 whitespace-pre text-slate-800">
                        <LineContent text={text} segments={byLine.get(n)} selectedKey={selectedKey} onSelect={select} />
                      </span>
                    </div>
                    {n === selectedEndLine && <InlineAnnotation marker={selected} />}
                  </Fragment>
                );
              })}
            </div>
          </div>
        </Card>

        <Card className="flex max-h-[80vh] flex-col overflow-hidden">
          <h2 className="border-b border-slate-100 px-4 py-3 text-sm font-semibold">Issues by location</h2>
          <ul ref={listRef} className="flex-1 divide-y divide-slate-100 overflow-auto">
            {!visible.length && <li className="px-4 py-6 text-center text-sm text-slate-500">No highlighted issues.</li>}
            {visible.map((m) => {
              const sev = m.tone;
              const on = m.key === selectedKey;
              return (
                <li key={m.key} data-key={m.key}>
                  <button
                    type="button"
                    onClick={() => select(m.key, { scrollCode: true })}
                    className={`block w-full border-l-4 px-4 py-2.5 text-left transition ${sev.border} ${
                      on ? "bg-slate-100" : "hover:bg-slate-50"
                    }`}
                  >
                    <span className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="font-mono">
                        Ln {m.start_line}, Col {m.start_column}
                      </span>
                      {m.element && <code className="font-semibold text-brand-700">&lt;{m.element}&gt;</code>}
                      {m.attribute && <code className="text-slate-500">@{m.attribute}</code>}
                      {m.issues.length > 1 && <span className="ml-auto">{m.issues.length} issues</span>}
                    </span>
                    <span className={`mt-1 block text-sm ${on ? "" : "line-clamp-2"} ${sev.text}`}>
                      {m.issues[0].description}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      {unpositioned.length > 0 && (
        <Card className="p-5">
          <h2 className="text-sm font-semibold">Issues without a position ({unpositioned.length})</h2>
          <p className="mt-0.5 text-xs text-slate-500">These could not be placed on a tag in the current file.</p>
          <ul className="mt-3 space-y-2">
            {unpositioned.map((issue) => (
              <li
                key={issue.finding_key}
                className={`rounded-md border border-l-4 border-slate-200 px-3 py-2 ${
                  toneOf([issue], view).border
                }`}
              >
                <div className="flex items-start gap-3">
                  <IssueBadge issue={issue} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-800">{issue.description}</p>
                    <LinkDetail issue={issue} />
                    {(issue.xpath || issue.location) && (
                      <p className="mt-0.5 font-mono text-xs break-all text-slate-500">{issue.xpath || issue.location}</p>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
