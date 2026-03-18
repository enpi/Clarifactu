/**
 * Unit tests for the database layer (src/database/db.js).
 * Uses a temporary SQLite file that is deleted after all tests complete.
 */

const os = require('os');
const path = require('path');
const fs = require('fs');

const DB_DIR = os.tmpdir();
const DB_PATH = path.join(DB_DIR, `clarifactu_test_${Date.now()}.db`);

let db;

beforeAll(() => {
  db = require('../../src/database/db');
  db.initialize(DB_DIR);
  // Override the db path used in initialize – since db.js builds the path
  // internally from userDataPath, we pass the tmpdir and the file ends up at
  // DB_PATH (tmpdir/clarifactu.db). Rename so we can clean up predictably.
});

afterAll(() => {
  // Clean up the temporary database file(s)
  const defaultTmpDb = path.join(DB_DIR, 'clarifactu.db');
  [defaultTmpDb, DB_PATH].forEach(p => {
    try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch (_) {}
    try { if (fs.existsSync(p + '-wal')) fs.unlinkSync(p + '-wal'); } catch (_) {}
    try { if (fs.existsSync(p + '-shm')) fs.unlinkSync(p + '-shm'); } catch (_) {}
  });
});

// ─── Clients ──────────────────────────────────────────────────────────────────

describe('Clients', () => {
  let clientId;

  test('create client returns object with id', () => {
    const result = db.clients.create({
      name: 'Ana García',
      nif: '12345678A',
      address: 'Calle Mayor 1, Madrid',
      email: 'ana@example.com',
      phone: '600111222',
      notes: 'Cliente de prueba'
    });
    expect(result).toHaveProperty('id');
    expect(result.id).toBeGreaterThan(0);
    clientId = result.id;
  });

  test('getById returns correct data', () => {
    const client = db.clients.getById(clientId);
    expect(client).not.toBeNull();
    expect(client.name).toBe('Ana García');
    expect(client.nif).toBe('12345678A');
    expect(client.email).toBe('ana@example.com');
  });

  test('getAll returns array that includes the created client', () => {
    const all = db.clients.getAll();
    expect(Array.isArray(all)).toBe(true);
    const found = all.find(c => c.id === clientId);
    expect(found).toBeDefined();
    expect(found.name).toBe('Ana García');
  });

  test('update modifies client fields', () => {
    const updated = db.clients.update(clientId, {
      name: 'Ana García López',
      nif: '12345678A',
      address: 'Calle Mayor 2, Madrid',
      email: 'ana@updated.com',
      phone: '600111333',
      notes: 'Actualizada'
    });
    expect(updated.name).toBe('Ana García López');
    expect(updated.email).toBe('ana@updated.com');
    expect(updated.phone).toBe('600111333');
  });

  test('search finds client by name', () => {
    const results = db.clients.search('García Ló');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].name).toBe('Ana García López');
  });

  test('search finds client by email', () => {
    const results = db.clients.search('ana@updated.com');
    expect(results.length).toBeGreaterThan(0);
  });

  test('delete removes client from getAll', () => {
    db.clients.delete(clientId);
    const all = db.clients.getAll();
    const found = all.find(c => c.id === clientId);
    expect(found).toBeUndefined();
  });
});

// ─── Services ─────────────────────────────────────────────────────────────────

describe('Services', () => {
  let serviceId;

  test('create service returns object with id', () => {
    const result = db.services.create({
      name: 'Consulta individual',
      description: 'Sesión de terapia individual',
      price: 70.0,
      duration: '50 min'
    });
    expect(result).toHaveProperty('id');
    expect(result.id).toBeGreaterThan(0);
    serviceId = result.id;
  });

  test('getById returns correct data', () => {
    const svc = db.services.getById(serviceId);
    expect(svc).not.toBeNull();
    expect(svc.name).toBe('Consulta individual');
    expect(svc.price).toBe(70.0);
  });

  test('getAll includes created service', () => {
    const all = db.services.getAll();
    expect(Array.isArray(all)).toBe(true);
    const found = all.find(s => s.id === serviceId);
    expect(found).toBeDefined();
  });

  test('update modifies service fields', () => {
    const updated = db.services.update(serviceId, {
      name: 'Consulta individual actualizada',
      description: 'Sesión actualizada',
      price: 80.0,
      duration: '60 min'
    });
    expect(updated.name).toBe('Consulta individual actualizada');
    expect(updated.price).toBe(80.0);
  });

  test('search finds service by name', () => {
    const results = db.services.search('individual');
    expect(results.length).toBeGreaterThan(0);
  });

  test('delete removes service from getAll', () => {
    db.services.delete(serviceId);
    const all = db.services.getAll();
    const found = all.find(s => s.id === serviceId);
    expect(found).toBeUndefined();
  });
});

