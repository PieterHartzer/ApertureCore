# SQL workspace

Open /sql-workspace from the new dashboard button. Choose a saved PostgreSQL connection, inspect its schema, load/download a local Qwen coding model, ask a question, edit the generated SQL, and test it. Results appear beside the editor on desktop and below on narrow screens. Queries can be saved for dashboard widgets.

The packaged WebLLM runtime is served by Nitro as a static asset to avoid development transforms overflowing on embedded WASM. Local engine loading follows the provided WebLLM reference. Cache detection is browser/origin scoped, generation does not execute SQL automatically, and the existing tenant-scoped read-only query API enforces limits. Model errors and schema/query errors appear at the top; schema errors also appear next to the connection control.

Schema discovery includes accessible columns, PostgreSQL types, nullability, primary/foreign key constraints. Large schemas are rejected explicitly rather than silently truncated. Tests cover schema formatting and limits, authentication/rate limiting, local model loading and cancellation, prompt construction, and chart resize lifecycle safety.

Local configuration: restored the existing Docker development encryption key in ignored .env.development after verifying it matches the saved connection records. No stored credentials were changed.

Live database blocker: saved connection targets CentralDB-PG:5432/motiplate_db. That hostname does not resolve here. localhost:55432 contains postgres, aperture_core_dev, plaasonkostes and plaasonkostes_shadow; it does not contain motiplate_db. Awaiting the user's selected target or existing server location.
