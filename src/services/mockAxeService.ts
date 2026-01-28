import { v4 as uuidv4 } from 'uuid';
import type { Axe, AxeStatus, CreateOrUpdateAxeRequest } from '../types/index.ts';
import { mockInstruments } from './mockData.ts';

type AxeListener = (axes: Axe[]) => void;

const SIMULATED_DELAY_MS = 300;

class MockAxeService {
  private axes: Map<string, Axe> = new Map();
  private listeners: Set<AxeListener> = new Set();

  subscribe(listener: AxeListener): () => void {
    this.listeners.add(listener);
    // Immediately send current state
    listener(this.getAxesArray());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private getAxesArray(): Axe[] {
    return Array.from(this.axes.values());
  }

  private broadcast(): void {
    const axes = this.getAxesArray();
    this.listeners.forEach((listener) => listener(axes));
  }

  private findInstrument(isin: string) {
    return mockInstruments.find((i) => i.isin === isin);
  }

  async createOrUpdateAxe(request: CreateOrUpdateAxeRequest): Promise<Axe> {
    await this.simulateDelay();

    const instrument = this.findInstrument(request.isin);
    if (!instrument) {
      throw new Error(`Instrument not found: ${request.isin}`);
    }

    const isUpdate = !!request.id && this.axes.has(request.id);
    const id = request.id ?? uuidv4();

    const existing = isUpdate ? this.axes.get(id) : undefined;

    const axe: Axe = {
      id,
      isin: instrument.isin,
      description: instrument.description,
      maturity: instrument.maturity,
      issuer: instrument.issuer,
      side: request.side,
      quantity: request.quantity,
      status: existing?.status ?? 'ACTIVE',
      lastUpdate: new Date().toISOString(),
    };

    this.axes.set(id, axe);
    this.broadcast();
    return axe;
  }

  async pauseAxe(id: string): Promise<void> {
    await this.simulateDelay();
    this.setStatus(id, 'PAUSED');
  }

  async resumeAxe(id: string): Promise<void> {
    await this.simulateDelay();
    this.setStatus(id, 'ACTIVE');
  }

  async blockAxe(id: string): Promise<void> {
    await this.simulateDelay();
    this.setStatus(id, 'BLOCKED');
  }

  async unblockAxe(id: string): Promise<void> {
    await this.simulateDelay();
    this.setStatus(id, 'ACTIVE');
  }

  async deleteAxe(id: string): Promise<void> {
    await this.simulateDelay();
    if (!this.axes.has(id)) {
      throw new Error(`Axe not found: ${id}`);
    }
    this.axes.delete(id);
    this.broadcast();
  }

  private setStatus(id: string, status: AxeStatus): void {
    const axe = this.axes.get(id);
    if (!axe) {
      throw new Error(`Axe not found: ${id}`);
    }
    axe.status = status;
    axe.lastUpdate = new Date().toISOString();
    this.broadcast();
  }

  private simulateDelay(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, SIMULATED_DELAY_MS));
  }
}

// Singleton instance
export const axeService = new MockAxeService();
