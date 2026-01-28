import type { Axe, AxeSide } from '../../../types/index.ts';

/** Extended Axe type for grid rows */
export interface AxeRow extends Axe {
  _isNew?: boolean;
}

/** Tracks pending edits per existing row: axeId -> { side?, quantity? } */
export type PendingEdits = Record<string, { side?: AxeSide; quantity?: number }>;
