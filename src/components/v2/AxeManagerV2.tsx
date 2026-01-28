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
} from '@tabler/icons-react';
import { useBondInstruments } from '../../hooks/useBondInstruments.ts';
import { useBondAxes } from '../../hooks/useBondAxes.ts';
import { AxeModal } from '../shared/AxeModal.tsx';
import { StatusBadge } from '../shared/StatusBadge.tsx';
import type { Axe, AxeSide, BondInstrument, AxeStatus } from '../../types/index.ts';

function ActionsRenderer(props: ICellRendererParams<Axe> & {
  onPauseResume: (axe: Axe) => void;
  onBlockUnblock: (axe: Axe) => void;
  onDelete: (axe: Axe) => void;
}) {
  const axe = props.data;
  if (!axe) return null;

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

export function AxeManagerV2() {
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

  // Inline edit handler with optimistic update
  const onCellValueChanged = useCallback(
    (event: CellValueChangedEvent<Axe>) => {
      const axe = event.data;
      if (!axe) return;

      // Optimistic: already updated in grid via AG-Grid's editable cells
      setAxesOptimistic((prev) =>
        prev.map((a) => (a.id === axe.id ? { ...axe, lastUpdate: new Date().toISOString() } : a))
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
          notifications.show({
            title: 'Error',
            message: err.message || 'Failed to update axe',
            color: 'red',
          });
        });
    },
    [createOrUpdateAxe, setAxesOptimistic]
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

  const handleSave = async (data: { isin: string; side: AxeSide; quantity: number; id?: string }) => {
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
      },
      {
        field: 'quantity',
        headerName: 'Quantity',
        width: 140,
        editable: true,
        cellEditor: 'agNumberCellEditor',
        valueFormatter: (params) =>
          params.value != null ? Number(params.value).toLocaleString() : '',
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
        width: 130,
        sortable: false,
        filter: false,
        cellRenderer: ActionsRenderer,
        cellRendererParams: {
          onPauseResume: handlePauseResume,
          onBlockUnblock: handleBlockUnblock,
          onDelete: handleDelete,
        },
      },
    ],
    [handlePauseResume, handleBlockUnblock, handleDelete]
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
        </Group>
      </Paper>

      <div style={{ flex: 1, position: 'relative' }}>
        <LoadingOverlay visible={instrumentsLoading} />
        <div className="ag-theme-alpine" style={{ height: '100%', width: '100%' }}>
          <AgGridReact<Axe>
            ref={gridRef}
            modules={[AllCommunityModule]}
            rowData={axes}
            columnDefs={columnDefs}
            getRowId={(params) => params.data.id}
            animateRows={true}
            onCellValueChanged={onCellValueChanged}
            singleClickEdit={true}
            stopEditingWhenCellsLoseFocus={true}
          />
        </div>
      </div>

      <AxeModal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        onSave={handleSave}
        mode="create"
        instrument={selectedInstrument}
        saving={saving}
      />
    </Stack>
  );
}
