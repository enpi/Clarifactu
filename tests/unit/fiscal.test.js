/**
 * Libros registro and modelo 347 (db.fiscal), and the Excel writer (src/spreadsheet.js).
 */
const os = require('os');
const path = require('path');
const fs = require('fs');
const { workbook } = require('../../src/spreadsheet');

let db, dir;
const Y = 2025;
let n = 0;

const client = (name, nif) => db.clients.create({ name, nif, address: '', email: '', phone: '', notes: '' });
const invoice = (clientId, date, subtotal, over = {}) => db.invoices.create({
  invoice_number: `F-${++n}`, client_id: clientId, date, notes: '', subtotal, tax_rate: 0, tax_amount: 0,
  irpf_rate: 0, irpf_amount: 0, total: subtotal, items: [{ service_id: null, service_name: 'Sesión', description: '', quantity: 1, unit_price: subtotal, total: subtotal }],
  ...over
});
const expense = (over) => db.expenses.create({
  date: `${Y}-03-01`, description: 'Gasto', category: 'OTROS', provider: '', provider_nif: '', invoice_number: '',
  amount: 100, iva_rate: 21, iva_amount: 21, total: 121, deductible_pct: 100, deductible_amount: 100, ...over
});

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'clarifactu-fiscal-'));
  jest.isolateModules(() => { db = require('../../src/database/db'); });
  db.initialize(dir);

  // Clients
  const big = client('Clínica Grande', 'b12345678');           // over the threshold, spread over quarters
  invoice(big.id, `${Y}-02-10`, 2000);
  invoice(big.id, `${Y}-05-10`, 1500);
  const small = client('Paciente Pequeño', '11111111H');       // under the threshold
  invoice(small.id, `${Y}-06-01`, 500);
  const noNif = client('Sin NIF', '');                          // over, but missing the NIF
  invoice(noNif.id, `${Y}-07-01`, 3100);
  const withheld = client('Empresa con retención', 'B87654321'); // invoices with IRPF withholding: not in the 347
  invoice(withheld.id, `${Y}-08-01`, 5000, { irpf_rate: 15, irpf_amount: 750, total: 4250 });
  const credited = client('Con abono', '22222222J');            // a credit note brings it under the threshold
  const orig = invoice(credited.id, `${Y}-09-01`, 3500);
  invoice(credited.id, `${Y}-10-01`, -1000, { tipo_factura: 'R1', factura_rectificada_id: orig.id, total: -1000 });
  invoice(big.id, `${Y - 1}-12-31`, 9000);                      // other year

  // Providers
  // (expenses.create computes the total from the base and the VAT rate)
  expense({ provider: 'Alquileres SL', provider_nif: 'B11111111', category: 'ARRENDAMIENTOS', amount: 3000 });            // 3630
  expense({ provider: 'Luz SA', provider_nif: 'A22222222', category: 'SUMINISTROS', amount: 2000, date: `${Y}-01-15` });  // 2420
  expense({ provider: 'luz sa', provider_nif: 'a22222222', category: 'SUMINISTROS', amount: 1000, date: `${Y}-11-15` });  // 1210, same NIF
  expense({ provider: 'TGSS', provider_nif: '', category: 'SEG_SOCIAL', amount: 4000, iva_rate: 0 });                     // not a third-party operation
});

afterAll(() => {
  try { db.close(); } catch (_) {}
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
});

describe('modelo 347', () => {
  let m;
  beforeAll(() => { m = db.fiscal.get347(Y); });

  test('lists clients over 3.005,06 € with the quarterly breakdown, grouped by NIF', () => {
    const big = m.clientes.find(c => c.name === 'Clínica Grande');
    expect(big).toMatchObject({ nif: 'B12345678', total: 3500, q1: 2000, q2: 1500, q3: 0, q4: 0, count: 2 });
  });

  test('leaves out clients under the threshold and invoices from other years', () => {
    expect(m.clientes.find(c => c.name === 'Paciente Pequeño')).toBeUndefined();
    expect(m.clientes.find(c => c.name === 'Clínica Grande').total).toBe(3500);
  });

  test('keeps clients without NIF so they can be fixed (with an empty NIF)', () => {
    expect(m.clientes.find(c => c.name === 'Sin NIF')).toMatchObject({ nif: '', total: 3100 });
  });

  test('leaves out invoices with IRPF withholding and counts them', () => {
    expect(m.clientes.find(c => c.name === 'Empresa con retención')).toBeUndefined();
    expect(m.excluded.invoicesWithWithholding).toBe(1);
  });

  test('credit notes reduce the yearly amount', () => {
    expect(m.clientes.find(c => c.name === 'Con abono')).toBeUndefined(); // 3500 - 1000 = 2500
  });

  test('groups providers by NIF regardless of spelling, VAT included', () => {
    const luz = m.proveedores.find(p => p.nif === 'A22222222');
    expect(luz).toMatchObject({ total: 3630, q1: 2420, q4: 1210, count: 2 });
  });

  test('flags rent and leaves out Social Security fees', () => {
    expect(m.proveedores.find(p => p.nif === 'B11111111')).toMatchObject({ total: 3630, rent: true });
    expect(m.proveedores.find(p => p.name === 'TGSS')).toBeUndefined();
    expect(m.excluded.expensesNotThirdParty).toBe(1);
  });
});

