Technical Specification: AxeManager Component
1. Overview
The AxeManager is a React-based CRUD grid designed for the creation, management, and real-time monitoring of Bond Axes. It operates on a Real-time Command Query Responsibility Segregation (CQRS) pattern, merging static reference data with a high-frequency dynamic stream of Axe states.
2. Data Architecture
The application relies on two distinct data sources:
A. Reference Data (HTTP)
 * Source: REST API (/api/instruments)
 * Content: Static universe of available bonds (approximately 15,000 records).
 * Key Fields: ISIN (Primary Key), Description, Maturity, Issuer.
 * Purpose: Populates the Global Instrument Selector and provides metadata for the live axes.
B. Axe Stream (SignalR WebSocket)
 * Source: WebSocket Subscription (SubscribeToAxes)
 * Content: Dynamic stream of Axe records including creation details, status changes, and transactional updates.
 * Backend Logic: The server persists the Axe state and performs an in-memory join with the instrument master data before broadcasting.
 * Client View: Receives fully hydrated objects containing both Axe state (Quantity, Side, Status) and Instrument details.
3. Component Abstraction & Hooks
The AxeManager component consumes two custom hooks:
Hook 1: useBondInstruments
 * Responsibility: Manages static reference data.
 * Capabilities: Fetches/caches the 15k instrument list and powers the search logic for the Global Instrument Selector.
Hook 2: useBondAxes
 * Responsibility: Manages the WebSocket connection and transactional commands.
 * Capabilities: Subscribes to the stream, maintains the axes array state, and exposes commands (createOrUpdateAxe, pauseAxe, resumeAxe, blockAxe, unblockAxe, deleteAxe).
4. Logical Data Flow
A. Initialization
 * Mount: The component initializes.
 * Fetch: useBondInstruments loads the instrument universe; useBondAxes opens the SignalR connection.
 * Render: The grid renders the current list of axes from the stream.
B. Creation Workflow
 * Global Selection: The user searches for a bond using the Global Instrument Selector (Mantine AutoComplete) located in the main toolbar.
 * Initiation: User clicks "Create Axe".
 * Modal Display: A Mantine Modal opens, automatically hydrated with the bond selected in the toolbar.
 * Input: User enters Quantity and Side (Bid/Offer).
 * Submission: User clicks "Save". The component invokes createOrUpdateAxe.
 * Synchronization: The modal closes. The grid updates only when the new Axe record is broadcast back via SignalR.
C. Update Workflow (Edit)
 * Selection: User selects a single row in the AG-Grid.
 * Initiation: User clicks the "Update" button in the Global Toolbar.
 * Modal Display: The Mantine Modal opens (reusing the Create Modal layout).
   * Read-Only: Instrument details (ISIN, Description) are locked.
   * Pre-Populated: Quantity and Side are filled with the selected row's data.
 * Edit: User modifies the Quantity or Side.
 * Submission: User clicks "Save". The component invokes createOrUpdateAxe.
 * Synchronization: The modal closes. The grid row updates upon receiving the SignalR broadcast.
D. Context-Aware Status Workflow
 * Selection: User selects a single row in the AG-Grid.
 * Toolbar Reflection: The Global Toolbar action buttons (Pause, Block, Delete) update their state based on the selection.
 * Command: User clicks an action (e.g., "Pause").
 * Reflection: The backend processes the command, broadcasts the update, and the grid row re-renders.
5. UI/UX Specifications
Component Library
 * Core UI: Mantine UI (AutoComplete, Buttons, Modals, Popovers).
 * Grid Component: AG-Grid v33.
Global Toolbar
Located above the grid, this is the primary control center.
 * Instrument Selector (Left/Center):
   * Component: Mantine AutoComplete.
   * Data Source: Filtered list from useBondInstruments.
   * Behavior: Allows searching the 15k record universe by Description or ISIN.
 * Create Button:
   * Logic: Enabled when a valid instrument is selected in the Instrument Selector. Opens the modal in "Create Mode".
 * Update Button:
   * Logic: Enabled when a row is selected in the grid. Opens the modal in "Edit Mode" (Instrument details read-only).
 * Action Buttons (Right Aligned):
   * Pause/Resume & Block/Unblock: Context-aware Mantine Buttons. Labels and functionality toggle based on the selected grid row's status.
   * Delete: Shows a Mantine Popover (Yes/Cancel) on click. Disabled if no row is selected.
Main Grid Layout
 * Version: AG-Grid v33.
 * Row Model: Client-side (driven by WebSocket array).
 * Selection: Single row selection (drives the Update and Action Buttons).
 * Columns: ISIN, Description, Side, Quantity, Status (Badge), Last Update.
6. Status Transition Logic
The Global Action Buttons adhere to the following state machine based on the Selected Row:
 * Status: ACTIVE
   * Actions: Update, Pause, Block, Delete.
 * Status: PAUSED
   * Actions: Update, Resume, Delete.
 * Status: BLOCKED
   * Actions: Update, Unblock, Delete.
