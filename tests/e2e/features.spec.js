/**
 * E2E tests – IVA exemption note, payment reminders, backups, modelo 347 and client import.
 */

const path = require('path');
const fs = require('fs');
const os = require('os');
const { test, expect } = require('./fixtures');

const isoDaysAgo = d => new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);

async function makeInvoice(window, over = {}) {
  return window.evaluate(async (over) => {
    // A distinct NIF per client unless one is given (the 347 groups clients by NIF)
    const nif = over.nif ?? `E2E${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const client = await window.api.clients.create({ name: over.clientName || 'Cliente Funciones E2E', nif, address: '', email: 'cliente-e2e@test.com', phone: '', notes: '' });
    return window.api.invoices.create({
      invoice_number: over.number, client_id: client.id, date: over.date, notes: '',
      subtotal: 60, tax_rate: over.tax_rate || 0, tax_amount: over.tax_amount || 0, irpf_rate: 0, irpf_amount: 0,
      total: 60 + (over.tax_amount || 0),
      items: [{ service_id: null, service_name: 'Sesión', description: '', quantity: 1, unit_price: 60, total: 60 }]
    });
  }, over);
}

test.describe('New features', () => {
  test('invoices without VAT show the exemption note; invoices with VAT do not', async ({ window }) => {
    const exempt = await makeInvoice(window, { number: 'E2E-EX-1', date: isoDaysAgo(1) });
    const withVat = await makeInvoice(window, { number: 'E2E-EX-2', date: isoDaysAgo(1), tax_rate: 21, tax_amount: 12.6 });

    await window.locator('.nav-item[data-page="invoices"]').click();
    await window.waitForSelector('#invoices-tbody, .table');
    await window.evaluate(id => viewInvoice(id), exempt.id);
    await expect(window.locator('#modal-overlay .inv-iva-exempt')).toContainText('artículo 20.Uno.3º');
    await window.locator('#modal-close-btn').click();

    await window.evaluate(id => viewInvoice(id), withVat.id);
    await expect(window.locator('#modal-overlay .inv-title')).toBeVisible();
    await expect(window.locator('#modal-overlay .inv-iva-exempt')).toHaveCount(0);
    await window.locator('#modal-close-btn').click();
  });

  test('the exemption text can be changed in Configuración → Facturas', async ({ window }) => {
    await window.locator('.nav-item[data-page="settings"]').click();
    await window.locator('.settings-tab[data-tab="facturas"]').click();
    await window.locator('#iva-exempt-text').fill('Exento de IVA (art. 20 LIVA)');
    await window.locator('#iva-exempt-save').click();
    await expect(window.locator('.toast').last()).toContainText('Mención de exención guardada');
    const biz = await window.evaluate(() => window.api.settings.getBusiness());
    expect(biz.iva_exempt_text).toBe('Exento de IVA (art. 20 LIVA)');
  });

  test('overdue invoices offer a payment reminder with the reminder template', async ({ window }) => {
    await window.evaluate(() => window.api.email.saveSettings({ gmail_user: 'yo@gmail.com', gmail_app_password: 'x' }));
    const overdue = await makeInvoice(window, { number: 'E2E-REM-1', date: isoDaysAgo(90), clientName: 'Moroso E2E' });
    await makeInvoice(window, { number: 'E2E-REM-2', date: isoDaysAgo(1), clientName: 'Al día E2E' });

    await window.locator('.nav-item[data-page="invoices"]').click();
    const overdueRow = window.locator('tr').filter({ hasText: 'E2E-REM-1' });
    const recentRow = window.locator('tr').filter({ hasText: 'E2E-REM-2' });
    await expect(overdueRow.locator('button[title="Enviar recordatorio de cobro"]')).toHaveCount(1);
    await expect(recentRow.locator('button[title="Enviar recordatorio de cobro"]')).toHaveCount(0);

    await overdueRow.locator('button[title="Enviar recordatorio de cobro"]').click();
    await expect(window.locator('#modal-overlay')).toContainText('Enviar recordatorio de cobro');
    await expect(window.locator('#send-email-subject')).toHaveValue('Recordatorio: factura E2E-REM-1 pendiente de pago');
    await expect(window.locator('#send-email-body')).toHaveValue(/90 días/);
    await window.locator('#modal-close-btn').click();
    expect(overdue.id).toBeTruthy();
  });

  test('selecting invoices shows the sum of their income', async ({ window }) => {
    const a = await makeInvoice(window, { number: 'E2E-SUM-1', date: isoDaysAgo(3) });                                   // 60,00
    const b = await makeInvoice(window, { number: 'E2E-SUM-2', date: isoDaysAgo(3), tax_rate: 21, tax_amount: 12.6 });  // 72,60
    await window.locator('.nav-item[data-page="invoices"]').click();
    await window.locator(`.inv-select-cb[data-id="${a.id}"]`).check();
    await expect(window.locator('#bulk-action-bar .bulk-sum')).toHaveText('Total 60,00 €');
    await expect(window.locator('#bulk-action-bar .bulk-base')).toHaveText(''); // no VAT: base = total
    await window.locator(`.inv-select-cb[data-id="${b.id}"]`).check();
    await expect(window.locator('#bulk-action-bar .bulk-count')).toHaveText('2 facturas seleccionadas');
    await expect(window.locator('#bulk-action-bar .bulk-sum')).toHaveText('Total 132,60 €');
    await expect(window.locator('#bulk-action-bar .bulk-base')).toHaveText('· base 120,00 €');
    await window.locator(`.inv-select-cb[data-id="${a.id}"]`).uncheck();
    await expect(window.locator('#bulk-action-bar .bulk-sum')).toHaveText('Total 72,60 €');
  });

  test('creating a backup produces a zip and shows it in the list', async ({ window, userDataDir }) => {
    await window.locator('.nav-item[data-page="settings"]').click();
    await window.locator('.settings-tab[data-tab="backup"]').click();
    await expect(window.locator('#auto-backup')).toBeChecked();
    await window.locator('#create-backup-btn').click();
    await expect(window.locator('.toast').last()).toContainText('Backup creado');
    await expect(window.locator('#backup-list-container')).toContainText('.zip');
    const files = fs.readdirSync(path.join(userDataDir, 'backups'));
    expect(files.some(f => /^backup_.*\.zip$/.test(f))).toBe(true);
  });

  test('the fiscal summary has a Modelo 347 tab', async ({ window }) => {
    await makeInvoice(window, { number: 'E2E-347-1', date: isoDaysAgo(2), clientName: 'Gran Cliente 347' });
    await window.evaluate(async () => {
      const [c] = (await window.api.clients.getAll()).filter(x => x.name === 'Gran Cliente 347');
      await window.api.invoices.create({ invoice_number: 'E2E-347-2', client_id: c.id, date: new Date().toISOString().slice(0, 10), notes: '',
        subtotal: 4000, tax_rate: 0, tax_amount: 0, irpf_rate: 0, irpf_amount: 0, total: 4000, items: [] });
    });
    await window.locator('.nav-item[data-page="dashboard"]').click();
    await window.locator('.dash-tab[data-tab="fiscal"]').click();
    await window.locator('.fiscal-subtab[data-ftab="m347"]').click();
    await expect(window.locator('#ftab-m347')).toContainText('Clientes (ventas');
    await expect(window.locator('#ftab-m347')).toContainText('Gran Cliente 347');
  });

  test('clients can be imported from a CSV, skipping duplicates', async ({ app, window }) => {
    // The existing client the CSV repeats (each test sets up its own data)
    await window.evaluate(() => window.api.clients.create({ name: 'Ya existente', nif: '12345678Z', address: '', email: '', phone: '', notes: '' }));
    const csv = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'clarifactu-csv-')), 'clientes.csv');
    fs.writeFileSync(csv, '﻿Nombre;NIF;Email;Teléfono\nImportada Uno;11111111H;uno@imp.es;600000001\nImportada Dos;;dos@imp.es;\nRepetida;12345678Z;;\n');
    // Stand in for the file picker
    await app.evaluate(({ dialog }, file) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] });
    }, csv);

    await window.locator('.nav-item[data-page="clients"]').click();
    await window.locator('#import-clients-btn').click();
    await expect(window.locator('#modal-overlay')).toContainText('2 nuevos');
    await expect(window.locator('#modal-overlay')).toContainText('1 se omitirán');
    await window.locator('#confirm-import-btn').click();
    await expect(window.locator('.toast').last()).toContainText('2 clientes importados');
    await expect(window.locator('#clients-tbody')).toContainText('Importada Uno');
    await expect(window.locator('#clients-tbody')).toContainText('Importada Dos');
  });
});

test.describe('Expenses', () => {
  test('an expense can be duplicated: same data, today\'s date, no supplier invoice number or attachment', async ({ window }) => {
    const today = new Date().toISOString().slice(0, 10);
    const lastMonth = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const src = await window.evaluate((date) => window.api.expenses.create({
      date, description: 'Alquiler consulta E2E', category: 'ARRENDAMIENTOS', provider: 'Inmobiliaria E2E',
      provider_nif: 'B99999999', invoice_number: 'ALQ-0042', amount: 500, iva_rate: 21, deductible_pct: 100,
      pdf_file: 'gasto-original.pdf', notes: 'Mensual'
    }), lastMonth);

    await window.locator('.nav-item[data-page="expenses"]').click();
    await window.evaluate(id => duplicateExpense(id), src.id);

    await expect(window.locator('#modal-overlay')).toContainText('Duplicar gasto');
    await expect(window.locator('#exp-description')).toHaveValue('Alquiler consulta E2E');
    await expect(window.locator('#exp-provider')).toHaveValue('Inmobiliaria E2E');
    await expect(window.locator('#exp-amount')).toHaveValue('500');
    await expect(window.locator('#exp-date')).toHaveValue(today);
    await expect(window.locator('#exp-invoice-number')).toHaveValue('');
    await expect(window.locator('#expense-doc-preview')).toBeHidden(); // empty placeholder, no attachment
    await expect(window.locator('#exp-attach-btn')).toBeVisible();

    await window.locator('#exp-invoice-number').fill('ALQ-0043');
    await window.locator('#exp-save-btn').click();
    await expect(window.locator('.toast').last()).toContainText('Gasto creado');

    const all = await window.evaluate(() => window.api.expenses.getAll());
    const copies = all.filter(e => e.description === 'Alquiler consulta E2E');
    expect(copies).toHaveLength(2);
    const copy = copies.find(e => e.id !== src.id);
    expect(copy).toMatchObject({ date: today, invoice_number: 'ALQ-0043', provider_nif: 'B99999999', category: 'ARRENDAMIENTOS', total: 605, pdf_file: '' });
    expect(copies.find(e => e.id === src.id)).toMatchObject({ date: lastMonth, invoice_number: 'ALQ-0042', pdf_file: 'gasto-original.pdf' });
  });
});
