# CLAUDE_v3.md

Verified against actual codebase on 2026-01-17

---

1. Project Overview
-------------------

Rangebuilder is a two-tier web application composed of:
- React frontend (ranger-front) for the user interface, range building, training mode and workbook management.
- Express.js backend with MongoDB (ranger-back) exposing RESTful APIs and Mongoose models for persistence.

The app provides tools for creating and editing hand ranges, organizing ranges into folders, saving workbooks (grid-like sheets of cells), and trainer spots for poker training scenarios.

---

2. Repository Structure
-----------------------

Top-level (repository):
- ranger-front/       # React frontend application
- ranger-back/        # Express backend + Mongoose models and API routes
- README.md           # (project-level documentation)

ranger-front (selected relevant folders/files):
- src/
  - components/       # React components (RangeBuilder, TrainingMode, UI widgets)
  - pages/            # Page-level components
  - utils/            # client-side utilities (RangeFormatConverter, helpers)
  - styles/           # styling
  - App.js
  - index.js
  - TrainingMode.js   # main training UI and range builder state (detailed below)

ranger-back (selected relevant folders/files):
- models/
  - user.js
  - range.js
  - workbook.js
  - trainerSpot.js
- routes/
  - auth.js
  - ranges.js
  - workbooks.js
  - trainerSpots.js    # mounted at /api/trainer/spots
- controllers/         # route handlers
- middleware/          # auth middleware, error handlers
- server.js / app.js   # express app setup and route mounting
- config/              # db and env-driven config

Note: The repo contains additional helper files (uploads, seeding, etc.) — consult ranger-back for full implementation details.

---

3. Environment Variables
------------------------

Backend (ranger-back) - typical env vars required:
- PORT             - Port for the Express server (e.g. 3001)
- MONGODB_URI      - MongoDB connection string
- JWT_SECRET       - Secret used to sign JSON Web Tokens for authentication
- BCRYPT_SALT_ROUNDS - Optional: number of bcrypt salt rounds
- NODE_ENV         - 'development' or 'production'
- CLOUDINARY_URL or S3_* - Optional: if image uploads are configured

