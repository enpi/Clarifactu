/**
 * Comprehensive unit tests for Verifactu logic.
 *
 * Covers:
 *  - vfNum()       – monetary number formatting
 *  - vfDate()      – date format conversion (ISO → DD-MM-YYYY)
 *  - xe()          – XML entity escaping
 *  - calcHuella()  – SHA-256 hash chaining (determinism, sensitivity, chaining)
 *  - buildVerifactuXML() – XML generation structure and escaping
 *  - QR URL construction
 *  - DB layer: updateInvoiceVerifactu, getLastInvoiceHash, getPendingInvoices
 */

const crypto = require('crypto');
const os     = require('os');
const path   = require('path');
const fs     = require('fs');

// ─── Replicate pure functions from main.js ────────────────────────────────────
// These are standalone pure functions — no Electron dependency.

function vfNum(n) {
  return (Math.round((n || 0) * 100) / 100).toFixed(2);
}

function vfDate(s) {
  if (!s) return '';
  const p = s.split('-');
  return p.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : s;
}

function xe(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function calcHuella(invoice, business, prevHash, fechaHoraGen) {
  const chain = [
    `IDEmisorFactura=${business.nif || ''}`,
    `NumSerieFactura=${invoice.invoice_number || ''}`,
    `FechaExpedicionFactura=${vfDate(invoice.date)}`,
    `TipoFactura=F1`,
    `CuotaTotal=${vfNum(invoice.tax_amount || 0)}`,
    `ImporteTotal=${vfNum(invoice.total || 0)}`,
    `Huella=${prevHash || ''}`,
    `FechaHoraHusoGenRegistro=${fechaHoraGen}`
  ].join('&');
  return crypto.createHash('sha256').update(chain, 'utf8').digest('hex').toUpperCase();
}

function buildVerifactuXML(invoices, business, vfCfg) {
  const registros = invoices.map(inv => {
    const chain = inv.huella_anterior
      ? `<RegistroAnterior>
            <IDEmisorFacturaAnterior>${xe(business.nif)}</IDEmisorFacturaAnterior>
            <NumSerieFacturaAnterior>${xe(inv._prevNumSerie || '')}</NumSerieFacturaAnterior>
            <FechaExpedicionFacturaAnterior>${xe(inv._prevFecha || '')}</FechaExpedicionFacturaAnterior>
            <Huella>${xe(inv.huella_anterior)}</Huella>
          </RegistroAnterior>`
      : `<PrimerRegistro>S</PrimerRegistro>`;
    return `<RegistroAlta>
        <IDVersion>1.0</IDVersion>
        <IDFactura>
          <IDEmisorFactura>${xe(business.nif)}</IDEmisorFactura>
          <NumSerieFactura>${xe(inv.invoice_number)}</NumSerieFactura>
          <FechaExpedicionFactura>${xe(vfDate(inv.date))}</FechaExpedicionFactura>
        </IDFactura>
        <NombreRazonEmisor>${xe(business.name)}</NombreRazonEmisor>
        <TipoFactura>F1</TipoFactura>
        <DescripcionOperacion>Servicios profesionales</DescripcionOperacion>
        ${inv.client_name ? `<Destinatarios><IDDestinatario>
          <NombreRazon>${xe(inv.client_name)}</NombreRazon>
          ${inv.client_nif ? `<NIF>${xe(inv.client_nif)}</NIF>` : ''}
        </IDDestinatario></Destinatarios>` : ''}
        <Desglose><DetalleIVA>
          <TipoImpositivo>${vfNum(inv.tax_rate || 0)}</TipoImpositivo>
          <BaseImponible>${vfNum(inv.subtotal || 0)}</BaseImponible>
          <CuotaRepercutida>${vfNum(inv.tax_amount || 0)}</CuotaRepercutida>
        </DetalleIVA></Desglose>
        <CuotaTotal>${vfNum(inv.tax_amount || 0)}</CuotaTotal>
        <ImporteTotal>${vfNum(inv.total || 0)}</ImporteTotal>
        <Encadenamiento>${chain}</Encadenamiento>
        <SistemaInformatico>
          <NombreRazon>Clarifactu</NombreRazon>
          <NIF>${xe(business.nif)}</NIF>
          <NombreSistemaInformatico>Clarifactu</NombreSistemaInformatico>
          <IdSistemaInformatico>${xe(vfCfg.id_sistema || 'CLARIFACTU')}</IdSistemaInformatico>
          <Version>${xe(vfCfg.version_sistema || '1.0')}</Version>
          <NumeroInstalacion>${xe(vfCfg.num_instalacion || '1')}</NumeroInstalacion>
        </SistemaInformatico>
        <FechaHoraHusoGenRegistro>${xe(inv.fecha_hora_gen)}</FechaHoraHusoGenRegistro>
        <TipoHuella>01</TipoHuella>
        <Huella>${xe(inv.huella)}</Huella>
      </RegistroAlta>`;
  }).join('\n      ');

  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:T="https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/SistemaFacturacionVerifactu.wsdl">
  <soapenv:Body>
    <T:RegFactuSistemaFacturacion>
      <Cabecera>
        <ObligadoEmision>
          <NombreRazon>${xe(business.name)}</NombreRazon>
          <NIF>${xe(business.nif)}</NIF>
        </ObligadoEmision>
      </Cabecera>
      <RegistroFacturacion>
        ${registros}
      </RegistroFacturacion>
    </T:RegFactuSistemaFacturacion>
  </soapenv:Body>
</soapenv:Envelope>`;
}

function buildQRUrl(invoice, business) {
  return `https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR?nif=${encodeURIComponent(business.nif)}&numserie=${encodeURIComponent(invoice.invoice_number)}&fecha=${encodeURIComponent(vfDate(invoice.date))}&importe=${encodeURIComponent(vfNum(invoice.total || 0))}`;
}

// ─── DB setup ─────────────────────────────────────────────────────────────────

let db;
const DB_DIR = os.tmpdir();
const TMP_DB = path.join(DB_DIR, `clarifactu_vf_test_${Date.now()}.db`);

beforeAll(() => {
  // Use a fresh temp directory so this suite doesn't share state with db.test.js
  const tmpDir = path.join(os.tmpdir(), `clarifactu_vf_${Date.now()}`);
  fs.mkdirSync(tmpDir, { recursive: true });
  // Jest caches require() – use a fresh require for isolation
  jest.resetModules();
  db = require('../../src/database/db');
  db.initialize(tmpDir);
});

afterAll(() => {
  const tmpDir = path.join(os.tmpdir(), 'clarifactu.db');
  // best-effort cleanup
  ['clarifactu.db', 'clarifactu.db-wal', 'clarifactu.db-shm'].forEach(f => {
    [os.tmpdir(), DB_DIR].forEach(dir => {
      try { fs.unlinkSync(path.join(dir, f)); } catch (_) {}
    });
  });
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TS = '2024-06-15T10:00:00+01:00';
const BUSINESS = { nif: '12345678A', name: 'Empresa Test S.L.' };
const INV_BASE = {
  invoice_number: 'F-2024-0001',
  date: '2024-06-15',
  tax_amount: 21.00,
  total: 121.00,
  tax_rate: 21,
  subtotal: 100.00,
};

// ─── vfNum ────────────────────────────────────────────────────────────────────

describe('vfNum()', () => {
  test('formats integer as two-decimal string', () => {
    expect(vfNum(100)).toBe('100.00');
  });

  test('formats float with rounding', () => {
    expect(vfNum(21.555)).toBe('21.56');
    expect(vfNum(21.554)).toBe('21.55');
  });

  test('returns "0.00" for null', () => {
    expect(vfNum(null)).toBe('0.00');
  });

  test('returns "0.00" for undefined', () => {
    expect(vfNum(undefined)).toBe('0.00');
  });

  test('returns "0.00" for zero', () => {
    expect(vfNum(0)).toBe('0.00');
  });

  test('handles negative numbers', () => {
    expect(vfNum(-50.5)).toBe('-50.50');
  });

  test('handles large amounts', () => {
    expect(vfNum(999999.99)).toBe('999999.99');
  });

  test('floating point precision: 0.1 + 0.2', () => {
    // Should round correctly, not produce 0.30000000000000004
    expect(vfNum(0.1 + 0.2)).toBe('0.30');
  });
});

// ─── vfDate ───────────────────────────────────────────────────────────────────

describe('vfDate()', () => {
  test('converts ISO date YYYY-MM-DD to DD-MM-YYYY', () => {
    expect(vfDate('2024-06-15')).toBe('15-06-2024');
  });

  test('converts first day of year', () => {
    expect(vfDate('2024-01-01')).toBe('01-01-2024');
  });

  test('converts last day of year', () => {
    expect(vfDate('2024-12-31')).toBe('31-12-2024');
  });

  test('returns empty string for null', () => {
    expect(vfDate(null)).toBe('');
  });

  test('returns empty string for empty string', () => {
    expect(vfDate('')).toBe('');
  });

  test('reverses any 3-part dash-separated string (function is format-agnostic)', () => {
    // vfDate splits on '-' and reverses – works on any 3-part string
    expect(vfDate('not-a-date')).toBe('date-a-not');
  });

  test('handles single-part string (no dashes) – returns as-is', () => {
    expect(vfDate('20240615')).toBe('20240615');
  });

  test('handles 2-part string – returns as-is (not 3 parts)', () => {
    expect(vfDate('2024-06')).toBe('2024-06');
  });
});

// ─── xe() XML escaping ────────────────────────────────────────────────────────

describe('xe() XML escaping', () => {
  test('escapes ampersand', () => {
    expect(xe('A&B')).toBe('A&amp;B');
  });

  test('escapes less-than', () => {
    expect(xe('A<B')).toBe('A&lt;B');
  });

  test('escapes greater-than', () => {
    expect(xe('A>B')).toBe('A&gt;B');
  });

  test('escapes double quote', () => {
    expect(xe('A"B')).toBe('A&quot;B');
  });

  test('escapes single quote', () => {
    expect(xe("A'B")).toBe('A&apos;B');
  });

  test('escapes multiple special chars in sequence', () => {
    expect(xe('<script>alert("xss&\'test\'");</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&amp;&apos;test&apos;&quot;);&lt;/script&gt;'
    );
  });

  test('handles null gracefully', () => {
    expect(xe(null)).toBe('');
  });

  test('handles undefined gracefully', () => {
    expect(xe(undefined)).toBe('');
  });

  test('returns plain text unchanged', () => {
    expect(xe('Empresa Normal S.L.')).toBe('Empresa Normal S.L.');
  });
});

// ─── calcHuella ───────────────────────────────────────────────────────────────

describe('calcHuella()', () => {
  test('returns a 64-character uppercase hex string (SHA-256)', () => {
    const h = calcHuella(INV_BASE, BUSINESS, '', TS);
    expect(h).toMatch(/^[A-F0-9]{64}$/);
  });

  test('is deterministic: same inputs → same hash', () => {
    const h1 = calcHuella(INV_BASE, BUSINESS, '', TS);
    const h2 = calcHuella(INV_BASE, BUSINESS, '', TS);
    expect(h1).toBe(h2);
  });

  test('changes when invoice_number changes', () => {
    const h1 = calcHuella(INV_BASE, BUSINESS, '', TS);
    const h2 = calcHuella({ ...INV_BASE, invoice_number: 'F-2024-0002' }, BUSINESS, '', TS);
    expect(h1).not.toBe(h2);
  });

  test('changes when date changes', () => {
    const h1 = calcHuella(INV_BASE, BUSINESS, '', TS);
    const h2 = calcHuella({ ...INV_BASE, date: '2024-06-16' }, BUSINESS, '', TS);
    expect(h1).not.toBe(h2);
  });

  test('changes when total changes', () => {
    const h1 = calcHuella(INV_BASE, BUSINESS, '', TS);
    const h2 = calcHuella({ ...INV_BASE, total: 242.00 }, BUSINESS, '', TS);
    expect(h1).not.toBe(h2);
  });

  test('changes when tax_amount changes', () => {
    const h1 = calcHuella(INV_BASE, BUSINESS, '', TS);
    const h2 = calcHuella({ ...INV_BASE, tax_amount: 42.00 }, BUSINESS, '', TS);
    expect(h1).not.toBe(h2);
  });

  test('changes when NIF changes', () => {
    const h1 = calcHuella(INV_BASE, BUSINESS, '', TS);
    const h2 = calcHuella(INV_BASE, { ...BUSINESS, nif: '87654321B' }, '', TS);
    expect(h1).not.toBe(h2);
  });

  test('changes when prevHash changes (chaining)', () => {
    const h1 = calcHuella(INV_BASE, BUSINESS, '', TS);
    const h2 = calcHuella(INV_BASE, BUSINESS, 'ABCDEF1234', TS);
    expect(h1).not.toBe(h2);
  });

  test('changes when timestamp changes', () => {
    const h1 = calcHuella(INV_BASE, BUSINESS, '', '2024-06-15T10:00:00+01:00');
    const h2 = calcHuella(INV_BASE, BUSINESS, '', '2024-06-15T10:00:01+01:00');
    expect(h1).not.toBe(h2);
  });

  test('first invoice uses empty prevHash', () => {
    const h = calcHuella(INV_BASE, BUSINESS, '', TS);
    expect(h).toBeTruthy();
    expect(h.length).toBe(64);
  });

  test('hash chaining: invoice2.huella_anterior === invoice1.huella', () => {
    const h1 = calcHuella(INV_BASE, BUSINESS, '', TS);
    const inv2 = { ...INV_BASE, invoice_number: 'F-2024-0002', total: 242, tax_amount: 42 };
    const h2 = calcHuella(inv2, BUSINESS, h1, TS);
    // h2 embeds h1 in the chain string
    const chainStr = [
      `IDEmisorFactura=${BUSINESS.nif}`,
      `NumSerieFactura=${inv2.invoice_number}`,
      `FechaExpedicionFactura=${vfDate(inv2.date)}`,
      `TipoFactura=F1`,
      `CuotaTotal=${vfNum(inv2.tax_amount)}`,
      `ImporteTotal=${vfNum(inv2.total)}`,
      `Huella=${h1}`,
      `FechaHoraHusoGenRegistro=${TS}`
    ].join('&');
    const expected = crypto.createHash('sha256').update(chainStr, 'utf8').digest('hex').toUpperCase();
    expect(h2).toBe(expected);
  });

  test('handles null/undefined amounts as 0', () => {
    const inv = { ...INV_BASE, tax_amount: null, total: undefined };
    const h = calcHuella(inv, BUSINESS, '', TS);
    expect(h).toMatch(/^[A-F0-9]{64}$/);
    // Same as explicitly passing 0
    const invZero = { ...INV_BASE, tax_amount: 0, total: 0 };
    const hZero = calcHuella(invZero, BUSINESS, '', TS);
    expect(h).toBe(hZero);
  });

  test('handles special chars in NIF without breaking hash', () => {
    const bizSpecial = { ...BUSINESS, nif: 'A&B<>"\'C' };
    const h = calcHuella(INV_BASE, bizSpecial, '', TS);
    expect(h).toMatch(/^[A-F0-9]{64}$/);
  });
});

// ─── QR URL construction ──────────────────────────────────────────────────────

describe('QR URL construction', () => {
  const invoice = { invoice_number: 'F-2024-0001', date: '2024-06-15', total: 121.00 };
  const business = { nif: '12345678A', name: 'Test' };

  test('URL contains AEAT host', () => {
    const url = buildQRUrl(invoice, business);
    expect(url).toContain('agenciatributaria.gob.es');
  });

  test('URL contains ValidarQR path', () => {
    const url = buildQRUrl(invoice, business);
    expect(url).toContain('ValidarQR');
  });

  test('URL contains encoded NIF', () => {
    const url = buildQRUrl(invoice, business);
    expect(url).toContain('nif=12345678A');
  });

  test('URL contains encoded invoice number', () => {
    const url = buildQRUrl(invoice, business);
    expect(url).toContain('numserie=F-2024-0001');
  });

  test('URL contains date in DD-MM-YYYY format (encoded)', () => {
    const url = buildQRUrl(invoice, business);
    expect(url).toContain(encodeURIComponent('15-06-2024'));
  });

  test('URL contains amount with two decimals', () => {
    const url = buildQRUrl(invoice, business);
    expect(url).toContain(encodeURIComponent('121.00'));
  });

  test('URL encodes special chars in NIF', () => {
    const url = buildQRUrl(invoice, { ...business, nif: 'A&B C' });
    expect(url).toContain(encodeURIComponent('A&B C'));
  });

  test('URL encodes spaces in invoice number', () => {
    const url = buildQRUrl({ ...invoice, invoice_number: 'F 2024 0001' }, business);
    expect(url).toContain(encodeURIComponent('F 2024 0001'));
  });
});

// ─── buildVerifactuXML ────────────────────────────────────────────────────────

describe('buildVerifactuXML()', () => {
  const vfCfg = { id_sistema: 'CLARIFACTU', version_sistema: '1.0', num_instalacion: '1' };
  const business = { nif: '12345678A', name: 'Empresa Test S.L.' };

  const inv1 = {
    invoice_number: 'F-2024-0001',
    date: '2024-06-15',
    subtotal: 100,
    tax_rate: 21,
    tax_amount: 21,
    total: 121,
    client_name: 'Cliente Test',
    client_nif: '87654321B',
    huella: 'ABC123',
    huella_anterior: null,
    fecha_hora_gen: TS,
  };

  const inv2 = {
    ...inv1,
    invoice_number: 'F-2024-0002',
    total: 242,
    tax_amount: 42,
    huella: 'DEF456',
    huella_anterior: 'ABC123',
    _prevNumSerie: 'F-2024-0001',
    _prevFecha: '15-06-2024',
  };

  test('produces valid XML declaration', () => {
    const xml = buildVerifactuXML([inv1], business, vfCfg);
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
  });

  test('wraps content in SOAP envelope', () => {
    const xml = buildVerifactuXML([inv1], business, vfCfg);
    expect(xml).toContain('<soapenv:Envelope');
    expect(xml).toContain('</soapenv:Envelope>');
    expect(xml).toContain('<soapenv:Body>');
  });

  test('includes business NIF in Cabecera', () => {
    const xml = buildVerifactuXML([inv1], business, vfCfg);
    expect(xml).toContain('<NIF>12345678A</NIF>');
  });

  test('includes business name in Cabecera', () => {
    const xml = buildVerifactuXML([inv1], business, vfCfg);
    expect(xml).toContain('<NombreRazon>Empresa Test S.L.</NombreRazon>');
  });

  test('first invoice uses <PrimerRegistro>S</PrimerRegistro>', () => {
    const xml = buildVerifactuXML([inv1], business, vfCfg);
    expect(xml).toContain('<PrimerRegistro>S</PrimerRegistro>');
    expect(xml).not.toContain('<RegistroAnterior>');
  });

  test('subsequent invoice uses <RegistroAnterior> with previous hash', () => {
    const xml = buildVerifactuXML([inv2], business, vfCfg);
    expect(xml).toContain('<RegistroAnterior>');
    expect(xml).toContain('<Huella>ABC123</Huella>');
    expect(xml).not.toContain('<PrimerRegistro>');
  });

  test('includes invoice number', () => {
    const xml = buildVerifactuXML([inv1], business, vfCfg);
    expect(xml).toContain('<NumSerieFactura>F-2024-0001</NumSerieFactura>');
  });

  test('includes date in DD-MM-YYYY format', () => {
    const xml = buildVerifactuXML([inv1], business, vfCfg);
    expect(xml).toContain('<FechaExpedicionFactura>15-06-2024</FechaExpedicionFactura>');
  });

  test('includes total and tax amounts formatted', () => {
    const xml = buildVerifactuXML([inv1], business, vfCfg);
    expect(xml).toContain('<ImporteTotal>121.00</ImporteTotal>');
    expect(xml).toContain('<CuotaTotal>21.00</CuotaTotal>');
  });

  test('includes client name and NIF in Destinatarios', () => {
    const xml = buildVerifactuXML([inv1], business, vfCfg);
    expect(xml).toContain('<NombreRazon>Cliente Test</NombreRazon>');
    expect(xml).toContain('<NIF>87654321B</NIF>');
  });

  test('omits Destinatarios block when no client_name', () => {
    const invNoClient = { ...inv1, client_name: '', client_nif: '' };
    const xml = buildVerifactuXML([invNoClient], business, vfCfg);
    expect(xml).not.toContain('<Destinatarios>');
  });

  test('includes the invoice huella', () => {
    const xml = buildVerifactuXML([inv1], business, vfCfg);
    expect(xml).toContain('<Huella>ABC123</Huella>');
  });

  test('includes sistema informatico metadata', () => {
    const xml = buildVerifactuXML([inv1], business, vfCfg);
    expect(xml).toContain('<IdSistemaInformatico>CLARIFACTU</IdSistemaInformatico>');
    expect(xml).toContain('<Version>1.0</Version>');
    expect(xml).toContain('<NumeroInstalacion>1</NumeroInstalacion>');
  });

  test('escapes special chars in business name', () => {
    const bizSpecial = { nif: '12345678A', name: 'Empresa & Cia <Test> "S.L."' };
    const xml = buildVerifactuXML([inv1], bizSpecial, vfCfg);
    expect(xml).toContain('Empresa &amp; Cia &lt;Test&gt; &quot;S.L.&quot;');
    expect(xml).not.toContain('Empresa & Cia <Test>');
  });

  test('escapes special chars in client name', () => {
    const invSpecial = { ...inv1, client_name: 'Cliente & <Test>' };
    const xml = buildVerifactuXML([invSpecial], business, vfCfg);
    expect(xml).toContain('Cliente &amp; &lt;Test&gt;');
  });

  test('handles multiple invoices in one XML', () => {
    const xml = buildVerifactuXML([inv1, inv2], business, vfCfg);
    expect(xml).toContain('F-2024-0001');
    expect(xml).toContain('F-2024-0002');
    expect((xml.match(/<RegistroAlta>/g) || []).length).toBe(2);
  });

  test('TipoHuella is always 01', () => {
    const xml = buildVerifactuXML([inv1], business, vfCfg);
    expect(xml).toContain('<TipoHuella>01</TipoHuella>');
  });

  test('TipoFactura is always F1', () => {
    const xml = buildVerifactuXML([inv1], business, vfCfg);
    expect(xml).toContain('<TipoFactura>F1</TipoFactura>');
  });
});

// ─── DB layer: Verifactu invoice operations ───────────────────────────────────

describe('DB – Verifactu invoice operations', () => {
  let clientId, invoiceId1, invoiceId2;

  beforeAll(() => {
    // Create a client and two invoices to test chaining
    const client = db.clients.create({
      name: 'VF Test Client', nif: '99999999Z', email: 'vf@test.com',
      phone: '', address: '', notes: ''
    });
    clientId = client.id;

    const inv1 = db.invoices.create({
      invoice_number: 'VF-TEST-0001',
      client_id: clientId,
      date: '2024-06-15',
      notes: '',
      subtotal: 100,
      tax_rate: 21,
      tax_amount: 21,
      irpf_rate: 0,
      irpf_amount: 0,
      total: 121,
      items: [{ service_id: null, service_name: 'Sesión', description: '', quantity: 1, unit_price: 100, total: 100 }]
    });
    invoiceId1 = inv1.id;

    const inv2 = db.invoices.create({
      invoice_number: 'VF-TEST-0002',
      client_id: clientId,
      date: '2024-06-16',
      notes: '',
      subtotal: 200,
      tax_rate: 21,
      tax_amount: 42,
      irpf_rate: 0,
      irpf_amount: 0,
      total: 242,
      items: [{ service_id: null, service_name: 'Sesión', description: '', quantity: 2, unit_price: 100, total: 200 }]
    });
    invoiceId2 = inv2.id;
  });

  test('getLastInvoiceHash returns null when no invoices have huella', () => {
    const result = db.verifactu.getLastInvoiceHash();
    // Either null or undefined — no huella has been set yet for these invoices
    expect(result == null || result.huella == null || result.huella === '').toBeTruthy();
  });

  test('updateInvoiceVerifactu stores huella and status on invoice 1', () => {
    const huella1 = calcHuella(
      { invoice_number: 'VF-TEST-0001', date: '2024-06-15', tax_amount: 21, total: 121 },
      { nif: '12345678A' }, '', TS
    );
    db.verifactu.updateInvoiceVerifactu(invoiceId1, {
      huella: huella1,
      huella_anterior: '',
      fecha_hora_gen: TS,
      verifactu_status: 'pendiente',
      verifactu_csv: null
    });
    const saved = db.invoices.getById(invoiceId1);
    expect(saved.huella).toBe(huella1);
    expect(saved.huella).toMatch(/^[a-f0-9]{64}$/i);
    expect(saved.verifactu_status).toBe('pendiente');
    expect(saved.fecha_hora_gen).toBe(TS);
    expect(saved.huella_anterior).toBe('');
  });

  test('getLastInvoiceHash returns invoice 1 after its huella is set', () => {
    const last = db.verifactu.getLastInvoiceHash(invoiceId2); // exclude inv2
    expect(last).not.toBeNull();
    expect(last.huella).toBeTruthy();
    expect(last.id).toBe(invoiceId1);
  });

  test('chaining: invoice 2 huella_anterior equals invoice 1 huella', () => {
    const inv1data = db.invoices.getById(invoiceId1);
    const huella2 = calcHuella(
      { invoice_number: 'VF-TEST-0002', date: '2024-06-16', tax_amount: 42, total: 242 },
      { nif: '12345678A' }, inv1data.huella, TS
    );
    db.verifactu.updateInvoiceVerifactu(invoiceId2, {
      huella: huella2,
      huella_anterior: inv1data.huella,
      fecha_hora_gen: TS,
      verifactu_status: 'pendiente',
      verifactu_csv: null
    });
    const inv2data = db.invoices.getById(invoiceId2);
    expect(inv2data.huella_anterior).toBe(inv1data.huella);
    expect(inv2data.huella).not.toBe(inv1data.huella);
    expect(inv2data.huella).toMatch(/^[a-f0-9]{64}$/i);
  });

  test('getPendingInvoices returns invoices with status pendiente', () => {
    const pending = db.verifactu.getPendingInvoices();
    const numbers = pending.map(i => i.invoice_number);
    expect(numbers).toContain('VF-TEST-0001');
    expect(numbers).toContain('VF-TEST-0002');
  });

  test('updateInvoiceVerifactu can mark as enviada with CSV', () => {
    const inv1data = db.invoices.getById(invoiceId1);
    db.verifactu.updateInvoiceVerifactu(invoiceId1, {
      huella: inv1data.huella,
      huella_anterior: inv1data.huella_anterior,
      fecha_hora_gen: inv1data.fecha_hora_gen,
      verifactu_status: 'enviada',
      verifactu_csv: 'CSV123456'
    });
    const updated = db.invoices.getById(invoiceId1);
    expect(updated.verifactu_status).toBe('enviada');
    expect(updated.verifactu_csv).toBe('CSV123456');
  });

  test('getPendingInvoices excludes invoices marked as enviada', () => {
    const pending = db.verifactu.getPendingInvoices();
    const numbers = pending.map(i => i.invoice_number);
    expect(numbers).not.toContain('VF-TEST-0001'); // marked enviada above
    expect(numbers).toContain('VF-TEST-0002');     // still pendiente
  });

  test('two different invoices always produce different huellas', () => {
    const inv1data = db.invoices.getById(invoiceId1);
    const inv2data = db.invoices.getById(invoiceId2);
    expect(inv1data.huella).not.toBe(inv2data.huella);
  });

  test('re-processing an invoice produces a new (different) huella due to new timestamp', () => {
    const inv1data = db.invoices.getById(invoiceId1);
    const oldHuella = inv1data.huella;
    const newTs = '2024-07-01T12:00:00+01:00'; // different timestamp
    const newHuella = calcHuella(
      { invoice_number: 'VF-TEST-0001', date: '2024-06-15', tax_amount: 21, total: 121 },
      { nif: '12345678A' }, '', newTs
    );
    expect(newHuella).not.toBe(oldHuella);
  });
});

// ─── Verifactu settings – edge cases ─────────────────────────────────────────

describe('DB – Verifactu settings edge cases', () => {
  test('all fields are persisted correctly', () => {
    db.verifactu.saveSettings({
      enabled: 1,
      environment: 'produccion',
      cert_path: 'C:\\certs\\firma.p12',
      cert_password: 'p@$$w0rd!',
      id_sistema: 'MY_SYSTEM',
      version_sistema: '2.5',
      num_instalacion: '42',
      use_dnie: 1,
      cert_thumbprint: 'AABBCC1122'
    });
    const vf = db.verifactu.getSettings();
    expect(vf.enabled).toBe(1);
    expect(vf.environment).toBe('produccion');
    expect(vf.cert_path).toBe('C:\\certs\\firma.p12');
    expect(vf.cert_password).toBe('p@$$w0rd!');
    expect(vf.id_sistema).toBe('MY_SYSTEM');
    expect(vf.version_sistema).toBe('2.5');
    expect(vf.num_instalacion).toBe('42');
    expect(vf.use_dnie).toBe(1);
    expect(vf.cert_thumbprint).toBe('AABBCC1122');
  });

  test('disabling Verifactu sets enabled to 0', () => {
    db.verifactu.saveSettings({
      enabled: 0, environment: 'test', cert_path: '', cert_password: '',
      id_sistema: 'CLARIFACTU', version_sistema: '1.0', num_instalacion: '1',
      use_dnie: 0, cert_thumbprint: ''
    });
    expect(db.verifactu.getSettings().enabled).toBe(0);
  });
});
