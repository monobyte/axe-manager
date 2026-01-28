import type { BondInstrument } from '../types/index.ts';
import { mockInstruments } from './mockData.ts';

const SIMULATED_DELAY_MS = 500;

export async function fetchInstruments(): Promise<BondInstrument[]> {
  await new Promise((resolve) => setTimeout(resolve, SIMULATED_DELAY_MS));
  return mockInstruments;
}