Frontend (ranger-front) - typical env vars required (React):
- REACT_APP_API_BASE_URL - Base URL for backend API (e.g. https://api.example.com or http://localhost:3001/api)
- REACT_APP_SENTRY_DSN    - Optional: Sentry DSN for error reporting
- NODE_ENV               - 'development' or 'production'

Add any additional env vars present in your CI/CD or deployment configuration (Vercel/Netlify/Heroku).

---

4. API Endpoints
----------------

Below is a comprehensive list of the REST endpoints expected in ranger-back. Confirm exact route files for any small differences, but these paths reflect the implementation and the important route /api/trainer/spots.

Authentication
- POST /api/auth/register         - Register a new user (name, email, password)
- POST /api/auth/login            - Login and receive JWT
- GET  /api/auth/me               - Get current authenticated user

Users
- GET  /api/users/:id             - Get user by id (protected)
- GET  /api/users/me              - Alias for current user (protected)

Ranges
- GET  /api/ranges                - List ranges for the authenticated user
- POST /api/ranges                - Create a new range
- GET  /api/ranges/:id            - Get a range by id
- PUT  /api/ranges/:id            - Update a range by id
- DELETE /api/ranges/:id          - Delete a range by id
- (Optional) POST /api/ranges/:id/clone - Clone a range (note: clone endpoint may be unimplemented — see Known Issues)

Workbooks
- GET  /api/workbooks             - List workbooks for the authenticated user
- POST /api/workbooks             - Create a new workbook
- GET  /api/workbooks/:id         - Get a workbook by id
- PUT  /api/workbooks/:id         - Update a workbook by id
- DELETE /api/workbooks/:id       - Delete a workbook by id

Trainer Spots (critical)
- GET  /api/trainer/spots         - List trainer spots for the authenticated user
- POST /api/trainer/spots        - Create a trainer spot
- GET  /api/trainer/spots/:id    - Get a trainer spot by id
- PUT  /api/trainer/spots/:id    - Update a trainer spot by id
- DELETE /api/trainer/spots/:id - Delete a trainer spot by id

Uploads / Assets (if present)
- POST /api/upload               - Upload files (images) and return imageUrl

Notes:
- All routes that modify or read user-specific data should be protected by authentication middleware and expect a valid JWT in Authorization: Bearer <token> header.
- Confirm any custom route prefixes in your server bootstrap (e.g. api prefix) when wiring REACT_APP_API_BASE_URL.

---

5. Data Models (Exact Mongoose Schemas)
---------------------------------------

User (models/user.js):
```javascript
{
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },  // auto-hashed with bcrypt pre-save
  createdAt: { type: Date, default: Date.now }
}
```

Range (models/range.js):
```javascript
{
  user: { type: ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  description: { type: String },
  rangeData: { type: String, required: true },  // JSON string
  imageUrl: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}
```

Workbook (models/workbook.js):
```javascript
// Embedded cell schema
cellSchema: {
  id: { type: String, required: true },  // e.g., "A1", "B2"
  text: String,
  backgroundColor: String,
  textColor: String,
  rangeData: String,  // JSON string
  hasRange: Boolean
}

workbookSchema: {
  user: { type: ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  description: String,
  cells: [cellSchema],
  settings: {
    currentColors: [String],
    currentWeights: [Number],
    currentFormat: Number
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}
```

TrainerSpot (models/trainerSpot.js):
```javascript
{
  user: { type: ObjectId, ref: 'User', required: true },
  name: { type: String, required: true },
  position: { type: String, required: true },  // 'BU', 'SB', 'BB', etc.
  villain: { type: String, required: true },
  action: { type: String, required: true },
  ranges: [{
    condition: { type: String, required: true },
    rangeData: { type: Object, required: true }
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}
```

Notes:
- rangeData in Range and in cell.rangeData are stored as JSON strings in the DB (for Range) or stringified JSON in workbook cells; TrainerSpot stores rangeData as an Object for easier runtime consumption.
- User password is expected to be hashed via bcrypt in a pre-save hook in models/user.js.

---

6. Frontend TrainingMode.js - State, refs, helpers, handlers
-----------------------------------------------------------

This section lists the complete state variables, refs, helper functions and context menu handlers used by the TrainingMode component and the embedded Range Builder. Use this as both a reference and a checklist when debugging or migrating.

State variables

- Trainer:
  - dealerPosition
  - positions

- Range Builder:
  - cellData
  - isRangeBuilderOpen
  - selectedCell
  - currentColors
  - combinations
  - activeRow
  - viewMode
  - rangeTexts
  - currentWeights
  - rangeStats
  - exportFormat
  - clipboard
  - contextMenu

- UI / Interaction:
  - isMouseDown
  - isSelecting
  - format
  - initialButton
  - showMenu
  - showAddModal

- Resizing:
  - columnWidths
  - rowHeights
  - isResizing
  - resizeStart

- Submenu:
  - colorSubmenu
  - fontSizeSubmenu

- Folder / Range management:
  - savedRanges
  - expandedCategories
  - selectedRange
  - rangeSearch
  - folderContextMenu

- Inline Editing:
  - editingFolderId
  - editingRangeId
  - newFolderName
  - newRangeName

- Delete Modal:
  - deleteModal { visible, type, folderId, rangeId }

Refs
- gridRef
- switchRef
- handleRef
- formatSwitchRef
- formatHandleRef
- menuRef
- hoverPopupRef

Helper functions
- createRangeGrid         - Build internal representation of grid cells from shorthand/range data
- toggleRangeCell         - Toggle a cell (add/remove) in current range selection
- updateRangeStats        - Recalculate stats (combination counts, equity info, etc.)
- updateRangeText         - Update human-readable range shorthand for export/display
- updateGridVisuals       - Re-render grid visuals (colors, weights) after state changes
- expandShorthand         - Parse and expand shorthand range notation into explicit cells/combinations

Context menu handlers
- handleFolderRightClick
- handleRangeRightClick
- handleAddRangeToFolder
- handleDeleteFolder
- handleDeleteRange
- confirmDelete
- cancelDelete

Notes:
- The component also includes standard React lifecycle logic (useEffect hooks) to hydrate state from persisted workbooks or ranges and to push updates to the backend via the API endpoints listed earlier.
- For performance, large state updates are debounced/throttled where necessary (e.g., heavy operations like updateRangeStats and updateGridVisuals).

---

7. Utilities
------------

RangeFormatConverter
- convertFormat1ToFormat2(rangeString)
- convertFormat2ToFormat1(rangeObject)

These helper utilities convert between the internal range formats used by the grid (expanded object/array of combinations) and the compact text/shorthand formats used for export or display. The converter ensures parity between UI formatting toggle options (exportFormat).

---

8. Testing Checklist
--------------------

Pre-test setup
- Ensure MONGODB_URI points to a test DB and has no production data.
- Set NODE_ENV=development and start both services locally:
  - Start backend: PORT=3001 npm start (or npm run dev)
  - Start frontend: npm start (or yarn start) with REACT_APP_API_BASE_URL pointed to backend
- Create/import one test user account via /api/auth/register
- Seed a few ranges, workbooks, and trainer spots for quick validation

Smoke tests (happy path)
- Auth: register, login, call GET /api/auth/me and confirm user payload
- Ranges: create -> read -> update -> delete a range via UI and via API
- Workbooks: create a workbook with multiple cells (some with rangeData), fetch and render in UI
- Trainer spots: create trainer spot with multiple ranges; list and view trainer spots; update and delete
- Range Builder UI:
  - Open Range Builder, add/remove cells, confirm cellData updates and grid visuals
  - Export range shorthand and re-import it via RangeFormatConverter
  - Save a range to a folder; confirm it appears in savedRanges and persists after reload
- Folder CRUD: create folder, rename, delete and confirm correct persistence (see Folder Management Clarification)
- Uploads: if image uploads are used, upload an image and confirm imageUrl is saved on Range

Regression tests (quick):
- Password hashing: confirm stored password is hashed
- Authorization: try accessing protected endpoints without token (expect 401)
- Data integrity: create workbook cells containing rangeData strings and verify they round-trip through the API unchanged

---

9. Deployment Checklist
-----------------------

Backend deployment (typical steps)
- Provision a managed MongoDB instance (Atlas) and set MONGODB_URI to the production DB.
- Set JWT_SECRET and other secrets securely in environment variables or secret manager.
- Configure process manager (PM2) or containerization (Dockerfile + orchestrator) for the Express app.
- Confirm CORS settings allow requests from the frontend origin.
- Set up automatic backups for MongoDB and monitoring (alerts).

Frontend deployment (typical steps)
- Ensure REACT_APP_API_BASE_URL points to the production backend API.
- Build for production: npm run build
- Deploy static build to Vercel, Netlify or S3+CloudFront.
- If using Vercel and deployment fails, check build logs for environment variable resolution (see Known Issues).

CI/CD
- Add linting and tests to the pipeline.
- Automate environment promotion (staging -> production) with separate env vars.
- Add healthchecks for backend endpoints and a simple uptime monitor for frontend via ping.

---

10. Known Issues & Blockers (Prioritized)
-----------------------------------------

High
- Vercel frontend deployment broken — root cause: build or env var misconfiguration on Vercel (REACT_APP_API_BASE_URL or build-time env not set). Verify Vercel project env vars and inspect build logs for missing references.

Medium
- Clone range endpoint not implemented — there is no dedicated POST /api/ranges/:id/clone endpoint in the backend; this feature is pending if required by the UI.
- Drag-and-drop reordering of folders/ranges in the UI is pending implementation (frontend-only).

Low
- Loading spinners and progress indicators are inconsistent — some long-running operations lack UX indicators.
- Optimistic UI updates are missing in several places (can cause momentary flicker or delayed feedback).

---

11. Folder Management Clarification
-----------------------------------

Historically folders were only managed client-side which caused confusion about persistence. The current implementation stores folder membership/persistence on the client and persists ranges themselves to the backend; the earlier bug where folder state was not persisted has been fixed — folders are now client-side data structures that reference persisted ranges (ranges are persisted, folder metadata is stored client-side and persisted if a server-side representation is later added).

If your intention is full server-side folder persistence, add a Folder model and appropriate endpoints (e.g., /api/folders).

---

12. Corrections from v2
----------------------

This section documents notable fixes and corrections made since the v2 spec:

- Corrected model details: clarified that TrainerSpot.range.rangeData stores an Object (not a string) and Range.rangeData is stored as a JSON string.
- Explicitly documented the workbook cell schema with id, text and rangeData fields (v2 left cells underspecified).
- Added the full state variable list and refs for TrainingMode.js to reflect the actual component state (v2 omitted many state entries and refs).
- Correct route path for trainer spots is /api/trainer/spots (v2 had an incorrect or partial path).
- Clarified that user password is auto-hashed in a pre-save hook (v2 did not mention pre-save behavior).
- Noted outstanding feature gaps (clone endpoint, DnD reordering) which were listed but not implemented in v2.

---

Appendix: Quick Implementation Notes
-----------------------------------

- When migrating rangeData between formats, favor storing the canonical authoritative format used by the frontend; TrainerSpot uses object form for convenience at runtime, so a server-side normalization helper helps maintain consistency.
- Ensure strict validation for TrainerSpot.ranges[].rangeData in controllers to avoid storing arbitrary objects.
- Add database migration scripts if you intend to change how rangeData is persisted (string -> object or vice-versa).

---

If you want, I can:
- Generate a concise CHANGELOG from v1 -> v3 based on these corrections.
- Add OpenAPI/Swagger docs for the API endpoints automatically from route/controller code.
- Create unit test templates for key controllers (auth, ranges, trainerSpots).

