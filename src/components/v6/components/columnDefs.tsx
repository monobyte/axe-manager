import type { ColDef, ICellRendererParams } from 'ag-grid-community';
import type { Axe, BondInstrument } from '../../../types/index.ts';
import { StatusBadge } from '../../shared/StatusBadge.tsx';
import { ActionsRenderer, type ActionsRendererProps } from './ActionsRenderer.tsx';
import { InstrumentSearchEditor } from './InstrumentSearchEditor.tsx';
import type { AxeRow, PendingEdits } from './types.ts';

export interface ColumnDefsParams {
  instruments: BondInstrument[];
  pendingEditsRef: React.RefObject<PendingEdits>;
  onSelectInstrument: (rowId: string | undefined, instrument: BondInstrument) => void;
  onPauseResume: (axe: Axe) => void;
  onBlockUnblock: (axe: Axe) => void;
  onDelete: (axe: Axe) => void;
  onSaveRow: (axe: Axe) => void;
  onRevertRow: (axe: Axe) => void;
  onCreatePinned: () => void;
  onClearPinned: () => void;
  pendingEdits: PendingEdits;
}

export function createColumnDefs(params: ColumnDefsParams): ColDef<AxeRow>[] {
  const {
    instruments,
    pendingEditsRef,
    onSelectInstrument,
    onPauseResume,
    onBlockUnblock,
    onDelete,
    onSaveRow,
    onRevertRow,
    onCreatePinned,
    onClearPinned,
    pendingEdits,
  } = params;

  return [
    {
      field: 'isin',
      headerName: 'ISIN / Bond',
      width: 200,
      editable: (p) => p.node.rowPinned === 'top',
      cellEditor: InstrumentSearchEditor,
      cellEditorParams: () => ({ instruments, onSelectInstrument }),
      cellEditorPopup: true,
    },
    {
      field: 'description',
      headerName: 'Description',
      flex: 1,
      minWidth: 200,
    },
    {
      field: 'side',
      headerName: 'Side',
      width: 100,
      editable: (p) => (p.node.rowPinned === 'top' ? !!p.data?.isin : true),
      cellEditor: 'agSelectCellEditor',
      cellEditorParams: { values: ['Bid', 'Offer'] },
      valueFormatter: (p) => {
        if (p.node?.rowPinned === 'top' && !p.data?.isin) return '';
        return p.value ?? '';
      },
      cellStyle: (p) => {
        if (p.node?.rowPinned === 'top') return { backgroundColor: '#eef6ff' };
        if (p.data && pendingEditsRef.current?.[p.data.id]?.side !== undefined) {
          return { backgroundColor: '#fffbeb' };
        }
        return null;
      },
    },
    {
      field: 'quantity',
      headerName: 'Quantity',
      width: 140,
      editable: (p) => (p.node.rowPinned === 'top' ? !!p.data?.isin : true),
      cellEditor: 'agNumberCellEditor',
      valueFormatter: (p) =>
        p.node?.rowPinned === 'top' && !p.data?.isin
          ? ''
          : p.value != null && p.value !== 0
            ? Number(p.value).toLocaleString()
            : '',
      cellStyle: (p) => {
        if (p.node?.rowPinned === 'top') return { backgroundColor: '#eef6ff' };
        if (p.data && pendingEditsRef.current?.[p.data.id]?.quantity !== undefined) {
          return { backgroundColor: '#fffbeb' };
        }
        return null;
      },
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 110,
      cellRenderer: (p: ICellRendererParams<AxeRow>) => {
        if (p.node?.rowPinned === 'top') {
          return p.data?.isin ? 'NEW' : '';
        }
        if (!p.value) return null;
        return <StatusBadge status={p.value} />;
      },
    },
    {
      field: 'lastUpdate',
      headerName: 'Last Update',
      width: 180,
      valueFormatter: (p) => (p.value ? new Date(p.value).toLocaleString() : ''),
    },
    {
      headerName: 'Actions',
      width: 160,
      sortable: false,
      filter: false,
      cellRenderer: ActionsRenderer,
      cellRendererParams: {
        onPauseResume,
        onBlockUnblock,
        onDelete,
        onSaveRow,
        onRevertRow,
        onCreatePinned,
        onClearPinned,
        pendingEdits,
      } satisfies Partial<ActionsRendererProps>,
    },
  ];
}
