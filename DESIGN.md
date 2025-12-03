# Design Document — Block Diagram App

This document explains architecture, data model, key components and contributor guidance so new developers can quickly join and extend the project.

Repository entry points
- Main UI and types: [`DataFlowDiagram/src/App.tsx`](DataFlowDiagram/src/App.tsx)
  - Key exported/used symbols: [`api`](DataFlowDiagram/src/App.tsx), types [`Diagram`](DataFlowDiagram/src/App.tsx), [`Block`](DataFlowDiagram/src/App.tsx), [`Port`](DataFlowDiagram/src/App.tsx), and components [`DiagramCanvas`](DataFlowDiagram/src/App.tsx), [`DiagramView`](DataFlowDiagram/src/App.tsx), [`DiagramList`](DataFlowDiagram/src/App.tsx), [`App`](DataFlowDiagram/src/App.tsx).

High-level architecture
- Single-page React app.
- UI model: top-level diagrams list and a diagram editor view.
- Diagram editor comprises:
  - Visual SVG canvas (render blocks, ports, connections).
  - Inspector panel for selected block/port editing.
  - View stack for nested group editing (enter/exit group views).
- Persistence via a JSON REST API (`/api/diagrams`).

Data model (in-code)
- Diagram: `{ id: string; name: string; blocks: Block[] }` — see [`Diagram`](DataFlowDiagram/src/App.tsx)
- Block: `{ id, name, x, y, ports?, requirements?, subblocks? }` — see [`Block`](DataFlowDiagram/src/App.tsx)
- Port: `{ id, name, side: 'left'|'right', x?, y?, target?: { blockId, portId } }` — see [`Port`](DataFlowDiagram/src/App.tsx)
- Requirements attached to blocks or specific ports: see type [`Requirement`](DataFlowDiagram/src/App.tsx)

Core algorithms & behavior
- Layout:
  - Blocks carry local coordinates `(x,y)`. The canvas computes block sizes with `blockSize(...)` and port positions with `portPos(...)`.
- Connections:
  - Ports store a `target` reference to another port via `{ blockId, portId }`.
  - Drawing uses `findPortPos(...)` to compute SVG coordinates across view boundaries (parent-edge ports when inside a group).
- Grouping:
  - `groupSelectedIntoSubblock()` promotes internal ports to group-level proxies:
    - Inputs (external → internal) become group left ports that target child ports.
    - Outputs (internal → external) become group right ports that internal ports target; group ports carry the original external targets.
  - Subblocks are stored in `block.subblocks` and coordinates are normalized relative to the group origin.
- Nested views:
  - `viewStack` holds `{ blocks, parentBlockId }[]`. Enter/exit push/pop views.
  - When entering, children render offset into a bounding box. When exiting, child coords are restored to global coordinates.

Extensibility points (good first tasks)
- Extract visual subcomponents into `src/components`:
  - DiagramCanvas, Block view, Port, Connection layer, Inspector sub-editors.
- Add drag-to-pan and zoom support on the SVG canvas.
- Add undo/redo (command stack).
- Provide automated layout (force-directed or orthogonal).
- Add arrowheads and labels on connections.
- Persist undo history or snapshots server-side.

API contract
- The app calls functions in [`api`](DataFlowDiagram/src/App.tsx) which wrap fetch. Provide a backend implementing:
  - JSON schema for Diagram as above.
  - Basic CRUD endpoints under `/api/diagrams`.

Testing
- Unit-tests: add tests for grouping logic (promotions/proxy mapping), port position calculations and connection creation.
- E2E: user flows — create diagram, add ports, connect, group and enter subblocks.
- Suggested frameworks: Jest + React Testing Library for components; Playwright for end-to-end.

Developer workflow
1. Clone, install:
   - cd DataFlowDiagram
   - npm install
2. Run dev server:
   - npm start
3. Run tests:
   - npm test
4. New features:
   - Create feature branch, add unit tests, update docs in DESIGN.md and README.md, open PR.

Deployment
- Build static assets: npm run build
- Host `build/` on any static host (Netlify, Vercel, S3), and provide backend for `/api/diagrams` (or mock local storage for demo).

Code style & organization suggestions
- Move large `App.tsx` into modular files:
  - src/components/DiagramCanvas.tsx
  - src/components/Inspector.tsx
  - src/lib/diagramModel.ts (grouping & coordinate helpers)
  - src/api/diagrams.ts (server adapter)
- Document public functions and types; add small examples in docs/ for grouping behavior and data JSON.

Onboarding checklist for new contributors
- Read this design doc and the main entry [`DataFlowDiagram/src/App.tsx`](DataFlowDiagram/src/App.tsx).
- Run the app, reproduce UI flows (add blocks, add ports, connect, group).
- Pick a labelled issue (good first issue), implement, add tests and update DESIGN.md if behavior changes.

Roadmap (short)
- v0.1: stabilize current editor, modularize code, add tests.
- v0.2: add undo/redo, drag-to-pan, zoom.
- v0.3: user accounts & remote diagram storage, collaborative editing.

Notes & references
- Inspect UI and logic directly in [`DataFlowDiagram/src/App.tsx`](DataFlowDiagram/src/App.tsx).
- Static entry: [DataFlowDiagram/index.html](DataFlowDiagram/index.html)
- Package scripts: [DataFlowDiagram/package.json](DataFlowDiagram/package.json)

End of design doc — keep this file updated as architecture and APIs evolve.