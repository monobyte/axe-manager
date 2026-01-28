import type { BondInstrument } from '../types/index.ts';

const issuers = [
  'US Treasury', 'Germany', 'France', 'Italy', 'Spain', 'UK Gilt',
  'Japan', 'Canada', 'Australia', 'Netherlands', 'Belgium', 'Austria',
  'Goldman Sachs', 'JP Morgan', 'Morgan Stanley', 'Citigroup',
  'Bank of America', 'HSBC', 'Deutsche Bank', 'Barclays',
  'Apple Inc', 'Microsoft', 'Amazon', 'Google', 'Meta',
  'Toyota Motor', 'Volkswagen', 'BMW', 'Daimler',
  'EDF', 'Enel', 'Total', 'Shell', 'BP',
];

const bondTypes = [
  'Senior Unsecured', 'Subordinated', 'Covered Bond', 'Green Bond',
  'Sustainability Bond', 'Floating Rate Note', 'Zero Coupon',
  'Inflation Linked', 'Callable', 'Fixed Rate',
];

function generateISIN(index: number): string {
  const countries = ['US', 'DE', 'FR', 'IT', 'ES', 'GB', 'JP', 'CA', 'AU', 'NL', 'BE', 'AT'];
  const country = countries[index % countries.length];
  const num = String(index).padStart(9, '0');
  return `${country}${num}0`;
}

function generateMaturity(index: number): string {
  const baseYear = 2025;
  const year = baseYear + (index % 30) + 1;
  const month = (index % 12) + 1;
  const day = (index % 28) + 1;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function generateCoupon(index: number): string {
  const coupon = (0.25 + (index % 60) * 0.125).toFixed(3);
  return `${coupon}%`;
}

export function generateInstruments(count: number = 15000): BondInstrument[] {
  const instruments: BondInstrument[] = [];

  for (let i = 0; i < count; i++) {
    const issuer = issuers[i % issuers.length];
    const bondType = bondTypes[i % bondTypes.length];
    const maturity = generateMaturity(i);
    const coupon = generateCoupon(i);
    const isin = generateISIN(i);

    instruments.push({
      isin,
      description: `${issuer} ${coupon} ${maturity.slice(0, 4)} ${bondType}`,
      maturity,
      issuer,
    });
  }

  return instruments;
}

export const mockInstruments = generateInstruments(15000);
