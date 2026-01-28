import { useState, useCallback, useMemo, useRef, forwardRef, useImperativeHandle, useEffect } from 'react';
import {
  Stack,
  ActionIcon,
  Tooltip,
  Group,
  Button,
  Paper,
  Text,
  Autocomplete,
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
  IconDeviceFloppy,
  IconArrowBackUp,
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

// Tracks pending edits per existing row: axeId -> { side?, quantity? }
type PendingEdits = Record<string, { side?: AxeSide; quantity?: number }>;

function ActionsRenderer(
  props: ICellRendererParams<AxeRow> & {
    onPauseResume: (axe: Axe) => void;
    onBlockUnblock: (axe: Axe) => void;
    onDelete: (axe: Axe) => void;
    onConfirmNew: (axe: AxeRow) => void;
    onCancelNew: (id: string) => void;
    onSaveRow: (axe: Axe) => void;
    onRevertRow: (axe: Axe) => void;
    pendingEdits: PendingEdits;
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

  const hasPending = !!props.pendingEdits[axe.id];
  const canPause = axe.status === 'ACTIVE';
  const canResume = axe.status === 'PAUSED';
  const canBlock = axe.status === 'ACTIVE';
  const canUnblock = axe.status === 'BLOCKED';

  return (
    <Group gap={4} wrap="nowrap" align="center" style={{ height: '100%' }}>
      {hasPending ? (
        <>
          <Tooltip label="Save changes">
            <ActionIcon size="sm" color="green" variant="subtle" onClick={() => props.onSaveRow(axe)}>
              <IconDeviceFloppy size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Revert changes">
            <ActionIcon size="sm" color="gray" variant="subtle" onClick={() => props.onRevertRow(axe)}>
              <IconArrowBackUp size={16} />
            </ActionIcon>
          </Tooltip>
        </>
      ) : (
        <>
          <Tooltip label={canResume ? 'Resume' : 'Pause'}>
            <ActionIcon
              size="sm"
              color={canResume ? 'green' : 'yellow'}
              variant="subtle"
              disabled={!canPause && !canResume}
              onClick={() => props.onPauseResume(axe)}
            >
              {canResume ? <IconPlayerPlay size={16} /> : <IconPlayerPause size={16} />}
            </ActionIcon>
          </Tooltip>

          <Tooltip label={canUnblock ? 'Unblock' : 'Block'}>
            <ActionIcon
              size="sm"
              color={canUnblock ? 'green' : 'red'}
              variant="subtle"
              disabled={!canBlock && !canUnblock}
              onClick={() => props.onBlockUnblock(axe)}
            >
              {canUnblock ? <IconLockOpen size={16} /> : <IconLock size={16} />}
            </ActionIcon>
          </Tooltip>
        </>
      )}

      <Tooltip label="Delete">
        <ActionIcon size="sm" color="red" variant="subtle" onClick={() => props.onDelete(axe)}>
          <IconTrash size={16} />
        </ActionIcon>
      </Tooltip>
    </Group>
  );
}

// Custom cell editor for bond instrument search - rendered as a popup
const InstrumentSearchEditor = forwardRef((
  props: ICellEditorParams & {
    instruments: BondInstrument[];
    onSelectInstrument?: (rowId: string | undefined, instrument: BondInstrument) => void;
  },
  ref
) => {
  const initialValue = typeof props.value === 'string' ? props.value : '';
  const [value, setValue] = useState(initialValue);
  const selectedValueRef = useRef<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({
    getValue: () => selectedValueRef.current || initialValue,
    isCancelAfterEnd: () => false,
    isPopup: () => true,
    getPopupPosition: () => 'under' as const,
  }));

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  const instrumentList = props.instruments || [];
  const displayData = useMemo(
    () => instrumentList.map((i) => `${i.isin} - ${i.description}`),
    [instrumentList]
  );
  const displayToInstrument = useMemo(() => {
    const map = new Map<string, BondInstrument>();
    for (const instrument of instrumentList) {
      map.set(`${instrument.isin} - ${instrument.description}`, instrument);
    }
    return map;
  }, [instrumentList]);

  const handleSelect = (instrument: BondInstrument, displayValue: string) => {
    selectedValueRef.current = instrument.isin;
    setValue(displayValue);
    if (props.node) {
      props.node.setDataValue('isin', instrument.isin);
      props.node.setDataValue('description', instrument.description);
      props.node.setDataValue('maturity', instrument.maturity);
      props.node.setDataValue('issuer', instrument.issuer);
    }
    props.onSelectInstrument?.(props.node?.data?.id, instrument);
    // Stop editing after selection
    setTimeout(() => props.api.stopEditing(), 0);
  };

  return (
    <div style={{ width: 420 }}>
      <Autocomplete
        ref={inputRef}
        value={value}
        data={displayData}
        placeholder="Type to search by ISIN or description..."
        limit={30}
        maxDropdownHeight={250}
        comboboxProps={{ withinPortal: false }}
        onChange={(nextValue) => {
          selectedValueRef.current = '';
          setValue(nextValue);
        }}
        onOptionSubmit={(optionValue) => {
          const instrument = displayToInstrument.get(optionValue);
          if (!instrument) return;
          handleSelect(instrument, optionValue);
        }}
      />
    </div>
  );
});

InstrumentSearchEditor.displayName = 'InstrumentSearchEditor';

export function AxeManagerV5() {
  const { instruments } = useBondInstruments();
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
  const [pendingEdits, setPendingEdits] = useState<PendingEdits>({});

  const rowData = useMemo<AxeRow[]>(() => {
    const displayAxes = axes.map((a) => {
      const edits = pendingEdits[a.id];
      return {
        ...a,
        side: edits?.side ?? a.side,
        quantity: edits?.quantity ?? a.quantity,
        _isNew: false,
      };
    });
    return [...newRows, ...displayAxes];
  }, [newRows, axes, pendingEdits]);

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

      setNewRows((prev) => prev.filter((r) => r.id !== axe.id));

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
          setAxesOptimistic((prev) => prev.filter((a) => a.id !== axe.id));
        });
    },
    [createOrUpdateAxe, setAxesOptimistic]
  );

  const updateNewRowInstrument = useCallback((rowId: string | undefined, instrument: BondInstrument) => {
    if (!rowId) return;
    setNewRows((prev) =>
      prev.map((r) =>
        r.id === rowId
          ? {
              ...r,
              isin: instrument.isin,
              description: instrument.description,
              maturity: instrument.maturity,
              issuer: instrument.issuer,
            }
          : r
      )
    );
  }, []);

  const onCellValueChanged = useCallback(
    (event: CellValueChangedEvent<AxeRow>) => {
      const axe = event.data;
      if (!axe) return;

      if (axe._isNew) {
        if (event.colDef.field === 'isin') {
          return;
        }
        setNewRows((prev) => prev.map((r) => (r.id === axe.id ? { ...axe } : r)));
        return;
      }

      const field = event.colDef.field as 'side' | 'quantity';
      if (field !== 'side' && field !== 'quantity') return;

      const serverAxe = axes.find((a) => a.id === axe.id);
      if (!serverAxe) return;

      setPendingEdits((prev) => {
        const existing = prev[axe.id] || {};
        const updated = { ...existing, [field]: event.newValue };

        const sideVal = updated.side ?? serverAxe.side;
        const qtyVal = updated.quantity ?? serverAxe.quantity;
        if (sideVal === serverAxe.side && qtyVal === serverAxe.quantity) {
          const { [axe.id]: _, ...rest } = prev;
          return rest;
        }

        return { ...prev, [axe.id]: updated };
      });
    },
    [axes]
  );

  const handleSaveRow = useCallback(
    (axe: Axe) => {
      const edits = pendingEdits[axe.id];
      if (!edits) return;

      const serverAxe = axes.find((a) => a.id === axe.id);
      if (!serverAxe) return;

      const updatedSide = edits.side ?? serverAxe.side;
      const updatedQty = edits.quantity ?? serverAxe.quantity;

      setAxesOptimistic((prev) =>
        prev.map((a) =>
          a.id === axe.id
            ? { ...a, side: updatedSide, quantity: updatedQty, lastUpdate: new Date().toISOString() }
            : a
        )
      );

      setPendingEdits((prev) => {
        const { [axe.id]: _, ...rest } = prev;
        return rest;
      });

      createOrUpdateAxe({
        id: axe.id,
        isin: serverAxe.isin,
        side: updatedSide,
        quantity: updatedQty,
      })
        .then(() => {
          notifications.show({ title: 'Success', message: 'Axe updated', color: 'green' });
        })
        .catch((err) => {
          notifications.show({ title: 'Error', message: err.message || 'Failed to update', color: 'red' });
        });
    },
    [pendingEdits, axes, createOrUpdateAxe, setAxesOptimistic]
  );

  const handleRevertRow = useCallback((axe: Axe) => {
    setPendingEdits((prev) => {
      const { [axe.id]: _, ...rest } = prev;
      return rest;
    });
  }, []);

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
      setPendingEdits((prev) => {
        const { [axe.id]: _, ...rest } = prev;
        return rest;
      });

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

  const pendingCount = Object.keys(pendingEdits).length;

  const columnDefs = useMemo<ColDef<AxeRow>[]>(
    () => [
      {
        field: 'isin',
        headerName: 'ISIN / Bond',
        width: 200,
        editable: (params) => !!params.data?._isNew,
        cellEditor: InstrumentSearchEditor,
        cellEditorParams: { instruments, onSelectInstrument: updateNewRowInstrument },
        cellEditorPopup: true,
      },
      { field: 'description', headerName: 'Description', flex: 1, minWidth: 200 },
      {
        field: 'side',
        headerName: 'Side',
        width: 100,
        editable: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: { values: ['Bid', 'Offer'] },
        cellStyle: (params) => {
          if (!params.data?._isNew && pendingEdits[params.data.id]?.side !== undefined) {
            return { backgroundColor: '#fffbeb' };
          }
          return null;
        },
      },
      {
        field: 'quantity',
        headerName: 'Quantity',
        width: 140,
        editable: true,
        cellEditor: 'agNumberCellEditor',
        valueFormatter: (params) =>
          params.value != null && params.value !== 0 ? Number(params.value).toLocaleString() : '',
        cellStyle: (params) => {
          if (!params.data?._isNew && pendingEdits[params.data.id]?.quantity !== undefined) {
            return { backgroundColor: '#fffbeb' };
          }
          return null;
        },
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
        width: 150,
        sortable: false,
        filter: false,
        cellRenderer: ActionsRenderer,
        cellRendererParams: {
          onPauseResume: handlePauseResume,
          onBlockUnblock: handleBlockUnblock,
          onDelete: handleDelete,
          onConfirmNew: confirmNewRow,
          onCancelNew: cancelNewRow,
          onSaveRow: handleSaveRow,
          onRevertRow: handleRevertRow,
          pendingEdits,
        },
      },
    ],
    [
      instruments,
      updateNewRowInstrument,
      pendingEdits,
      handlePauseResume,
      handleBlockUnblock,
      handleDelete,
      confirmNewRow,
      cancelNewRow,
      handleSaveRow,
      handleRevertRow,
    ]
  );

  return (
    <Stack gap="sm" style={{ height: '100%' }}>
      <Paper p="xs" withBorder>
        <Group>
          <Button leftSection={<IconPlus size={16} />} onClick={addNewRow}>
            Add Axe
          </Button>
          {pendingCount > 0 && (
            <Button
              variant="light"
              color="yellow"
              size="xs"
              onClick={() => {
                for (const axeId of Object.keys(pendingEdits)) {
                  const axe = axes.find((a) => a.id === axeId);
                  if (axe) handleSaveRow(axe);
                }
              }}
            >
              Save All ({pendingCount})
            </Button>
          )}
          {pendingCount > 0 && (
            <Button
              variant="light"
              color="gray"
              size="xs"
              onClick={() => setPendingEdits({})}
            >
              Revert All
            </Button>
          )}
          <Text size="sm" c="dimmed">
            {axes.length} axes · {newRows.length} new · {pendingCount} dirty
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
              if (params.data && pendingEdits[params.data.id]) {
                return { backgroundColor: '#fffef5' };
              }
              return undefined;
            }}
          />
        </div>
      </div>
    </Stack>
  );
}
