import { useState, useCallback, useMemo, useRef } from 'react';
import {
  Autocomplete,
  Button,
  Group,
  Popover,
  Stack,
  Text,
  Paper,
  LoadingOverlay,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef, SelectionChangedEvent } from 'ag-grid-community';
import { AllCommunityModule } from 'ag-grid-community';
import { useBondInstruments } from '../../hooks/useBondInstruments.ts';
import { useBondAxes } from '../../hooks/useBondAxes.ts';
import { AxeModal } from '../shared/AxeModal.tsx';
import { StatusBadge } from '../shared/StatusBadge.tsx';
import type { Axe, AxeSide, BondInstrument, AxeStatus } from '../../types/index.ts';

export function AxeManagerV1() {
  const { searchInstruments, getInstrument, loading: instrumentsLoading } = useBondInstruments();
  const {
    axes,
    createOrUpdateAxe,
    pauseAxe,
    resumeAxe,
    blockAxe,
    unblockAxe,
    deleteAxe,
  } = useBondAxes();

  const gridRef = useRef<AgGridReact>(null);

  // Toolbar state
  const [searchValue, setSearchValue] = useState('');
  const [selectedInstrument, setSelectedInstrument] = useState<BondInstrument | null>(null);
  const [selectedAxe, setSelectedAxe] = useState<Axe | null>(null);

  // Modal state
  const [modalOpened, setModalOpened] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [saving, setSaving] = useState(false);

  // Delete popover
  const [deletePopoverOpened, setDeletePopoverOpened] = useState(false);

  // Autocomplete options
  const autocompleteData = useMemo(() => {
    const results = searchInstruments(searchValue);
    return results.map((i) => ({
      value: `${i.isin} - ${i.description}`,
      isin: i.isin,
    }));
  }, [searchValue, searchInstruments]);

  const handleAutocompleteChange = (value: string) => {
    setSearchValue(value);
    // Check if user selected an option
    const match = autocompleteData.find((d) => d.value === value);
    if (match) {
      setSelectedInstrument(getInstrument(match.isin) ?? null);
    } else {
      setSelectedInstrument(null);
    }
  };

  // Grid column defs
  const columnDefs = useMemo<ColDef<Axe>[]>(
    () => [
      { field: 'isin', headerName: 'ISIN', width: 140 },
      { field: 'description', headerName: 'Description', flex: 1, minWidth: 200 },
      { field: 'side', headerName: 'Side', width: 90 },
      {
        field: 'quantity',
        headerName: 'Quantity',
        width: 130,
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
    ],
    []
  );

  const onSelectionChanged = useCallback((event: SelectionChangedEvent<Axe>) => {
    const rows = event.api.getSelectedRows();
    setSelectedAxe(rows.length > 0 ? rows[0] : null);
  }, []);

  // Actions
  const handleCreate = () => {
    setModalMode('create');
    setModalOpened(true);
  };

  const handleUpdate = () => {
    if (!selectedAxe) return;
    setModalMode('edit');
    setModalOpened(true);
  };

  const handleSave = async (data: { isin: string; side: AxeSide; quantity: number; id?: string }) => {
    setSaving(true);
    try {
      await createOrUpdateAxe({
        id: data.id,
        isin: data.isin,
        side: data.side,
        quantity: data.quantity,
      });
      setModalOpened(false);
      notifications.show({
        title: 'Success',
        message: data.id ? 'Axe updated successfully' : 'Axe created successfully',
        color: 'green',
      });
    } catch (err: any) {
      notifications.show({
        title: 'Error',
        message: err.message || 'Failed to save axe',
        color: 'red',
      });
    } finally {
      setSaving(false);
    }
  };

  const handlePauseResume = async () => {
    if (!selectedAxe) return;
    try {
      if (selectedAxe.status === 'PAUSED') {
        await resumeAxe(selectedAxe.id);
        notifications.show({ title: 'Success', message: 'Axe resumed', color: 'green' });
      } else {
        await pauseAxe(selectedAxe.id);
        notifications.show({ title: 'Success', message: 'Axe paused', color: 'green' });
      }
      setSelectedAxe(null);
    } catch (err: any) {
      notifications.show({ title: 'Error', message: err.message, color: 'red' });
    }
  };

  const handleBlockUnblock = async () => {
    if (!selectedAxe) return;
    try {
      if (selectedAxe.status === 'BLOCKED') {
        await unblockAxe(selectedAxe.id);
        notifications.show({ title: 'Success', message: 'Axe unblocked', color: 'green' });
      } else {
        await blockAxe(selectedAxe.id);
        notifications.show({ title: 'Success', message: 'Axe blocked', color: 'green' });
      }
      setSelectedAxe(null);
    } catch (err: any) {
      notifications.show({ title: 'Error', message: err.message, color: 'red' });
    }
  };

  const handleDelete = async () => {
    if (!selectedAxe) return;
    try {
      await deleteAxe(selectedAxe.id);
      setDeletePopoverOpened(false);
      setSelectedAxe(null);
      notifications.show({ title: 'Success', message: 'Axe deleted', color: 'green' });
    } catch (err: any) {
      notifications.show({ title: 'Error', message: err.message, color: 'red' });
    }
  };

  // Status-aware button states
  const canPause = selectedAxe && selectedAxe.status === 'ACTIVE';
  const canResume = selectedAxe && selectedAxe.status === 'PAUSED';
  const canBlock = selectedAxe && selectedAxe.status === 'ACTIVE';
  const canUnblock = selectedAxe && selectedAxe.status === 'BLOCKED';

  return (
    <Stack gap="sm" style={{ height: '100%' }}>
      <Paper p="sm" withBorder>
        <Group justify="space-between">
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
            <Button variant="outline" onClick={handleUpdate} disabled={!selectedAxe}>
              Update
            </Button>
          </Group>
          <Group>
            {(canPause || canResume) && (
              <Button
                variant="outline"
                color={canResume ? 'green' : 'yellow'}
                onClick={handlePauseResume}
              >
                {canResume ? 'Resume' : 'Pause'}
              </Button>
            )}
            {(canBlock || canUnblock) && (
              <Button
                variant="outline"
                color={canUnblock ? 'green' : 'red'}
                onClick={handleBlockUnblock}
              >
                {canUnblock ? 'Unblock' : 'Block'}
              </Button>
            )}
            <Popover
              opened={deletePopoverOpened}
              onChange={setDeletePopoverOpened}
              position="bottom"
            >
              <Popover.Target>
                <Button
                  variant="outline"
                  color="red"
                  disabled={!selectedAxe}
                  onClick={() => setDeletePopoverOpened(true)}
                >
                  Delete
                </Button>
              </Popover.Target>
              <Popover.Dropdown>
                <Stack gap="xs">
                  <Text size="sm">Are you sure you want to delete this axe?</Text>
                  <Group justify="flex-end">
                    <Button size="xs" variant="default" onClick={() => setDeletePopoverOpened(false)}>
                      Cancel
                    </Button>
                    <Button size="xs" color="red" onClick={handleDelete}>
                      Yes
                    </Button>
                  </Group>
                </Stack>
              </Popover.Dropdown>
            </Popover>
          </Group>
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
            rowSelection={{ mode: 'singleRow', checkboxes: false }}
            onSelectionChanged={onSelectionChanged}
            getRowId={(params) => params.data.id}
            animateRows={true}
          />
        </div>
      </div>

      <AxeModal
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        onSave={handleSave}
        mode={modalMode}
        instrument={selectedInstrument}
        axe={selectedAxe}
        saving={saving}
      />
    </Stack>
  );
}
