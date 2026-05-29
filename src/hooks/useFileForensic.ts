import { useCallback, useEffect, useState } from "react";
import {
  fetchFileEvidence,
  type FileEvidence,
} from "../lib/file-forensic-data";
import type { ForensicScope } from "../lib/forensic-scope";

/* useFileForensic — spec v0.1.2 L4 §11 commit 2.
 *
 * Centralised state for the bottom sheet:
 *   - scope (drives the data fetch)
 *   - rows + loading state
 *   - polling every 60s while open (spec §3.6)
 *   - column mode (curated 5 vs all 11) — persisted per user
 *   - manual refresh
 */

const COL_MODE_KEY = "ccymgmt.forensicShowAll.v1";
const POLL_MS = 60_000;

function loadColMode(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(COL_MODE_KEY) === "1";
  } catch {
    return false;
  }
}

function saveColMode(showAll: boolean) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(COL_MODE_KEY, showAll ? "1" : "0");
  } catch {
    /* non-fatal */
  }
}

export interface UseFileForensicResult {
  scope: ForensicScope | null;
  open: (scope: ForensicScope) => void;
  close: () => void;
  rows: FileEvidence[];
  loading: boolean;
  lastPolledAt: string | null;
  refresh: () => void;
  showAllFields: boolean;
  toggleShowAllFields: () => void;
}

export function useFileForensic(): UseFileForensicResult {
  const [scope, setScope] = useState<ForensicScope | null>(null);
  const [rows, setRows] = useState<FileEvidence[]>([]);
  const [loading, setLoading] = useState(false);
  const [lastPolledAt, setLastPolledAt] = useState<string | null>(null);
  const [showAllFields, setShowAllFields] = useState<boolean>(() => loadColMode());

  const fetchRows = useCallback((s: ForensicScope) => {
    setLoading(true);
    return fetchFileEvidence(s).then((r) => {
      setRows(r);
      setLastPolledAt(new Date().toISOString());
      setLoading(false);
      return r;
    });
  }, []);

  const open = useCallback(
    (s: ForensicScope) => {
      setScope(s);
      void fetchRows(s);
    },
    [fetchRows],
  );

  const close = useCallback(() => {
    setScope(null);
    setRows([]);
    setLastPolledAt(null);
  }, []);

  const refresh = useCallback(() => {
    if (scope) void fetchRows(scope);
  }, [scope, fetchRows]);

  // Spec §3.6 — poll every 60s while open.
  useEffect(() => {
    if (!scope) return;
    const id = window.setInterval(() => {
      void fetchRows(scope);
    }, POLL_MS);
    return () => window.clearInterval(id);
  }, [scope, fetchRows]);

  const toggleShowAllFields = useCallback(() => {
    setShowAllFields((prev) => {
      const next = !prev;
      saveColMode(next);
      return next;
    });
  }, []);

  return {
    scope,
    open,
    close,
    rows,
    loading,
    lastPolledAt,
    refresh,
    showAllFields,
    toggleShowAllFields,
  };
}
