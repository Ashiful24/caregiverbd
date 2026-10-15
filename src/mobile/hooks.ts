import { useCallback, useEffect, useRef, useState } from "react";
import { DEMO_DATA_EVENT } from "../mock";
import { MOBILE_REFRESH_EVENT } from "./api";

/**
 * Load data and keep it fresh: reloads after any write in this tab and whenever
 * another tab (admin panel, the other app) changes the shared demo data.
 */
export function useApi<T>(load: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const loadRef = useRef(load);
  loadRef.current = load;

  const reload = useCallback(async () => {
    try {
      const d = await loadRef.current();
      setData(d);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    const onChange = () => reload();
    window.addEventListener(DEMO_DATA_EVENT, onChange);
    window.addEventListener(MOBILE_REFRESH_EVENT, onChange);
    return () => {
      window.removeEventListener(DEMO_DATA_EVENT, onChange);
      window.removeEventListener(MOBILE_REFRESH_EVENT, onChange);
    };
  }, [reload]);

  return { data, error, loading, reload, setData };
}

/** Run a write action with a busy flag and toast-friendly error. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const run = useCallback(async <T,>(fn: () => Promise<T>, onError?: (msg: string) => void): Promise<T | undefined> => {
    setBusy(true);
    try {
      return await fn();
    } catch (e) {
      onError?.(e instanceof Error ? e.message : "Something went wrong");
      return undefined;
    } finally {
      setBusy(false);
    }
  }, []);
  return { busy, run };
}
