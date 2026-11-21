import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';

/** Small data-fetching hook with loading/error/refetch semantics. */
export function useApi<T>(path: string | null, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(path));
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const load = useCallback(async () => {
    if (!path) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await api.get<T>(path);
      if (mounted.current) setData(result);
    } catch (err: any) {
      if (mounted.current) setError(err?.message ?? 'Unable to load data');
    } finally {
      if (mounted.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps]);

  useEffect(() => {
    void load();
  }, [load]);

  return { data, loading, error, refetch: load, setData };
}