// ─── Invoices ─────────────────────────────────────────────────────────────────

describe('Invoices', () => {
  let clientId;
  let invoiceId;
  const INVOICE_YEAR = 2026;

  beforeAll(() => {
    // Create a client to reference in invoices
    const client = db.clients.create({
      name: 'Pedro Ruiz',
      nif: '87654321B',
      address: 'Avenida Test 10',
      email: 'pedro@test.com',
      phone: '611000000',
      notes: ''
    });
    clientId = client.id;
  });

  afterAll(() => {
    db.clients.delete(clientId);
  });

  test('create invoice with items returns object with client_name', () => {
    const result = db.invoices.create({
      invoice_number: `F-${INVOICE_YEAR}-0001`,
      client_id: clientId,
      date: `${INVOICE_YEAR}-03-10`,
      notes: 'Notas de prueba',
      subtotal: 100.0,
      tax_rate: 21,
      tax_amount: 21.0,
      irpf_rate: 0,
      irpf_amount: 0,
      total: 121.0,
      items: [
        {
          service_id: null,
          service_name: 'Sesión terapia',
          description: '',
          quantity: 1,
          unit_price: 100.0,
          total: 100.0
        }
      ]
    });
    expect(result).not.toBeNull();
    expect(result).toHaveProperty('id');
    expect(result.client_name).toBe('Pedro Ruiz');
    invoiceId = result.id;
  });

  test('getById returns invoice with client_name', () => {
    const inv = db.invoices.getById(invoiceId);
    expect(inv).not.toBeNull();
    expect(inv.invoice_number).toBe(`F-${INVOICE_YEAR}-0001`);
    expect(inv.client_name).toBe('Pedro Ruiz');
    expect(inv.total).toBe(121.0);
  });

  test('getAll includes the created invoice', () => {
    const all = db.invoices.getAll();
    expect(Array.isArray(all)).toBe(true);
    const found = all.find(i => i.id === invoiceId);
    expect(found).toBeDefined();
    expect(found.client_name).toBe('Pedro Ruiz');
  });

  test('getByYear returns invoice for correct year', () => {
    const byYear = db.invoices.getByYear(INVOICE_YEAR);
    const found = byYear.find(i => i.id === invoiceId);
    expect(found).toBeDefined();
  });

  test('getByYear returns empty for wrong year', () => {
    const byYear = db.invoices.getByYear(1999);
    const found = byYear.find(i => i.id === invoiceId);
    expect(found).toBeUndefined();
  });

  test('markEmailSent sets email_sent_at', () => {
    db.invoices.markEmailSent(invoiceId);
    const inv = db.invoices.getById(invoiceId);
    expect(inv.email_sent_at).toBeTruthy();
    expect(inv.email_sent_at).not.toBe('');
  });

  test('update modifies invoice fields and replaces items', () => {
    const updated = db.invoices.update(invoiceId, {
      client_id: clientId,
      date: `${INVOICE_YEAR}-03-15`,
      notes: 'Notas actualizadas',
      subtotal: 150.0,
      tax_rate: 21,
      tax_amount: 31.5,
      irpf_rate: 0,
      irpf_amount: 0,
      total: 181.5,
      items: [
        {
          service_id: null,
          service_name: 'Sesión actualizada',
          description: 'Desc actualizada',
          quantity: 2,
          unit_price: 75.0,
          total: 150.0
        }
      ]
    });
    expect(updated.total).toBe(181.5);
    expect(updated.notes).toBe('Notas actualizadas');
  });

  test('invoiceItems.getByInvoice returns items', () => {
    const items = db.invoiceItems.getByInvoice(invoiceId);
    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBe(1);
    expect(items[0].service_name).toBe('Sesión actualizada');
    expect(items[0].quantity).toBe(2);
  });

  test('search finds invoice by invoice_number', () => {
    const results = db.invoices.search(`F-${INVOICE_YEAR}-0001`);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].id).toBe(invoiceId);
  });

  test('delete removes invoice from getAll', () => {
    db.invoices.delete(invoiceId);
    const all = db.invoices.getAll();
    const found = all.find(i => i.id === invoiceId);
    expect(found).toBeUndefined();
  });
});

// ─── Settings ─────────────────────────────────────────────────────────────────

