# Nuevas utilidades + tests e2e (2026-11-08)

Pedido: puntos 1, 4, 5, 6, 7, 8 y 9 de la lista de ideas, y arreglar los tests e2e.

## 0. Tests e2e (primero, para poder verificar lo demás)
- [x] `main.js`: si existe `CLARIFACTU_USER_DATA`, usarla como carpeta de datos (solo la usan los tests)
- [x] Fixture: carpeta temporal nueva por proceso de test (los tests de un fichero la comparten), `license.json` con una clave válida generada, onboarding marcado como hecho
- [x] Actualizar tests desfasados (p. ej. pestañas de Configuración) y conseguir la suite en verde

## 1. Mención de exención de IVA
- [x] Ajuste en Configuración → Facturas: texto de exención (por defecto art. 20.Uno.3º Ley 37/1992) y si se activa
- [x] Se imprime en vista previa, PDF y email cuando la factura tiene IVA 0 %

## 7 + 8. Backups
- [x] Bug: el backup copiaba solo `clarifactu.db` sin el `-wal` → usar la API de backup de SQLite (copia consistente)
- [x] Nuevo formato `.zip`: base de datos + carpeta `expense-docs/` (facturas de proveedor)
- [x] Restaurar/importar acepta `.zip` (nuevo) y `.db` (antiguo)
- [x] Backup automático al arrancar si el último tiene más de 24 h (activable en ajustes)
- [x] Carpeta externa opcional (Drive/OneDrive…): cada backup se copia también allí (se guardan los 5 últimos)

## 4. Recordatorio de cobro
- [x] Plantilla de asunto/cuerpo en Configuración → Email (con {numero}, {cliente}, {total}, {fecha}, {dias})
- [x] Botón "Enviar recordatorio" en facturas vencidas + acción en grupo; adjunta la factura en PDF
- [x] Guarda `reminder_sent_at`, lo muestra en la lista y lo anota en la actividad

## 5. Libros registro (ingresos y gastos)
- [x] Exportación anual a Excel con dos hojas: facturas emitidas y gastos, con los campos que exigen los libros registro de IRPF
      (no se garantiza que sea la plantilla exacta de importación de la AEAT)

## 6. Modelo 347
- [x] Clientes y proveedores con > 3.005,06 € (IVA incluido) en el año, con desglose trimestral
- [x] Excluye operaciones con retención de IRPF (no van en el 347); proveedores agrupados por NIF
- [x] Nueva pestaña en el resumen fiscal + exportación a Excel

## 9. Importar clientes desde CSV / Excel
- [x] CSV (separador `,` o `;`, comillas) y `.xlsx` (primera hoja)
- [x] Reconoce cabeceras en español/inglés; vista previa con nuevos/duplicados (mismo NIF o email) antes de importar

## Cierre
- [x] Tests unitarios por funcionalidad, suite unitaria y e2e en verde
- [x] README actualizado

## Review

- Unit 210/210 (3 runs in a row), e2e 45/45 with hidden windows and a throwaway data folder.
- Bugs found on the way (fixed, each with a test that fails without the fix):
  - Backups copied only `clarifactu.db`, missing everything still in the `-wal` file (on a never-checkpointed DB the copy
    had no tables at all). Now SQLite's backup API. The user's only backup is from 2026-03-12.
  - Fresh installs: the `documents.email_sent_at` migration ran before the table existed → first launch had a broken
    Dashboard (activity log stuck on "Cargando…").
  - Documents: "Aplicar plantilla" referenced an undefined `editor` (left over from the rich editor refactor) → title filled,
    content empty. Reported by the user mid-task.
  - `tests/unit/db.test.js` shared `%TEMP%/clarifactu.db` across runs (never closed, so never deleted) → flaky chain test.
- Extra request mid-task: selection bar in Facturas shows the total and the tax base of the selected invoices.
- Extra request: duplicate an expense (today's date; supplier invoice number and attachment not copied, since deleting
  an expense deletes its file).
- Not verified for real: sending a reminder through Gmail (the modal and templates are tested, not the SMTP send); the
  libros registro follow the required content but not AEAT's official import template; 347 rules worth checking with a gestoría.

## Seguridad (2026-11-08)
- npm audit 41 -> 5 low (deepmerge: no fixed release, test tooling only). Electron 29 -> 45, better-sqlite3 9 -> 13 (Node-API,
  prebuilt in the npm package: no rebuild, no tests/ copy), electron-builder 24 -> 26 (`win.sign` removed), nodemailer 8 -> 10,
  adm-zip 0.5 -> 0.6, scoped overrides for glob/minimatch. CI: Node 24 + `npm audit --audit-level=high` gate.
- Verified: unit 210/210, e2e 46/46 twice on Electron 45, packaged exe starts and its DB + backup work, NSIS + portable build.
- Electron 45 hands the window over blank before index.html loads: e2e fixture now waits for the URL.
- GitHub release asset downloads returned 504 for large files from this machine; `gh release download` (API route) worked.
  Local build used a localhost mirror with checksum-verified files (ELECTRON_MIRROR / ELECTRON_BUILDER_BINARIES_MIRROR).
- Installer size 76 MB -> 123 MB (Electron 45).

---

# (Anterior) Fix implicit state machine gaps (2026-11-08) — hecho, commit e14b066, publicado en v1.2.4

- VeriFactu: registered records final; invalidation clears the chain after; true chain tail; R1 hash/XML; chain-order submission
  with previous record data; functions moved to `src/verifactu.js`
- Credit notes: yearly counter reset; atomic rectified mark; cleared on delete
- Payment: shared overdue helper
