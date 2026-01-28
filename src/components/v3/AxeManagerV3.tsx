import { useState, useCallback, useMemo, useRef } from 'react';
import {
  Stack,
  ActionIcon,
  Tooltip,
  Group,
  Button,
  Paper,
  Text,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef, CellValueChangedEvent, ICellRendererParams, ICellEditorParams } from 'ag-grid-community';
import { AllCommunityModule } from 'ag-grid-community';
import {
  IconPlayerPause,
  IconPlayerPlay,
  IconLock,
  IconLockOpen,
  IconTrash,
  IconPlus,
  IconX,
  IconCheck,
} from '@tabler/icons-react';
import { v4 as uuidv4 } from 'uuid';
import { useBondInstruments } from '../../hooks/useBondInstruments.ts';
import { useBondAxes } from '../../hooks/useBondAxes.ts';
import { StatusBadge } from '../shared/StatusBadge.tsx';
import type { Axe, AxeSide, AxeStatus, BondInstrument } from '../../types/index.ts';

// Extended Axe type for the "new row" placeholder
interface AxeRow extends Axe {
  _isNew?: boolean;
}

function ActionsRenderer(
  props: ICellRendererParams<AxeRow> & {
    onPauseResume: (axe: Axe) => void;
    onBlockUnblock: (axe: Axe) => void;
    onDelete: (axe: Axe) => void;
    onConfirmNew: (axe: AxeRow) => void;
    onCancelNew: (id: string) => void;
  }
) {
  const axe = props.data;
  if (!axe) return null;

  if (axe._isNew) {
    return (
      <Group gap={4} wrap="nowrap" align="center" style={{ height: '100%' }}>
        <Tooltip label="Confirm">
          <ActionIcon size="sm" color="green" variant="subtle" onClick={() => props.onConfirmNew(axe)}>
            <IconCheck size={16} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Cancel">
          <ActionIcon size="sm" color="red" variant="subtle" onClick={() => props.onCancelNew(axe.id)}>
            <IconX size={16} />
          </ActionIcon>
        </Tooltip>
      </Group>
    );
  }

  return (
    <Group gap={4} wrap="nowrap" align="center" style={{ height: '100%' }}>
      {axe.status === 'PAUSED' ? (
        <Tooltip label="Resume">
          <ActionIcon size="sm" color="green" variant="subtle" onClick={() => props.onPauseResume(axe)}>
            <IconPlayerPlay size={16} />
          </ActionIcon>
        </Tooltip>
      ) : axe.status !== 'BLOCKED' ? (
        <Tooltip label="Pause">
          <ActionIcon size="sm" color="yellow" variant="subtle" onClick={() => props.onPauseResume(axe)}>
            <IconPlayerPause size={16} />
          </ActionIcon>
        </Tooltip>
      ) : null}

      {axe.status === 'BLOCKED' ? (
        <Tooltip label="Unblock">
          <ActionIcon size="sm" color="green" variant="subtle" onClick={() => props.onBlockUnblock(axe)}>
            <IconLockOpen size={16} />
          </ActionIcon>
        </Tooltip>
      ) : axe.status !== 'PAUSED' ? (
        <Tooltip label="Block">
          <ActionIcon size="sm" color="red" variant="subtle" onClick={() => props.onBlockUnblock(axe)}>
            <IconLock size={16} />
          </ActionIcon>
        </Tooltip>
      ) : null}

      <Tooltip label="Delete">
        <ActionIcon size="sm" color="red" variant="subtle" onClick={() => props.onDelete(axe)}>
          <IconTrash size={16} />
        </ActionIcon>
      </Tooltip>
    </Group>
  );
}

// Custom cell editor for bond instrument search
import { forwardRef, useImperativeHandle, useEffect } from 'react';

