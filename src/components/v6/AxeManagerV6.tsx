import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Stack, Group, Button, Paper, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { AgGridReact } from 'ag-grid-react';
import type { CellValueChangedEvent, RowClassParams, RowStyle } from 'ag-grid-community';
import { AllCommunityModule } from 'ag-grid-community';
import { v4 as uuidv4 } from 'uuid';
import { useBondInstruments } from '../../hooks/useBondInstruments.ts';
import { useBondAxes } from '../../hooks/useBondAxes.ts';
import type { Axe, AxeStatus, BondInstrument } from '../../types/index.ts';
import {
  createColumnDefs,
  PINNED_ROW_ID,
  DEFAULT_PINNED_ROW,
  type AxeRow,
  type PendingEdits,
} from './components/index.ts';

export function AxeManagerV6() {
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
  const [pendingEdits, setPendingEdits] = useState<PendingEdits>({});
  const pendingEditsRef = useRef<PendingEdits>(pendingEdits);
  const [pinnedRow, setPinnedRow] = useState<AxeRow>({ ...DEFAULT_PINNED_ROW });

  // Compute row data with pending edits applied
  const rowData = useMemo<AxeRow[]>(
    () =>
      axes.map((a) => {
        const edits = pendingEdits[a.id];
        return {
          ...a,
          side: edits?.side ?? a.side,
          quantity: edits?.quantity ?? a.quantity,
          _isNew: false,
        };
      }),
    [axes, pendingEdits]
  );

  // Keep ref in sync and refresh cells when pendingEdits changes
  useEffect(() => {
    pendingEditsRef.current = pendingEdits;
    const api = gridRef.current?.api;
    if (api) {
      api.refreshCells({ columns: ['side', 'quantity'], force: true });
      api.redrawRows();
    }
  }, [pendingEdits]);

  // Handlers
  const updatePinnedRowInstrument = useCallback(
    (rowId: string | undefined, instrument: BondInstrument) => {
      if (rowId && rowId !== PINNED_ROW_ID) return;
      setPinnedRow((prev) => ({
        ...prev,
        isin: instrument.isin,
        description: instrument.description,
        maturity: instrument.maturity,
        issuer: instrument.issuer,
      }));
    },
    []
  );

  const clearPinnedRow = useCallback(() => {
    setPinnedRow((prev) => ({
      ...prev,
      isin: '',
      description: '',
      maturity: '',
      issuer: '',
      side: 'Bid',
      quantity: 1000000,
    }));
  }, []);

  const handleCreatePinned = useCallback(() => {
    if (!pinnedRow.isin) {
      notifications.show({ title: 'Validation', message: 'Please select a bond instrument', color: 'orange' });
      return;
    }
    if (!pinnedRow.quantity || pinnedRow.quantity < 1) {
      notifications.show({ title: 'Validation', message: 'Quantity must be at least 1', color: 'orange' });
      return;
    }

    const newId = uuidv4();
    const optimisticAxe: Axe = {
      id: newId,
      isin: pinnedRow.isin,
      description: pinnedRow.description,
      maturity: pinnedRow.maturity,
      issuer: pinnedRow.issuer,
      side: pinnedRow.side,
      quantity: pinnedRow.quantity,
      status: 'ACTIVE',
      lastUpdate: new Date().toISOString(),
    };
    setAxesOptimistic((prev) => [optimisticAxe, ...prev]);

    createOrUpdateAxe({
      isin: pinnedRow.isin,
      side: pinnedRow.side,
      quantity: pinnedRow.quantity,
    })
      .then(() => notifications.show({ title: 'Success', message: 'Axe created', color: 'green' }))
      .catch((err) => {
        notifications.show({ title: 'Error', message: err.message || 'Failed to create axe', color: 'red' });
        setAxesOptimistic((prev) => prev.filter((a) => a.id !== newId));
      });

    clearPinnedRow();
  }, [pinnedRow, createOrUpdateAxe, setAxesOptimistic, clearPinnedRow]);

  const onCellValueChanged = useCallback(
    (event: CellValueChangedEvent<AxeRow>) => {
      const axe = event.data;
      if (!axe) return;

      // Handle pinned row changes
      if (event.node?.rowPinned === 'top') {
        const field = event.colDef.field as keyof AxeRow;
        const newValue = event.newValue;

        if (field === 'side' || field === 'quantity') {
          setPinnedRow((prev) => ({ ...prev, [field]: newValue }));
          return;
        }

        if (['isin', 'description', 'maturity', 'issuer'].includes(field)) {
          if (newValue == null || newValue === '') return;
          setPinnedRow((prev) => ({ ...prev, [field]: newValue }));
        }
        return;
      }

      // Handle existing row changes
      const field = event.colDef.field as 'side' | 'quantity';
      if (field !== 'side' && field !== 'quantity') return;

      const serverAxe = axes.find((a) => a.id === axe.id);
      if (!serverAxe) return;

      setPendingEdits((prev) => {
        const existing = prev[axe.id] || {};
        const updated = { ...existing, [field]: event.newValue };

        const sideVal = updated.side ?? serverAxe.side;
        const qtyVal = updated.quantity ?? serverAxe.quantity;

        // Remove from pending if values match server state
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
        .then(() => notifications.show({ title: 'Success', message: 'Axe updated', color: 'green' }))
        .catch((err) => notifications.show({ title: 'Error', message: err.message || 'Failed to update', color: 'red' }));
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
        .then(() => notifications.show({ title: 'Success', message: `Axe ${isPaused ? 'resumed' : 'paused'}`, color: 'green' }))
        .catch((err) => notifications.show({ title: 'Error', message: err.message, color: 'red' }));
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
        .then(() => notifications.show({ title: 'Success', message: `Axe ${isBlocked ? 'unblocked' : 'blocked'}`, color: 'green' }))
        .catch((err) => notifications.show({ title: 'Error', message: err.message, color: 'red' }));
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
        .then(() => notifications.show({ title: 'Success', message: 'Axe deleted', color: 'green' }))
        .catch((err) => notifications.show({ title: 'Error', message: err.message, color: 'red' }));
    },
    [deleteAxe, setAxesOptimistic]
  );

  const pendingCount = Object.keys(pendingEdits).length;

  const columnDefs = useMemo(
    () =>
      createColumnDefs({
        instruments,
        pendingEditsRef,
        onSelectInstrument: updatePinnedRowInstrument,
        onPauseResume: handlePauseResume,
        onBlockUnblock: handleBlockUnblock,
        onDelete: handleDelete,
        onSaveRow: handleSaveRow,
        onRevertRow: handleRevertRow,
        onCreatePinned: handleCreatePinned,
        onClearPinned: clearPinnedRow,
        pendingEdits,
      }),
    [
      instruments,
      updatePinnedRowInstrument,
      pendingEdits,
      handlePauseResume,
      handleBlockUnblock,
      handleDelete,
      handleSaveRow,
      handleRevertRow,
      handleCreatePinned,
      clearPinnedRow,
    ]
  );

  const pinnedTopRowData = useMemo(() => [pinnedRow], [pinnedRow]);

  const getRowStyle = useCallback((params: RowClassParams<AxeRow>): RowStyle | undefined => {
    if (params.node?.rowPinned === 'top') {
      return {
        backgroundColor: '#eef6ff',
        fontStyle: 'italic',
        borderBottom: '1px solid #dbeafe',
      };
    }
    if (params.data && pendingEditsRef.current[params.data.id]) {
      return { backgroundColor: '#fffef5' };
    }
    return undefined;
  }, []);

  const handleSaveAll = useCallback(() => {
    for (const axeId of Object.keys(pendingEdits)) {
      const axe = axes.find((a) => a.id === axeId);
      if (axe) handleSaveRow(axe);
    }
  }, [pendingEdits, axes, handleSaveRow]);

  return (
    <Stack gap="sm" style={{ height: '100%' }}>
      <Paper p="xs" withBorder>
        <Group>
          {pendingCount > 0 && (
            <Button variant="light" color="yellow" size="xs" onClick={handleSaveAll}>
              Save All ({pendingCount})
            </Button>
          )}
          {pendingCount > 0 && (
            <Button variant="light" color="gray" size="xs" onClick={() => setPendingEdits({})}>
              Revert All
            </Button>
          )}
          <Text size="sm" c="dimmed">
            {axes.length} axes · {pendingCount} dirty
          </Text>
        </Group>
      </Paper>

      <div style={{ flex: 1 }}>
        <div className="ag-theme-alpine" style={{ height: '100%', width: '100%' }}>
          <AgGridReact<AxeRow>
            ref={gridRef}
            modules={[AllCommunityModule]}
            rowData={rowData}
            pinnedTopRowData={pinnedTopRowData}
            columnDefs={columnDefs}
            getRowId={(params) => params.data.id}
            animateRows={true}
            onCellValueChanged={onCellValueChanged}
            singleClickEdit={true}
            stopEditingWhenCellsLoseFocus={true}
            getRowStyle={getRowStyle}
          />
        </div>
      </div>
    </Stack>
  );
}
