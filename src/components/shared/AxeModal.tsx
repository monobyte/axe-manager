import { useState, useEffect } from 'react';
import { Modal, TextInput, NumberInput, Select, Button, Group, Stack } from '@mantine/core';
import type { Axe, AxeSide, BondInstrument } from '../../types/index.ts';

interface AxeModalProps {
  opened: boolean;
  onClose: () => void;
  onSave: (data: { isin: string; side: AxeSide; quantity: number; id?: string }) => void;
  mode: 'create' | 'edit';
  instrument?: BondInstrument | null;
  axe?: Axe | null;
  saving?: boolean;
}

export function AxeModal({ opened, onClose, onSave, mode, instrument, axe, saving }: AxeModalProps) {
  const [side, setSide] = useState<AxeSide>('Bid');
  const [quantity, setQuantity] = useState<number>(1000000);

  useEffect(() => {
    if (opened) {
      if (mode === 'edit' && axe) {
        setSide(axe.side);
        setQuantity(axe.quantity);
      } else {
        setSide('Bid');
        setQuantity(1000000);
      }
    }
  }, [opened, mode, axe]);

  const displayIsin = mode === 'edit' ? axe?.isin : instrument?.isin;
  const displayDesc = mode === 'edit' ? axe?.description : instrument?.description;

  const handleSave = () => {
    if (!displayIsin) return;
    onSave({
      isin: displayIsin,
      side,
      quantity,
      id: mode === 'edit' ? axe?.id : undefined,
    });
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={mode === 'create' ? 'Create Axe' : 'Update Axe'}
      size="md"
    >
      <Stack gap="md">
        <TextInput label="ISIN" value={displayIsin ?? ''} readOnly />
        <TextInput label="Description" value={displayDesc ?? ''} readOnly />
        <Select
          label="Side"
          value={side}
          onChange={(val) => val && setSide(val as AxeSide)}
          data={[
            { value: 'Bid', label: 'Bid' },
            { value: 'Offer', label: 'Offer' },
          ]}
        />
        <NumberInput
          label="Quantity"
          value={quantity}
          onChange={(val) => setQuantity(typeof val === 'number' ? val : 0)}
          min={1}
          step={100000}
          thousandSeparator=","
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} loading={saving}>
            Save
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
