import { Group, ActionIcon, Tooltip } from '@mantine/core';
import {
  IconPlayerPause,
  IconPlayerPlay,
  IconLock,
  IconLockOpen,
  IconTrash,
  IconCheck,
  IconX,
  IconDeviceFloppy,
  IconArrowBackUp,
} from '@tabler/icons-react';
import type { ICellRendererParams } from 'ag-grid-community';
import type { Axe } from '../../../types/index.ts';
import type { AxeRow, PendingEdits } from './types.ts';

export type ActionsRendererProps = ICellRendererParams<AxeRow> & {
  onPauseResume: (axe: Axe) => void;
  onBlockUnblock: (axe: Axe) => void;
  onDelete: (axe: Axe) => void;
  onSaveRow: (axe: Axe) => void;
  onRevertRow: (axe: Axe) => void;
  onCreatePinned: () => void;
  onClearPinned: () => void;
  pendingEdits: PendingEdits;
};

export function ActionsRenderer(props: ActionsRendererProps) {
  const axe = props.data;
  if (!axe) return null;

  // Pinned row (new axe creation)
  if (props.node?.rowPinned === 'top') {
    const canCreate = !!axe.isin && axe.quantity != null && axe.quantity >= 1;
    return (
      <Group gap={4} wrap="nowrap" align="center" style={{ height: '100%' }}>
        <Tooltip label="Create axe">
          <ActionIcon
            size="sm"
            color="green"
            variant="subtle"
            disabled={!canCreate}
            onClick={props.onCreatePinned}
          >
            <IconCheck size={16} />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Clear">
          <ActionIcon
            size="sm"
            color="red"
            variant="subtle"
            disabled={!canCreate}
            onClick={props.onClearPinned}
          >
            <IconX size={16} />
          </ActionIcon>
        </Tooltip>
      </Group>
    );
  }

  // Existing row actions
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
