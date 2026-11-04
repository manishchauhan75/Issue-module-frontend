import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { MODULES } from "../modules";

const STORAGE_KEY = "metr-issues:snapshot";
const SnapshotContext = createContext(null);

const EMPTY = { snapshotId: "", workspacePath: "", results: {}, errors: {}, updatedAt: null };

function load() {
  try {
    return { ...EMPTY, ...JSON.parse(localStorage.getItem(STORAGE_KEY)) };
  } catch {
    return EMPTY;
  }
}

export function SnapshotProvider({ children }) {
  const [state, setState] = useState(load);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // storage unavailable; state still lives in memory
    }
  }, [state]);

  /** Validate every enabled module; returns {results, errors} keyed by module. */
  const runValidation = useCallback(async ({ snapshotId, workspacePath, mode = "normal", only }) => {
    const targets = MODULES.filter((m) => m.enabled && (!only || only.includes(m.key)));
    setRunning(true);
    try {
      const settled = await Promise.allSettled(
        targets.map((m) => m.validate({ snapshotId, workspacePath, mode }))
      );
      const results = {};
      const errors = {};
      settled.forEach((s, i) => {
        const key = targets[i].key;
        if (s.status === "fulfilled") results[key] = s.value;
        else errors[key] = s.reason?.message || "Validation failed.";
      });
      setState((prev) => {
        const sameSnapshot = prev.snapshotId === snapshotId;
        const keep = (obj) => (sameSnapshot ? obj : {});
        const nextErrors = { ...keep(prev.errors), ...errors };
        Object.keys(results).forEach((k) => delete nextErrors[k]);
        return {
          snapshotId,
          workspacePath,
          results: { ...keep(prev.results), ...results },
          errors: nextErrors,
          updatedAt: new Date().toISOString(),
        };
      });
      return { results, errors };
    } finally {
      setRunning(false);
    }
  }, []);

  const clear = useCallback(() => setState(EMPTY), []);

  return (
    <SnapshotContext.Provider value={{ ...state, running, runValidation, clear }}>
      {children}
    </SnapshotContext.Provider>
  );
}

export function useSnapshot() {
  const ctx = useContext(SnapshotContext);
  if (!ctx) throw new Error("useSnapshot must be used inside SnapshotProvider");
  return ctx;
}
