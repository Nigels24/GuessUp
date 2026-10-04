"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Loads data for a page and reloads when `deps` change. Responses that arrive
 * after a newer request started are ignored, so fast filter changes never show
 * stale rows.
 */
export function useLoad<T>(load: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const latest = useRef(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(load, deps);

  const reload = useCallback(async () => {
    const id = ++latest.current;
    setLoading(true);
    try {
      const result = await run();
      if (id === latest.current) {
        setData(result);
        setError("");
      }
    } catch (err) {
      if (id === latest.current) setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      if (id === latest.current) setLoading(false);
    }
  }, [run]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { data, error, loading, reload, setData };
}

/** A value that follows `value` after the user stops typing for `ms`. */
export function useDebounced<T>(value: T, ms = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}
