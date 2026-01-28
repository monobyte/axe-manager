import { Badge } from '@mantine/core';
import type { AxeStatus } from '../../types/index.ts';

const statusColors: Record<AxeStatus, string> = {
  ACTIVE: 'green',
  PAUSED: 'yellow',
  BLOCKED: 'red',
};

export function StatusBadge({ status }: { status: AxeStatus }) {
  return (
    <Badge color={statusColors[status]} variant="filled" size="sm">
      {status}
    </Badge>
  );
}