describe('libros registro', () => {
  test('ingresos: every invoice of the year in date order, with concept and corrected invoice', () => {
    const { ingresos } = db.fiscal.getLibroRegistro(Y);
    expect(ingresos).toHaveLength(7); // the 8th invoice is from the year before
    expect(ingresos.map(r => r.date)).toEqual([...ingresos.map(r => r.date)].sort());
    expect(ingresos[0].concept).toBe('Sesión');
    const r1 = ingresos.find(r => r.tipo_factura === 'R1');
    expect(r1.rect_invoice_number).toBeTruthy();
    expect(ingresos.find(r => r.irpf_amount > 0)).toMatchObject({ irpf_rate: 15, irpf_amount: 750 });
  });

  test('gastos: every expense of the year', () => {
    const { gastos } = db.fiscal.getLibroRegistro(Y);
    expect(gastos).toHaveLength(4);
    expect(gastos[0].date).toBe(`${Y}-01-15`);
  });
});

describe('Excel writer', () => {
  const xml = workbook([{
    name: 'Clientes [ventas]: 2025/26 con un nombre larguísimo',
    columns: [{ header: 'Nombre', type: 'String' }, { header: 'Importe', type: 'Number' }],
    rows: [['Ana & <Co> "S.L."', 1234.5], ['Vacío', '']],
    totals: ['TOTAL', 1234.5],
    notes: ['Nota']
  }]);

  test('escapes text and writes numbers with two decimals', () => {
    expect(xml).toContain('Ana &amp; &lt;Co&gt; &quot;S.L.&quot;');
    expect(xml).toContain('<Data ss:Type="Number">1234.50</Data>');
  });

  test('empty numeric cells are written as text, not as 0', () => {
    expect(xml).toContain('<Cell><Data ss:Type="String"></Data></Cell>');
  });

  test('sheet names follow Excel rules (31 chars, no []:*?/\\)', () => {
    const name = xml.match(/ss:Name="([^"]+)"/)[1];
    expect(name.length).toBeLessThanOrEqual(31);
    expect(name).not.toMatch(/[[\]:*?/\\]/);
  });
});

describe('modelo 130 from the database', () => {
  test('uses the previous year in Clarifactu for casilla 13, and is cumulative', () => {
    // The only Y-1 data is a 9000 € invoice and no expenses → net 9000 → 100 € per quarter
    const m = db.fiscal.getModelo130(Y);
    expect(m.prevYearNet).toBe(9000);
    expect(m.rows.map(r => r.c13)).toEqual([100, 100, 100, 100]);
    // Income is cumulative: Q4's casilla 01 is the whole year's base
    const { ingresos } = db.fiscal.getLibroRegistro(Y);
    expect(m.rows[3].c01).toBe(Math.round(ingresos.reduce((s, r) => s + r.subtotal, 0) * 100) / 100);
    expect(m.rows[1].c01).toBeGreaterThanOrEqual(m.rows[0].c01);
  });

  test('no data for the previous year → unknown, no reduction', () => {
    const m = db.fiscal.getModelo130(Y - 1);
    expect(m.prevYearNet).toBeNull();
    expect(m.rows[0].c13).toBe(0);
  });
});

describe('invoices by period (exports)', () => {
  const months = list => list.map(i => i.date.slice(5, 7)).sort();
  test('a month', () => {
    expect(months(db.invoices.getByPeriod(Y, '05'))).toEqual(['05']);
  });
  test('a quarter', () => {
    expect(months(db.invoices.getByPeriod(Y, 'T3'))).toEqual(['07', '08', '09']);
  });
  test('the whole year, and a month across all years', () => {
    expect(db.invoices.getByPeriod(Y)).toHaveLength(7);
    expect(db.invoices.getByPeriod(null, '12').map(i => i.date)).toEqual([`${Y - 1}-12-31`]);
  });
  test('an invalid period is rejected', () => {
    expect(() => db.invoices.getByPeriod(Y, '13')).toThrow(/Periodo no válido/);
    expect(() => db.invoices.getByPeriod(Y, "01' OR 1=1")).toThrow(/Periodo no válido/);
  });
});
