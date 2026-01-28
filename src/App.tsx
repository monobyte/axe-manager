import { useState } from 'react';
import { MantineProvider, Tabs, Box, Title, Group } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import { AxeManagerV1 } from './components/v1/AxeManagerV1.tsx';
import { AxeManagerV2 } from './components/v2/AxeManagerV2.tsx';
import { AxeManagerV3 } from './components/v3/AxeManagerV3.tsx';

export default function App() {
  const [activeTab, setActiveTab] = useState<string | null>('v1');

  return (
    <MantineProvider defaultColorScheme="light">
      <Notifications position="top-right" />
      <Box
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100vh',
          padding: '16px',
          boxSizing: 'border-box',
        }}
      >
        <Group mb="md" justify="space-between">
          <Title order={3}>Axe Manager</Title>
        </Group>

        <Tabs
          value={activeTab}
          onChange={setActiveTab}
          style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}
        >
          <Tabs.List>
            <Tabs.Tab value="v1">V1 — Modal CRUD</Tabs.Tab>
            <Tabs.Tab value="v2">V2 — Inline Edit + Row Actions</Tabs.Tab>
            <Tabs.Tab value="v3">V3 — Fully Inline</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="v1" style={{ flex: 1, minHeight: 0, paddingTop: 12 }}>
            {activeTab === 'v1' && <AxeManagerV1 />}
          </Tabs.Panel>
          <Tabs.Panel value="v2" style={{ flex: 1, minHeight: 0, paddingTop: 12 }}>
            {activeTab === 'v2' && <AxeManagerV2 />}
          </Tabs.Panel>
          <Tabs.Panel value="v3" style={{ flex: 1, minHeight: 0, paddingTop: 12 }}>
            {activeTab === 'v3' && <AxeManagerV3 />}
          </Tabs.Panel>
        </Tabs>
      </Box>
    </MantineProvider>
  );
}
