import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { useSnapshot } from "../context/SnapshotContext";
import { moduleByKey } from "../modules";
import { Alert, Button, ButtonLink, Card, SEVERITY, SEVERITY_ORDER, SeverityBadge, Spinner, fmt } from "../components/ui";

const markerKey = (m) => `${m.start_line}:${m.start_column}`;

/**
 * Markers narrowed to the visible severities, each with the per-line ranges it covers.
 * API columns are 1-based code-point indexes; ranges here are 0-based, end exclusive.
 */
function buildView(markers, active) {
  const visible = [];
  const byLine = new Map();
  for (const m of markers) {
    const issues = m.issues.filter((i) => active.has(i.severity));
    if (!issues.length) continue;
    const severity = SEVERITY_ORDER.find((s) => issues.some((i) => i.severity === s)) || m.severity;
    const view = { ...m, key: markerKey(m), issues, severity };
    visible.push(view);
    for (let ln = m.start_line; ln <= m.end_line; ln++) {
      const start = ln === m.start_line ? m.start_column - 1 : 0;
      const end = ln === m.end_line ? m.end_column - 1 : Infinity;
      if (!byLine.has(ln)) byLine.set(ln, []);
      byLine.get(ln).push({ start, end, marker: view });
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
      const sev = SEVERITY[seg.marker.severity] || SEVERITY.info;
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

function IssueDetails({ issues }) {
  return (
    <ul className="divide-y divide-slate-100">
      {issues.map((issue) => (
        <li key={issue.finding_key} className="flex gap-3 py-2">
          <SeverityBadge severity={issue.severity} />
          <div className="min-w-0 flex-1">
            <p className="text-sm text-slate-800">{issue.description}</p>
            <p className="mt-0.5 font-mono text-xs text-slate-500">
              {issue.rule_code && `${issue.rule_code} · `}
              {issue.schematron}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Popover shown under the selected marker's last line. */
function InlineAnnotation({ marker }) {
  const sev = SEVERITY[marker.severity] || SEVERITY.info;
  return (
    <div className="sticky left-0 w-[min(48rem,calc(100vw-4rem))] py-1.5 pl-14 font-sans whitespace-normal">
      <div className={`rounded-md border border-l-4 border-slate-200 bg-white px-3 shadow-sm ${sev.border}`}>
        <IssueDetails issues={marker.issues} />
      </div>
    </div>
  );
}

function SeverityFilter({ counts, active, onToggle }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {SEVERITY_ORDER.map((s) => {
        const on = active.has(s);
        return (
          <button
            key={s}
            type="button"
            onClick={() => onToggle(s)}
            aria-pressed={on}
            className={`rounded-lg border px-4 py-3 text-left transition ${
              on ? "border-slate-200 bg-white" : "border-dashed border-slate-200 bg-slate-50 opacity-50"
            }`}
          >
            <span className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${SEVERITY[s].dot}`} />
              <span className={`text-2xl font-bold ${SEVERITY[s].text}`}>{fmt(counts?.[s] ?? 0)}</span>
            </span>
            <span className="mt-0.5 block text-sm text-slate-500">{SEVERITY[s].label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default function FileErrorsPage({ moduleKey }) {
  const module = moduleByKey(moduleKey);
  const { fileId } = useParams();
  const [searchParams] = useSearchParams();
  const { snapshotId } = useSnapshot();

  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState(() => new Set(SEVERITY_ORDER));
  const [selectedKey, setSelectedKey] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);
  const codeRef = useRef(null);
  const listRef = useRef(null);

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

  const { visible, byLine } = useMemo(() => buildView(data?.markers || [], active), [data, active]);
  const unpositioned = useMemo(
    () => (data?.unpositioned || []).filter((i) => active.has(i.severity)),
    [data, active]
  );
  const selected = visible.find((m) => m.key === selectedKey) || null;
  const selectedIndex = selected ? visible.indexOf(selected) : -1;

  // Severity of the most severe marker starting on each line, for the gutter dot.
  const gutter = useMemo(() => {
    const map = new Map();
    for (const m of visible) {
      const prev = map.get(m.start_line);
      if (!prev || SEVERITY_ORDER.indexOf(m.severity) < SEVERITY_ORDER.indexOf(prev)) map.set(m.start_line, m.severity);
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

  function toggle(severity) {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(severity)) next.delete(severity);
      else next.add(severity);
      return next;
    });
  }

  function step(delta) {
    if (!visible.length) return;
    const i = selectedIndex < 0 ? (delta > 0 ? 0 : visible.length - 1) : (selectedIndex + delta + visible.length) % visible.length;
    select(visible[i].key, { scrollCode: true });
  }

  const backLink = (
    <ButtonLink variant="secondary" to={module.path}>
      ← {module.title}
    </ButtonLink>
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
            {fmt(data.total_issues)} pending issue{data.total_issues === 1 ? "" : "s"} · {fmt(data.lines.length)} lines
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

      <SeverityFilter counts={data.counts} active={active} onToggle={toggle} />

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
                const dot = gutter.get(n);
                const bg = selected && n >= selected.start_line && n <= selected.end_line ? "bg-slate-50" : "bg-white";
                return (
                  <Fragment key={n}>
                    <div
                      data-line={n}
                      className={`flex ${bg}`}
                      style={{ contentVisibility: "auto", containIntrinsicSize: "auto 1.5rem" }}
                    >
                      <span className={`sticky left-0 flex w-14 shrink-0 items-center justify-end gap-1.5 pr-3 text-slate-400 select-none ${bg}`}>
                        {dot && <span className={`h-2 w-2 rounded-full ${SEVERITY[dot].dot}`} />}
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
              const sev = SEVERITY[m.severity] || SEVERITY.info;
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
                className={`rounded-md border border-l-4 border-slate-200 px-3 py-2 ${(SEVERITY[issue.severity] || SEVERITY.info).border}`}
              >
                <div className="flex items-start gap-3">
                  <SeverityBadge severity={issue.severity} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-800">{issue.description}</p>
                    <p className="mt-0.5 font-mono text-xs break-all text-slate-500">
                      {issue.rule_code && `${issue.rule_code} · `}
                      {issue.schematron}
                      {(issue.xpath || issue.location) && ` · ${issue.xpath || issue.location}`}
                    </p>
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
