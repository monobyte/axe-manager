export const PINNED_ROW_ID = 'pinned-new-axe';

/** Default values for new axe row */
export const DEFAULT_PINNED_ROW = {
  id: PINNED_ROW_ID,
  isin: '',
  description: '',
  maturity: '',
  issuer: '',
  side: 'Bid' as const,
  quantity: 1000000,
  status: 'ACTIVE' as const,
  lastUpdate: '',
  _isNew: true,
};
