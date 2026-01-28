import { useState, useCallback, useMemo, useRef } from 'react';
import {
  Autocomplete,
  Button,
  Group,
  Stack,
  Paper,
  LoadingOverlay,
  ActionIcon,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef, CellValueChangedEvent, ICellRendererParams } from 'ag-grid-community';
import { AllCommunityModule } from 'ag-grid-community';
import {
  IconPlayerPause,
  IconPlayerPlay,
  IconLock,
  IconLockOpen,
  IconTrash,
  IconDeviceFloppy,
  IconArrowBackUp,
} from '@tabler/icons-react';
import { useBondInstruments } from '../../hooks/useBondInstruments.ts';
import { useBondAxes } from '../../hooks/useBondAxes.ts';
import { AxeModal } from '../shared/AxeModal.tsx';
import { StatusBadge } from '../shared/StatusBadge.tsx';
import type { Axe, AxeSide, BondInstrument, AxeStatus } from '../../types/index.ts';

// Tracks pending edits per row: axeId -> { side?, quantity? }
type PendingEdits = Record<string, { side?: AxeSide; quantity?: number }>;

function ActionsRenderer(props: ICellRendererParams<Axe> & {
  onPauseResume: (axe: Axe) => void;
  onBlockUnblock: (axe: Axe) => void;
  onDelete: (axe: Axe) => void;
  onSaveRow: (axe: Axe) => void;
  onRevertRow: (axe: Axe) => void;
  pendingEdits: PendingEdits;
}) {
  const axe = props.data;
  if (!axe) return null;

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

export function AxeManagerV4() {
  const { searchInstruments, getInstrument, loading: instrumentsLoading } = useBondInstruments();
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

  // Toolbar state
  const [searchValue, setSearchValue] = useState('');
  const [selectedInstrument, setSelectedInstrument] = useState<BondInstrument | null>(null);

  // Modal state (create only)
  const [modalOpened, setModalOpened] = useState(false);
  const [saving, setSaving] = useState(false);

  // Pending edits: axeId -> edited values (not yet saved)
  const [pendingEdits, setPendingEdits] = useState<PendingEdits>({});

  // Compute display data: overlay pending edits on top of server data
  const displayData = useMemo(() => {
    return axes.map((axe) => {
      const edits = pendingEdits[axe.id];
      if (!edits) return axe;
      return {
        ...axe,
        side: edits.side ?? axe.side,
        quantity: edits.quantity ?? axe.quantity,
      };
    });
  }, [axes, pendingEdits]);

  const autocompleteData = useMemo(() => {
    const results = searchInstruments(searchValue);
    return results.map((i) => ({
      value: `${i.isin} - ${i.description}`,
      isin: i.isin,
    }));
  }, [searchValue, searchInstruments]);

  const handleAutocompleteChange = (value: string) => {
    setSearchValue(value);
    const match = autocompleteData.find((d) => d.value === value);
    setSelectedInstrument(match ? getInstrument(match.isin) ?? null : null);
  };

  // When a cell value changes, store it as a pending edit (don't send to server yet)
  const onCellValueChanged = useCallback(
    (event: CellValueChangedEvent<Axe>) => {
      const axe = event.data;
      if (!axe) return;

      const field = event.colDef.field as 'side' | 'quantity';
      if (field !== 'side' && field !== 'quantity') return;

      // Find the original server value for this axe
      const serverAxe = axes.find((a) => a.id === axe.id);
      if (!serverAxe) return;

      setPendingEdits((prev) => {
        const existing = prev[axe.id] || {};
        const updated = { ...existing, [field]: event.newValue };

        // If all edited fields now match server values, remove the pending edit
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

  // Save a single row's pending edits
  const handleSaveRow = useCallback(
    (axe: Axe) => {
      const edits = pendingEdits[axe.id];
      if (!edits) return;

      const updatedSide = edits.side ?? axe.side;
      const updatedQty = edits.quantity ?? axe.quantity;

      // Optimistic: apply edits immediately
      setAxesOptimistic((prev) =>
        prev.map((a) =>
          a.id === axe.id
            ? { ...a, side: updatedSide, quantity: updatedQty, lastUpdate: new Date().toISOString() }
            : a
        )
      );

      // Clear pending edits for this row
      setPendingEdits((prev) => {
        const { [axe.id]: _, ...rest } = prev;
        return rest;
      });

      createOrUpdateAxe({
        id: axe.id,
        isin: axe.isin,
        side: updatedSide,
        quantity: updatedQty,
      })
        .then(() => {
          notifications.show({ title: 'Success', message: 'Axe updated', color: 'green' });
        })
        .catch((err) => {
          notifications.show({
            title: 'Error',
            message: err.message || 'Failed to update axe',
            color: 'red',
          });
        });
    },
    [pendingEdits, createOrUpdateAxe, setAxesOptimistic]
  );

  // Revert a single row's pending edits
  const handleRevertRow = useCallback(
    (axe: Axe) => {
      setPendingEdits((prev) => {
        const { [axe.id]: _, ...rest } = prev;
        return rest;
      });
    },
    []
  );

  // Row action handlers with optimistic updates
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
          notifications.show({
            title: 'Success',
            message: `Axe ${isPaused ? 'resumed' : 'paused'}`,
            color: 'green',
          });
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
          notifications.show({
            title: 'Success',
            message: `Axe ${isBlocked ? 'unblocked' : 'blocked'}`,
            color: 'green',
          });
        })
        .catch((err) => {
          notifications.show({ title: 'Error', message: err.message, color: 'red' });
        });
    },
    [blockAxe, unblockAxe, setAxesOptimistic]
  );

  const handleDelete = useCallback(
    (axe: Axe) => {
      // Also clear any pending edits for this row
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

  const handleCreate = () => {
    setModalOpened(true);
  };

  const handleModalSave = async (data: { isin: string; side: AxeSide; quantity: number; id?: string }) => {
    setSaving(true);
    try {
      await createOrUpdateAxe({ isin: data.isin, side: data.side, quantity: data.quantity });
      setModalOpened(false);
      notifications.show({ title: 'Success', message: 'Axe created', color: 'green' });
    } catch (err: any) {
      notifications.show({ title: 'Error', message: err.message || 'Failed to create axe', color: 'red' });
    } finally {
      setSaving(false);
    }
  };

  const pendingCount = Object.keys(pendingEdits).length;

  const columnDefs = useMemo<ColDef<Axe>[]>(
    () => [
      { field: 'isin', headerName: 'ISIN', width: 140 },
      { field: 'description', headerName: 'Description', flex: 1, minWidth: 200 },
      {
        field: 'side',
        headerName: 'Side',
        width: 100,
        editable: true,
        cellEditor: 'agSelectCellEditor',
        cellEditorParams: { values: ['Bid', 'Offer'] },
        cellStyle: (params) => {
          if (params.data && pendingEdits[params.data.id]?.side !== undefined) {
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
          params.value != null ? Number(params.value).toLocaleString() : '',
        cellStyle: (params) => {
          if (params.data && pendingEdits[params.data.id]?.quantity !== undefined) {
            return { backgroundColor: '#fffbeb' };
          }
          return null;
        },
      },
      {
        field: 'status',
        headerName: 'Status',
        width: 110,
        cellRenderer: (params: { value: AxeStatus }) => {
          if (!params.value) return null;
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
        width: 140,
        sortable: false,
        filter: false,
        cellRenderer: ActionsRenderer,
        cellRendererParams: {
          onPauseResume: handlePauseResume,
          onBlockUnblock: handleBlockUnblock,
          onDelete: handleDelete,
          onSaveRow: handleSaveRow,
          onRevertRow: handleRevertRow,
          pendingEdits,
        },
      },
    ],
    [handlePauseResume, handleBlockUnblock, handleDelete, handleSaveRow, handleRevertRow, pendingEdits]
  );

  return (
    <Stack gap="sm" style={{ height: '100%' }}>
      <Paper p="sm" withBorder>
        <Group>
          <Autocomplete
            placeholder="Search bonds by ISIN or Description..."
            value={searchValue}
            onChange={handleAutocompleteChange}
            data={autocompleteData.map((d) => d.value)}
            style={{ width: 400 }}
            limit={50}
          />
          <Button onClick={handleCreate} disabled={!selectedInstrument}>
            Create Axe
          </Button>
          {pendingCount > 0 && (
            <Button
              variant="light"
              color="yellow"
              size="xs"
              onClick={() => {
                // Save all pending rows
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
        </Group>
      </Paper>

      <div style={{ flex: 1, position: 'relative' }}>
        <LoadingOverlay visible={instrumentsLoading} />
        <div className="ag-theme-alpine" style={{ height: '100%', width: '100%' }}>
          <AgGridReact<Axe>
            ref={gridRef}
            modules={[AllCommunityModule]}
            rowData={displayData}
            columnDefs={columnDefs}
            getRowId={(params) => params.data.id}
            animateRows={true}
            onCellValueChanged={onCellValueChanged}
            singleClickEdit={true}
            stopEditingWhenCellsLoseFocus={true}
            getRowStyle={(params) => {
              if (params.data && pendingEdits[params.data.id]) {
                return { backgroundColor: '#fffef5' };
              }
              return undefined;
            }}
          />
        </div>
      </div>

      <AxeModal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        onSave={handleModalSave}
        mode="create"
        instrument={selectedInstrument}
        saving={saving}
      />
    </Stack>
  );
}
