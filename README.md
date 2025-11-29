# Block Diagram App

A lightweight React + TypeScript editor for block diagrams with ports, connections and nested sub-blocks.  
Goals: simple visual editing, portable JSON diagrams, and an extensible codebase so contributors can add layout, persistence, and UX improvements.

Key runtime files
- UI and core logic: [`block-diagram-app/src/App.tsx`](block-diagram-app/src/App.tsx) — contains the main components and types: [`DiagramCanvas`](block-diagram-app/src/App.tsx), [`DiagramView`](block-diagram-app/src/App.tsx), [`DiagramList`](block-diagram-app/src/App.tsx), and [`App`](block-diagram-app/src/App.tsx).
- Static shell: [block-diagram-app/index.html](block-diagram-app/index.html)
- Project metadata & scripts: [block-diagram-app/package.json](block-diagram-app/package.json)

Features
- Create / edit diagrams with draggable square blocks, left/right ports and visual connections.
- Add/remove/edit ports and requirements via the inspector.
- Click-to-connect ports (start connect → click target).
- Group selected blocks into a subblock (appears as a block; can enter to edit children).
- Nested editing with view stack (enter/exit group views).

Quick start (local)
1. cd into the project:
   - cd block-diagram-app
2. Install and run:
   - npm install
   - npm start
3. Open http://localhost:3000 (or configured dev server port).

Build and deploy
- Build for production:
  - npm run build
- Serve built assets on any static host (Netlify, GitHub Pages, simple express/nginx).

Persistence & API
- The UI reads/writes diagrams via a simple JSON API (calls to `/api/diagrams` in [`block-diagram-app/src/App.tsx`](block-diagram-app/src/App.tsx)). Provide a backend that implements endpoints:
  - GET /api/diagrams
  - GET /api/diagrams/:id
  - POST /api/diagrams
  - PUT /api/diagrams/:id
  - DELETE /api/diagrams/:id

Contributing
- Read the design overview: [block-diagram-app/DESIGN.md](block-diagram-app/DESIGN.md)
- Fork, add a feature branch, and submit PRs with tests / screenshots.
- Keep changes modular: prefer new components under src/components and small focused commits.

Maintainers
- Encourage small PRs, include reproducible steps, and document UX changes.

License
- Add an OSS license (MIT/Apache) by creating a LICENSE file in the project root before publishing.

Contact / Joining
- Add a CONTRIBUTING.md and CODE_OF_CONDUCT.md when opening the repo for contributors. See design doc for suggested structure.

## TODO / Roadmap (short)

- Provide an easy-to-use software-architecting tool that can:
  - Automatically generate code from diagrams (per-block code generation).
  - Run simulations (SIL) and show message flows on block diagrams.
  - Support simulation blocks and sink blocks (similar workflow to Matlab Simulink) for validation and verification.
  - Allow blocks to represent simulation models, middleware, or low-level drivers.
  - Export runnable test harnesses for embedded targets and CI.

- Developer & feature goals:
  - Add block-level code generators (C/C++ for embedded, or adapters for other targets).
  - Implement SIL simulation runner and message-flow visualizer.
  - Add richer block types: Simulation, Sink, Source, Composite, and timed/event semantics.
  - Improve layout, undo/redo, pan/zoom, and collaborative editing.
  - Add automated tests for grouping, port promotion, and connection correctness.

## About the author / project intent

This project is developed to help firmware and embedded software engineers design, simulate and generate code for embedded systems (including middleware and low-level components). The author is a firmware and embedded software engineer; the app is intended primarily for embedded-system architecture, simulation, and validation workflows.

Contributors are welcome to help implement code generation, simulation backends, and improve the UX for embedded-system use cases.
