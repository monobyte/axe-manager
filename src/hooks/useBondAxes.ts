import { useState, useEffect, useCallback } from 'react';
import type { Axe, CreateOrUpdateAxeRequest } from '../types/index.ts';
import { axeService } from '../services/mockAxeService.ts';

export function useBondAxes() {
  const [axes, setAxes] = useState<Axe[]>([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    setConnected(true);
    const unsubscribe = axeService.subscribe((newAxes) => {
      setAxes([...newAxes]);
    });
    return () => {
      unsubscribe();
      setConnected(false);
    };
  }, []);

  const createOrUpdateAxe = useCallback(async (request: CreateOrUpdateAxeRequest) => {
    return axeService.createOrUpdateAxe(request);
  }, []);

  const pauseAxe = useCallback(async (id: string) => {
    return axeService.pauseAxe(id);
  }, []);

  const resumeAxe = useCallback(async (id: string) => {
    return axeService.resumeAxe(id);
  }, []);

  const blockAxe = useCallback(async (id: string) => {
    return axeService.blockAxe(id);
  }, []);

  const unblockAxe = useCallback(async (id: string) => {
    return axeService.unblockAxe(id);
  }, []);

  const deleteAxe = useCallback(async (id: string) => {
    return axeService.deleteAxe(id);
  }, []);

  // For optimistic updates (V2/V3): directly mutate local state
  const setAxesOptimistic = useCallback((updater: (prev: Axe[]) => Axe[]) => {
    setAxes(updater);
  }, []);

  return {
    axes,
    connected,
    createOrUpdateAxe,
    pauseAxe,
    resumeAxe,
    blockAxe,
    unblockAxe,
    deleteAxe,
    setAxesOptimistic,
  };
}
