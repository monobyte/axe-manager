export interface BondInstrument {
  isin: string;
  description: string;
  maturity: string;
  issuer: string;
}

export type AxeStatus = 'ACTIVE' | 'PAUSED' | 'BLOCKED';
export type AxeSide = 'Bid' | 'Offer';

export interface Axe {
  id: string;
  isin: string;
  description: string;
  maturity: string;
  issuer: string;
  side: AxeSide;
  quantity: number;
  status: AxeStatus;
  lastUpdate: string;
}

export interface CreateOrUpdateAxeRequest {
  id?: string;
  isin: string;
  side: AxeSide;
  quantity: number;
}