const InstrumentSearchEditor = forwardRef((props: ICellEditorParams & { instruments: BondInstrument[] }, ref) => {
  const [value, setValue] = useState(props.value || '');
  const [suggestions, setSuggestions] = useState<BondInstrument[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({
    getValue: () => value,
    isCancelAfterEnd: () => false,
  }));

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setValue(v);
    if (v.length >= 2) {
      const lower = v.toLowerCase();
      const filtered = props.instruments
        .filter((i) => i.isin.toLowerCase().includes(lower) || i.description.toLowerCase().includes(lower))
        .slice(0, 20);
      setSuggestions(filtered);
      setShowSuggestions(true);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleSelect = (instrument: BondInstrument) => {
    setValue(instrument.isin);
    setShowSuggestions(false);
    // Store the full instrument data on the row via the node
    if (props.node?.data) {
      props.node.data.isin = instrument.isin;
      props.node.data.description = instrument.description;
      props.node.data.maturity = instrument.maturity;
      props.node.data.issuer = instrument.issuer;
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <input
        ref={inputRef}
        value={value}
        onChange={handleChange}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          outline: 'none',
          padding: '0 8px',
          fontSize: '14px',
        }}
        placeholder="Search ISIN or Description..."
      />
      {showSuggestions && suggestions.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            maxHeight: 200,
            overflowY: 'auto',
            background: 'white',
            border: '1px solid #ddd',
            borderRadius: 4,
            zIndex: 1000,
            boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
          }}
        >
          {suggestions.map((inst) => (
            <div
              key={inst.isin}
              onClick={() => handleSelect(inst)}
              style={{
                padding: '6px 8px',
                cursor: 'pointer',
                fontSize: '13px',
                borderBottom: '1px solid #f0f0f0',
              }}
              onMouseEnter={(e) => {
                (e.target as HTMLDivElement).style.background = '#f5f5f5';
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLDivElement).style.background = 'white';
              }}
            >
              <strong>{inst.isin}</strong> — {inst.description}
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

InstrumentSearchEditor.displayName = 'InstrumentSearchEditor';

export function AxeManagerV3() {
  const { instruments, loading: instrumentsLoading } = useBondInstruments();
  const {
    axes,
    createOrUpdateAxe,
    pauseAxe,
    resumeAxe,
    blockAxe,
    unblockAxe,
    deleteAxe,
    setAxesOptimistic,
  } = useBondAxes();

  const gridRef = useRef<AgGridReact>(null);
  const [newRows, setNewRows] = useState<AxeRow[]>([]);

  // Combined row data: new rows at top + existing axes
  const rowData = useMemo<AxeRow[]>(() => {
    return [...newRows, ...axes.map((a) => ({ ...a, _isNew: false }))];
  }, [newRows, axes]);

  const addNewRow = useCallback(() => {
    const newRow: AxeRow = {
      id: uuidv4(),
      isin: '',
      description: '',
      maturity: '',
      issuer: '',
      side: 'Bid',
      quantity: 1000000,
      status: 'ACTIVE',
      lastUpdate: '',
      _isNew: true,
    };
    setNewRows((prev) => [...prev, newRow]);
  }, []);

  const cancelNewRow = useCallback((id: string) => {
    setNewRows((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const confirmNewRow = useCallback(
    (axe: AxeRow) => {
      if (!axe.isin) {
        notifications.show({ title: 'Validation', message: 'Please select a bond instrument', color: 'orange' });
        return;
      }
      if (!axe.quantity || axe.quantity <= 0) {
        notifications.show({ title: 'Validation', message: 'Please enter a valid quantity', color: 'orange' });
        return;
      }

      // Remove from new rows
      setNewRows((prev) => prev.filter((r) => r.id !== axe.id));

      // Optimistic: add to axes
      const optimisticAxe: Axe = {
        id: axe.id,
        isin: axe.isin,
        description: axe.description,
        maturity: axe.maturity,
        issuer: axe.issuer,
        side: axe.side,
        quantity: axe.quantity,
        status: 'ACTIVE',
        lastUpdate: new Date().toISOString(),
      };
      setAxesOptimistic((prev) => [optimisticAxe, ...prev]);

      createOrUpdateAxe({
        isin: axe.isin,
        side: axe.side,
        quantity: axe.quantity,
      })
        .then(() => {
          notifications.show({ title: 'Success', message: 'Axe created', color: 'green' });
        })
        .catch((err) => {
          notifications.show({ title: 'Error', message: err.message || 'Failed to create axe', color: 'red' });
          // Rollback
          setAxesOptimistic((prev) => prev.filter((a) => a.id !== axe.id));
        });
    },
    [createOrUpdateAxe, setAxesOptimistic]
  );

  const onCellValueChanged = useCallback(
    (event: CellValueChangedEvent<AxeRow>) => {
      const axe = event.data;
      if (!axe) return;

      // If it's a new row, just update local state
      if (axe._isNew) {
        setNewRows((prev) => prev.map((r) => (r.id === axe.id ? { ...axe } : r)));
        return;
      }

      // Optimistic update for existing rows
      setAxesOptimistic((prev) =>
        prev.map((a) =>
          a.id === axe.id ? { ...axe, _isNew: undefined, lastUpdate: new Date().toISOString() } as Axe : a
        )
      );

      createOrUpdateAxe({
        id: axe.id,
        isin: axe.isin,
        side: axe.side,
        quantity: axe.quantity,
      })
        .then(() => {
          notifications.show({ title: 'Success', message: 'Axe updated', color: 'green' });
        })
        .catch((err) => {
          notifications.show({ title: 'Error', message: err.message || 'Failed to update', color: 'red' });
        });
    },
    [createOrUpdateAxe, setAxesOptimistic]
  );

  const handlePauseResume = useCallback(
    (axe: Axe) => {
      const isPaused = axe.status === 'PAUSED';
      const newStatus: AxeStatus = isPaused ? 'ACTIVE' : 'PAUSED';

      setAxesOptimistic((prev) =>
        prev.map((a) =>
          a.id === axe.id ? { ...a, status: newStatus, lastUpdate: new Date().toISOString() } : a
        )
      );

      const action = isPaused ? resumeAxe : pauseAxe;
      action(axe.id)
        .then(() => {
          notifications.show({ title: 'Success', message: `Axe ${isPaused ? 'resumed' : 'paused'}`, color: 'green' });
        })
        .catch((err) => {
          notifications.show({ title: 'Error', message: err.message, color: 'red' });
        });
    },
    [pauseAxe, resumeAxe, setAxesOptimistic]
  );

  const handleBlockUnblock = useCallback(
    (axe: Axe) => {
      const isBlocked = axe.status === 'BLOCKED';
      const newStatus: AxeStatus = isBlocked ? 'ACTIVE' : 'BLOCKED';

      setAxesOptimistic((prev) =>
        prev.map((a) =>
          a.id === axe.id ? { ...a, status: newStatus, lastUpdate: new Date().toISOString() } : a
        )
      );

      const action = isBlocked ? unblockAxe : blockAxe;
      action(axe.id)
        .then(() => {
          notifications.show({ title: 'Success', message: `Axe ${isBlocked ? 'unblocked' : 'blocked'}`, color: 'green' });
        })
        .catch((err) => {
          notifications.show({ title: 'Error', message: err.message, color: 'red' });
        });
    },
    [blockAxe, unblockAxe, setAxesOptimistic]
  );

  const handleDelete = useCallback(
    (axe: Axe) => {
      setAxesOptimistic((prev) => prev.filter((a) => a.id !== axe.id));

      deleteAxe(axe.id)
        .then(() => {
          notifications.show({ title: 'Success', message: 'Axe deleted', color: 'green' });
        })
        .catch((err) => {
          notifications.show({ title: 'Error', message: err.message, color: 'red' });
        });
    },
    [deleteAxe, setAxesOptimistic]
  );

  const columnDefs = useMemo<ColDef<AxeRow>[]>(
    () => [
      {
        field: 'isin',
        headerName: 'ISIN / Bond',
        width: 200,
        editable: (params) => !!params.data?._isNew,
        cellEditor: InstrumentSearchEditor,
        cellEditorParams: { instruments },
        cellEditorPopup: false,
      },
      { field: 'description', headerName: 'Description', flex: 1, minWidth: 200 },
      {
        field: 'side',
        headerName: 'Side',
        width: 100,
        editable: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: { values: ['Bid', 'Offer'] },
      },
      {
        field: 'quantity',
        headerName: 'Quantity',
        width: 140,
        editable: true,
        cellEditor: 'agNumberCellEditor',
        valueFormatter: (params) =>
          params.value != null && params.value !== 0 ? Number(params.value).toLocaleString() : '',
      },
      {
        field: 'status',
        headerName: 'Status',
        width: 110,
        cellRenderer: (params: ICellRendererParams<AxeRow>) => {
          if (!params.value || params.data?._isNew) return params.data?._isNew ? 'NEW' : null;
          return <StatusBadge status={params.value} />;
        },
      },
      {
        field: 'lastUpdate',
        headerName: 'Last Update',
        width: 180,
        valueFormatter: (params) =>
          params.value ? new Date(params.value).toLocaleString() : '',
      },
      {
        headerName: 'Actions',
        width: 130,
        sortable: false,
        filter: false,
        cellRenderer: ActionsRenderer,
        cellRendererParams: {
          onPauseResume: handlePauseResume,
          onBlockUnblock: handleBlockUnblock,
          onDelete: handleDelete,
          onConfirmNew: confirmNewRow,
          onCancelNew: cancelNewRow,
        },
      },
    ],
    [instruments, handlePauseResume, handleBlockUnblock, handleDelete, confirmNewRow, cancelNewRow]
  );

  return (
    <Stack gap="sm" style={{ height: '100%' }}>
      <Paper p="xs" withBorder>
        <Group>
          <Button leftSection={<IconPlus size={16} />} onClick={addNewRow}>
            Add Axe
          </Button>
          <Text size="sm" c="dimmed">
            {axes.length} axes · {newRows.length > 0 ? `${newRows.length} pending` : 'Click cells to edit inline'}
          </Text>
        </Group>
      </Paper>

      <div style={{ flex: 1 }}>
        <div className="ag-theme-alpine" style={{ height: '100%', width: '100%' }}>
          <AgGridReact<AxeRow>
            ref={gridRef}
            modules={[AllCommunityModule]}
            rowData={rowData}
            columnDefs={columnDefs}
            getRowId={(params) => params.data.id}
            animateRows={true}
            onCellValueChanged={onCellValueChanged}
            singleClickEdit={true}
            stopEditingWhenCellsLoseFocus={true}
            getRowStyle={(params) => {
              if (params.data?._isNew) {
                return { backgroundColor: '#f0f9ff' };
              }
              return undefined;
            }}
          />
        </div>
      </div>
    </Stack>
  );
}