describe('Settings', () => {
  test('getBusiness returns an object', () => {
    const biz = db.settings.getBusiness();
    expect(biz).not.toBeNull();
    expect(typeof biz).toBe('object');
    expect(biz).toHaveProperty('id', 1);
  });

  test('saveBusiness persists fields correctly', () => {
    const saved = db.settings.saveBusiness({
      name: 'Mi Empresa Test',
      nif: 'B12345678',
      address: 'Calle Empresa 5',
      email: 'empresa@test.com',
      phone: '900000001',
      logo: '',
      extra_info: 'Info adicional',
      iban: 'ES0000000000000000000000'
    });
    expect(saved.name).toBe('Mi Empresa Test');
    expect(saved.nif).toBe('B12345678');
    expect(saved.iban).toBe('ES0000000000000000000000');
  });

  test('getBusiness reflects saved data', () => {
    const biz = db.settings.getBusiness();
    expect(biz.name).toBe('Mi Empresa Test');
    expect(biz.email).toBe('empresa@test.com');
  });

  test('getNumberSettings returns an object', () => {
    const ns = db.settings.getNumberSettings();
    expect(ns).not.toBeNull();
    expect(ns).toHaveProperty('id', 1);
    expect(ns).toHaveProperty('prefix');
    expect(ns).toHaveProperty('digits');
  });

  test('saveNumberSettings persists fields', () => {
    const saved = db.settings.saveNumberSettings({
      prefix: 'TF',
      separator: '/',
      show_year: 1,
      digits: 3,
      start_number: 1
    });
    expect(saved.prefix).toBe('TF');
    expect(saved.separator).toBe('/');
    expect(saved.digits).toBe(3);
  });

  test('getNumberSettings reflects saved data', () => {
    const ns = db.settings.getNumberSettings();
    expect(ns.prefix).toBe('TF');
    expect(ns.separator).toBe('/');
  });
});

// ─── ActivityLog ──────────────────────────────────────────────────────────────

describe('ActivityLog', () => {
  test('add entry is returned by getRecent', () => {
    db.activityLog.add({
      action_type: 'invoice_created',
      invoice_id: 9999,
      invoice_number: 'TF/2026/001',
      client_name: 'Cliente Test',
      details: 'Factura creada en tests'
    });

    const recent = db.activityLog.getRecent(10);
    expect(Array.isArray(recent)).toBe(true);
    expect(recent.length).toBeGreaterThan(0);

    const found = recent.find(r => r.invoice_number === 'TF/2026/001');
    expect(found).toBeDefined();
    expect(found.action_type).toBe('invoice_created');
    expect(found.client_name).toBe('Cliente Test');
  });

  test('adding 501 entries keeps table at ≤500 rows and getRecent(10) returns 10', () => {
    for (let i = 0; i < 501; i++) {
      db.activityLog.add({
        action_type: 'bulk_test',
        invoice_id: null,
        invoice_number: `BULK-${i}`,
        client_name: null,
        details: `Entry ${i}`
      });
    }

    const top10 = db.activityLog.getRecent(10);
    expect(top10.length).toBe(10);

    // The table should have at most 500 rows
    const all = db.activityLog.getRecent(1000);
    expect(all.length).toBeLessThanOrEqual(500);
  });
});

// ─── Verifactu ────────────────────────────────────────────────────────────────

describe('Verifactu', () => {
  test('getSettings returns object with enabled=0 by default', () => {
    const vf = db.verifactu.getSettings();
    expect(vf).not.toBeNull();
    expect(vf).toHaveProperty('id', 1);
    expect(vf.enabled).toBe(0);
  });

  test('saveSettings persists enabled and environment', () => {
    const saved = db.verifactu.saveSettings({
      enabled: 1,
      environment: 'production',
      cert_path: '/path/to/cert.p12',
      cert_password: 'secret',
      id_sistema: 'CLARIFACTU',
      version_sistema: '1.0',
      num_instalacion: '1',
      use_dnie: 0,
      cert_thumbprint: ''
    });
    expect(saved.enabled).toBe(1);
    expect(saved.environment).toBe('production');
  });

  test('getSettings reflects saved enabled and environment', () => {
    const vf = db.verifactu.getSettings();
    expect(vf.enabled).toBe(1);
    expect(vf.environment).toBe('production');
  });

  test('saveSettings restores defaults', () => {
    db.verifactu.saveSettings({
      enabled: 0,
      environment: 'test',
      cert_path: '',
      cert_password: '',
      id_sistema: 'CLARIFACTU',
      version_sistema: '1.0',
      num_instalacion: '1',
      use_dnie: 0,
      cert_thumbprint: ''
    });
    const vf = db.verifactu.getSettings();
    expect(vf.enabled).toBe(0);
    expect(vf.environment).toBe('test');
  });
});
