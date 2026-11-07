# Fix implicit state machine gaps (2026-11-08)

- [x] VeriFactu: registered invoices (`enviada` / CSV) cannot be edited, deleted or re-hashed (enforced in db + main, hidden in UI)
- [x] VeriFactu: invalidating a pending hash also clears pending hashes chained after it (edit, delete, recalc, renumber); block if a later record is registered
- [x] VeriFactu: edit clears hash only when a hashed field changes (date, tax_amount, total)
- [x] VeriFactu: chain tail = record nobody chains to (not highest id); "Calcular huellas" processes in creation order
- [x] Credit notes: rectificativa counter resets each year (shared year check)
- [x] Credit notes: creating R1 marks original in the same transaction; deleting R1 clears `rectified` if no other R1 remains
- [x] Payment: single overdue helper honouring `overdue_days` (invoices + clients pages)
- [x] Unit tests for each, full suite green (157/157, twice against a persisted temp DB)
- [ ] Manual check in the app (e2e suite cannot run: see review)

## Review

- All fixes live in the db layer (src/database/db.js), so the UI cannot bypass them; the UI only hides actions that would be refused.
- `markAsRectified` IPC removed: `invoices.create` marks the original in the same transaction.
- e2e (Playwright) suite is not usable as-is: launched as `electron main.js` the app uses `%APPDATA%/Electron`, which has no license,
  so every test gets the activation window. Fix idea: give the fixture its own userData dir + a test license (or bypass when NODE_ENV=test).
- Follow-up (fixed): VeriFactu hash/XML/QR moved to `src/verifactu.js`, shared by main.js and the tests (they used to test copies).
  - Credit notes hashed and sent as `R1` with `TipoRectificativa=I` + `FacturasRectificadas` (the corrected invoice)
  - `db.verifactu.getRecordsForSubmission` loads records in chain order with the previous record's number/date
    (`NumSerieFacturaAnterior` / `FechaExpedicionFacturaAnterior` were always sent empty) for XML export, cert and DNIe submit
  - Unit 162/162, integration (AEAT preproduction) 22/22. User's DB checked read-only: VeriFactu off, no credit notes → no stale hashes.
  - Not verified against AEAT with a real certificate: the R1 XML has only been checked for structure/order, not accepted by AEAT.
