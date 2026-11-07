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
      iban: 'ES0000000000000000000000',
      signature: ''
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
      start_number: 1,
      overdue_days: 30
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

// ─── Invoice renumbering ──────────────────────────────────────────────────────

describe('Invoice renumbering', () => {
  const YEAR = new Date().getFullYear();
  const PREFIX = `RN${Date.now()}`; // unique per run: the tmp DB can survive between runs
  const num = n => `${PREFIX}-${YEAR}-${String(n).padStart(3, '0')}`;
  let clientId;
  const ids = {};

  const mk = (n, date) => {
    const inv = db.invoices.create({
      invoice_number: num(n), client_id: clientId, date, notes: '',
      subtotal: 10, tax_rate: 0, tax_amount: 0, irpf_rate: 0, irpf_amount: 0, total: 10,
      items: [{ service_id: null, service_name: 'S', description: '', quantity: 1, unit_price: 10, total: 10 }]
    });
    db.settings.updateCounter(n);
    ids[n] = inv.id;
  };

  beforeAll(() => {
    clientId = db.clients.create({ name: 'Renum', nif: '', address: '', email: '', phone: '', notes: '' }).id;
    db.settings.saveNumberSettings({ prefix: PREFIX, separator: '-', show_year: 1, digits: 3, start_number: 1, overdue_days: 30 });
    db.settings.resetYearCounter(YEAR);
    mk(1, `${YEAR}-01-10`);
    mk(2, `${YEAR}-01-20`);
    mk(3, `${YEAR}-01-25`);
    db.invoices.delete(ids[2]); // leaves a gap at 002
  });

  test('getNumberingGaps detects the deleted number', () => {
    expect(db.invoices.getNumberingGaps()).toEqual([num(2)]);
  });

  test('rejects a number already in use', () => {
    const r = db.invoices.renumber(ids[3], num(1));
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/Ya existe/);
  });

  test('rejects invoices already registered in VeriFactu', () => {
    db.verifactu.updateInvoiceVerifactu(ids[1], { huella: 'H', huella_anterior: '', fecha_hora_gen: 'x', verifactu_status: 'enviada', verifactu_csv: 'CSV' });
    expect(db.invoices.checkRenumber(ids[1], num(9)).ok).toBe(false);
    db.verifactu.updateInvoiceVerifactu(ids[1], { huella: null, huella_anterior: null, fecha_hora_gen: null, verifactu_status: 'pendiente', verifactu_csv: null });
  });

  test('warns when dates would be out of order', () => {
    const inv = db.invoices.getById(ids[3]);
    db.invoices.create({ invoice_number: PREFIX + 'TMP', client_id: clientId, date: `${YEAR}-01-05`, notes: '', subtotal: 0, tax_rate: 0, tax_amount: 0, irpf_rate: 0, irpf_amount: 0, total: 0, items: [] });
    const tmp = db.invoices.getAll().find(i => i.invoice_number === PREFIX + 'TMP');
    const c = db.invoices.checkRenumber(tmp.id, num(2)); // dated before 001
    expect(c.ok).toBe(true);
    expect(c.warnings.join(' ')).toMatch(/orden/);
    db.invoices.delete(tmp.id);
    expect(db.invoices.checkRenumber(inv.id, num(2)).warnings).toEqual([]);
  });

  test('moves the last invoice into the gap and pulls the counter back', () => {
    const r = db.invoices.renumber(ids[3], num(2));
    expect(r).toEqual({ success: true, oldNumber: num(3), newNumber: num(2) });
    expect(db.invoices.getById(ids[3]).invoice_number).toBe(num(2));
    expect(db.settings.getNumberSettings().counter).toBe(2);
    expect(db.invoices.getNumberingGaps()).toEqual([]);
    const log = db.activityLog.getRecent(5).find(e => e.action_type === 'factura_renumerada');
    expect(log.details).toBe(`${num(3)} → ${num(2)}`);
  });

  test('clears an unsent VeriFactu hash so it gets recalculated', () => {
    db.verifactu.updateInvoiceVerifactu(ids[3], { huella: 'ABC', huella_anterior: '', fecha_hora_gen: 'x', verifactu_status: 'pendiente', verifactu_csv: null });
    expect(db.invoices.renumber(ids[3], num(5)).success).toBe(true);
    expect(db.invoices.getById(ids[3]).huella).toBeNull();
  });
});

