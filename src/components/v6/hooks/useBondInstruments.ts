import { useState, useEffect, useCallback } from 'react';
import type { BondInstrument } from '../../../types/index.ts';
import { mockInstruments } from '../../../services/mockData.ts';

const SIMULATED_DELAY_MS = 300;

export function useBondInstruments() {
  const [instruments, setInstruments] = useState<BondInstrument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadInstruments = async () => {
      try {
        setIsLoading(true);
        // Simulate network delay
        await new Promise((resolve) => setTimeout(resolve, SIMULATED_DELAY_MS));
        if (!cancelled) {
          setInstruments(mockInstruments);
          setIsLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error('Failed to load instruments'));
          setIsLoading(false);
        }
      }
    };

    loadInstruments();

    return () => {
      cancelled = true;
    };
  }, []);

  const findInstrument = useCallback(
    (isin: string): BondInstrument | undefined => {
      return instruments.find((i) => i.isin === isin);
    },
    [instruments]
  );

  return { instruments, isLoading, error, findInstrument };
}
