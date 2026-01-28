import { useState, useEffect, useMemo, useCallback } from 'react';
import type { BondInstrument } from '../types/index.ts';
import { fetchInstruments } from '../services/mockInstrumentService.ts';

export function useBondInstruments() {
  const [instruments, setInstruments] = useState<BondInstrument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchInstruments()
      .then((data) => {
        if (!cancelled) {
          setInstruments(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const searchInstruments = useCallback(
    (query: string): BondInstrument[] => {
      if (!query || query.length < 2) return [];
      const lower = query.toLowerCase();
      return instruments
        .filter(
          (i) =>
            i.isin.toLowerCase().includes(lower) ||
            i.description.toLowerCase().includes(lower)
        )
        .slice(0, 50);
    },
    [instruments]
  );

  const getInstrument = useCallback(
    (isin: string): BondInstrument | undefined => {
      return instruments.find((i) => i.isin === isin);
    },
    [instruments]
  );

  return { instruments, loading, error, searchInstruments, getInstrument };
}