// ─── Invoice state machines ───────────────────────────────────────────────────

describe('Invoice state transitions', () => {
  const RUN = `SM${Date.now()}`; // unique per run: the tmp DB can survive between runs
  const YEAR = new Date().getFullYear();
  let clientId;
  let seq = 0;

  const base = (over = {}) => ({
    invoice_number: `${RUN}-${++seq}`, client_id: clientId, date: `${YEAR}-02-01`, notes: '',
    subtotal: 100, tax_rate: 0, tax_amount: 0, irpf_rate: 0, irpf_amount: 0, total: 100, items: [], ...over
  });
  const mk = (over) => db.invoices.create(base(over));
  const get = id => db.invoices.getById(id);
  const setVf = (id, huella, prev, status = 'pendiente', csv = null) =>
    db.verifactu.updateInvoiceVerifactu(id, { huella, huella_anterior: prev, fecha_hora_gen: new Date(Date.now() + (++seq) * 1000).toISOString().slice(0, 19) + '+01:00', verifactu_status: status, verifactu_csv: csv });
  const edit = (inv, over) => db.invoices.update(inv.id, { ...base(), ...inv, ...over, items: [] });

  // Three pending records chained A → B → C
  const chain = () => {
    const a = mk(), b = mk(), c = mk();
    const [ha, hb, hc] = ['A', 'B', 'C'].map(x => `${RUN}${x}${c.id}`);
    setVf(a.id, ha, '');
    setVf(b.id, hb, ha);
    setVf(c.id, hc, hb);
    return [get(a.id), get(b.id), get(c.id)];
  };

  beforeAll(() => {
    clientId = db.clients.create({ name: 'SM', nif: '', address: '', email: '', phone: '', notes: '' }).id;
  });

  describe('VeriFactu: registered records are final', () => {
    let reg;
    beforeAll(() => { reg = mk(); setVf(reg.id, `${RUN}REG`, '', 'enviada', 'CSV1'); });

    test('cannot be edited', () => {
      expect(() => edit(get(reg.id), { total: 50 })).toThrow(/registrada en VeriFactu/);
    });
    test('cannot be deleted', () => {
      expect(() => db.invoices.delete(reg.id)).toThrow(/registrada en VeriFactu/);
      expect(get(reg.id)).toBeTruthy();
    });
    test('cannot get a new hash', () => {
      expect(() => db.verifactu.prepareHash(reg.id)).toThrow(/registrada en VeriFactu/);
      expect(get(reg.id).verifactu_csv).toBe('CSV1');
    });
  });

  describe('VeriFactu: invalidating a pending hash', () => {
    test('editing a hashed field clears that record and every record chained after it', () => {
      const [a, b, c] = chain();
      edit(b, { total: 120 });
      expect(get(a.id).huella).toBe(a.huella);
      expect(get(b.id).huella).toBeNull();
      expect(get(c.id).huella).toBeNull();
    });

    test('editing only the notes keeps the hashes', () => {
      const [, b, c] = chain();
      edit(b, { notes: 'solo notas' });
      expect(get(b.id).huella).toBe(b.huella);
      expect(get(c.id).huella).toBe(c.huella);
    });

    test('deleting a pending record clears the records chained after it', () => {
      const [a, b, c] = chain();
      db.invoices.delete(b.id);
      expect(get(a.id).huella).toBe(a.huella);
      expect(get(c.id).huella).toBeNull();
    });

    test('blocked when a later record in the chain is registered', () => {
      const [, b, c] = chain();
      setVf(c.id, c.huella, b.huella, 'enviada', 'CSV2');
      expect(() => edit(b, { total: 1 })).toThrow(/encadenada/);
      expect(get(b.id).huella).toBe(b.huella);
      expect(db.invoices.checkRenumber(b.id, `${RUN}-new`).ok).toBe(false);
    });

    test('renumbering clears the chained records and warns about them', () => {
      const [, b, c] = chain();
      const check = db.invoices.checkRenumber(b.id, `${RUN}-renum`);
      expect(check.ok).toBe(true);
      expect(check.warnings.join(' ')).toMatch(/1 factura\(s\) posterior/);
      expect(db.invoices.renumber(b.id, `${RUN}-renum`).success).toBe(true);
      expect(get(c.id).huella).toBeNull();
    });
  });

  describe('VeriFactu: chain tail', () => {
    test('is the record nothing links to, not the highest id', () => {
      const [, , c] = chain();
      const older = mk();
      // An older-id invoice re-hashed last becomes the tail
      setVf(older.id, `${RUN}TAIL`, c.huella);
      const tail = db.verifactu.getLastInvoiceHash();
      expect(tail.huella).toBe(`${RUN}TAIL`);
      const later = mk(); // higher id, no hash
      expect(db.verifactu.getLastInvoiceHash(later.id).huella).toBe(`${RUN}TAIL`);
      // Excluding the tail itself returns the record before it
      expect(db.verifactu.getLastInvoiceHash(older.id).huella).toBe(c.huella);
    });

    test('prepareHash clears the old hash and returns the tail to chain to', () => {
      const [a, b, c] = chain();
      const prev = db.verifactu.prepareHash(a.id);
      expect(get(a.id).huella).toBeNull();
      expect(get(b.id).huella).toBeNull();
      expect(get(c.id).huella).toBeNull();
      expect(prev === undefined || ![a.huella, b.huella, c.huella].includes(prev.huella)).toBe(true);
    });
  });

  describe('VeriFactu: records for submission', () => {
    test('come in chain order with the previous record and corrected invoice filled in', () => {
      const [a, b, c] = chain();
      const rect = mk({ tipo_factura: 'R1', factura_rectificada_id: a.id, total: -100 });
      setVf(rect.id, `${RUN}R${rect.id}`, c.huella);
      const recs = db.verifactu.getRecordsForSubmission([rect.id, c.id, a.id, b.id]);
      expect(recs.map(r => r.id)).toEqual([a.id, b.id, c.id, rect.id]);
      expect(recs[1].prev_invoice_number).toBe(a.invoice_number);
      expect(recs[1].prev_date).toBe(a.date);
      expect(recs[0].prev_invoice_number).toBeNull();
      expect(recs[3].rect_invoice_number).toBe(a.invoice_number);
      expect(recs[3].client_name).toBe('SM');
    });

    test('a record whose predecessor was already sent still gets the predecessor data', () => {
      const [a, b] = chain();
      const [rec] = db.verifactu.getRecordsForSubmission([b.id]);
      expect(rec.prev_invoice_number).toBe(a.invoice_number);
    });
  });

  describe('Credit notes', () => {
    test('creating one marks the original as rectified in the same step', () => {
      const orig = mk();
      const r = mk({ tipo_factura: 'R1', factura_rectificada_id: orig.id, total: -100 });
      expect(get(orig.id).rectified).toBe(1);
      db.invoices.delete(r.id);
      expect(get(orig.id).rectified).toBe(0);
    });

    test('deleting one keeps the mark while another credit note remains', () => {
      const orig = mk();
      const r1 = mk({ tipo_factura: 'R1', factura_rectificada_id: orig.id });
      mk({ tipo_factura: 'R1', factura_rectificada_id: orig.id });
      db.invoices.delete(r1.id);
      expect(get(orig.id).rectified).toBe(1);
    });

    test('the credit note counter restarts in a new year', () => {
      db.settings.commitRectificativaNumber(7);
      db.settings.ensureCurrentYear(YEAR - 1); // simulate the year rolling over
      db.settings.commitRectificativaNumber(7);
      const { invoiceNumber, newCounter } = db.settings.generateRectificativaNumber(); // now YEAR again
      expect(newCounter).toBe(1);
      expect(invoiceNumber).toMatch(new RegExp(`${YEAR}.0*1$`));
      expect(db.settings.getNumberSettings().counter).toBe(0);
    });
  });
});
