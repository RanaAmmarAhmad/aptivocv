// Per-thread export history persisted in localStorage. Lets the chat view
// list previous downloads and re-download the same message in the same
// format with one click.

import { useEffect, useState, useCallback } from "react";

export type ExportFormat = "pdf" | "docx";

export type ExportHistoryEntry = {
  id: string;
  at: number; // epoch ms
  messageId: string;
  format: ExportFormat;
  cvName: string;
  jdPreview: string; // first ~80 chars of the JD prompt for context
};

const MAX_PER_THREAD = 20;
const key = (threadId: string) => `aptivo:export-history:${threadId}`;

function safeRead(threadId: string): ExportHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key(threadId));
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as ExportHistoryEntry[]) : [];
  } catch {
    return [];
  }
}

function safeWrite(threadId: string, entries: ExportHistoryEntry[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key(threadId), JSON.stringify(entries));
    window.dispatchEvent(
      new CustomEvent("aptivo:export-history-change", { detail: { threadId } }),
    );
  } catch {
    /* quota / privacy mode */
  }
}

export function recordExport(
  threadId: string,
  entry: Omit<ExportHistoryEntry, "id" | "at">,
): ExportHistoryEntry {
  const list = safeRead(threadId);
  const full: ExportHistoryEntry = {
    ...entry,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: Date.now(),
  };
  const next = [full, ...list].slice(0, MAX_PER_THREAD);
  safeWrite(threadId, next);
  return full;
}

export function getExportHistory(threadId: string): ExportHistoryEntry[] {
  return safeRead(threadId);
}

export function clearExportHistory(threadId: string) {
  safeWrite(threadId, []);
}

export function removeExportEntry(threadId: string, entryId: string) {
  safeWrite(
    threadId,
    safeRead(threadId).filter((e) => e.id !== entryId),
  );
}

export function useExportHistory(threadId: string) {
  const [entries, setEntries] = useState<ExportHistoryEntry[]>(() =>
    safeRead(threadId),
  );
  useEffect(() => {
    setEntries(safeRead(threadId));
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<{ threadId: string }>).detail;
      if (!detail || detail.threadId === threadId) setEntries(safeRead(threadId));
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === key(threadId)) setEntries(safeRead(threadId));
    };
    window.addEventListener("aptivo:export-history-change", onChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("aptivo:export-history-change", onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, [threadId]);
  const clear = useCallback(() => clearExportHistory(threadId), [threadId]);
  const remove = useCallback(
    (id: string) => removeExportEntry(threadId, id),
    [threadId],
  );
  return { entries, clear, remove };
}