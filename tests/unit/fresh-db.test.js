/**
 * A brand-new database (first launch of a new install) must get the full schema.
 * Migrations that run before their table exists fail silently, so this guards
 * against that ordering bug.
 */
const os = require('os');
const path = require('path');
const fs = require('fs');

let db;
let dir;

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'clarifactu-fresh-'));
  jest.isolateModules(() => { db = require('../../src/database/db'); });
  db.initialize(dir);
});

afterAll(() => {
  try { db.close(); } catch (_) {}
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
});

test('dashboard document stats work on the first launch', () => {
  expect(() => db.dashboard.getDocumentStats()).not.toThrow();
});

test('documents can be marked as emailed on the first launch', () => {
  const doc = db.documents.create({ title: 'Consentimiento', body: '', client_id: null });
  db.documents.markEmailSent(doc.id);
  expect(db.documents.getById(doc.id).email_sent_at).toBeTruthy();
});

test('IVA exemption note is on by default with the art. 20 text', () => {
  const biz = db.settings.getBusiness();
  expect(biz.iva_exempt_enabled).toBe(1);
  expect(biz.iva_exempt_text).toMatch(/artículo 20\.Uno\.3º/);
});

test('IVA exemption note can be changed, and an empty text falls back to the default', () => {
  let biz = db.settings.saveIvaExemption({ iva_exempt_enabled: false, iva_exempt_text: 'Exento art. 20' });
  expect(biz.iva_exempt_enabled).toBe(0);
  expect(biz.iva_exempt_text).toBe('Exento art. 20');
  biz = db.settings.saveIvaExemption({ iva_exempt_enabled: true, iva_exempt_text: '   ' });
  expect(biz.iva_exempt_text).toMatch(/artículo 20\.Uno\.3º/);
});

describe('payment reminders', () => {
  test('a default reminder template exists, with the {dias} variable', () => {
    const cfg = db.emailSettings.get();
    expect(cfg.reminder_subject).toMatch(/\{numero\}/);
    expect(cfg.reminder_body).toMatch(/\{dias\}/);
  });

  test('saving the email form keeps fields it does not send, and empty templates fall back to the default', () => {
    db.emailSettings.save({ gmail_user: 'yo@gmail.com', gmail_app_password: 'x', default_subject: 'Factura {numero}', default_body: 'Hola',
      reminder_subject: 'Pendiente {numero}', reminder_body: 'Paga {total}' });
    db.emailSettings.save({ gmail_user: 'otro@gmail.com' });
    let cfg = db.emailSettings.get();
    expect(cfg.gmail_user).toBe('otro@gmail.com');
    expect(cfg.reminder_subject).toBe('Pendiente {numero}');
    db.emailSettings.save({ reminder_subject: '  ', reminder_body: '' });
    cfg = db.emailSettings.get();
    expect(cfg.reminder_subject).toMatch(/Recordatorio/);
    expect(cfg.reminder_body).toMatch(/\{dias\}/);
  });

  test('sending a reminder records when', () => {
    const inv = db.invoices.create({ invoice_number: 'REM-1', client_id: null, date: '2026-01-01', notes: '',
      subtotal: 10, tax_rate: 0, tax_amount: 0, irpf_rate: 0, irpf_amount: 0, total: 10, items: [] });
    expect(db.invoices.getById(inv.id).reminder_sent_at).toBe('');
    db.invoices.markReminderSent(inv.id);
    expect(db.invoices.getById(inv.id).reminder_sent_at).toMatch(/^\d{4}-\d{2}-\d{2} /);
  });
});
