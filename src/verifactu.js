// ─── VeriFactu: hash, XML and QR ──────────────────────────────────────────────
// Pure functions (no Electron, no DB) shared by main.js and the tests.

const crypto = require('crypto');

function vfNum(n) { return (Math.round((n || 0) * 100) / 100).toFixed(2); }

// ISO date (YYYY-MM-DD) → DD-MM-YYYY, as AEAT expects
function vfDate(s) {
  if (!s) return '';
  const p = s.split('-');
  return p.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : s;
}

function vfTimestamp() {
  const n = new Date(), z = v => String(v).padStart(2, '0');
  return `${n.getFullYear()}-${z(n.getMonth()+1)}-${z(n.getDate())}T${z(n.getHours())}:${z(n.getMinutes())}:${z(n.getSeconds())}+01:00`;
}

function xe(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
}

// F1 = normal invoice, R1 = credit note (factura rectificativa)
function tipoFactura(invoice) {
  return invoice.tipo_factura || 'F1';
}

function calcHuella(invoice, business, prevHash, fechaHoraGen) {
  const chain = [
    `IDEmisorFactura=${business.nif || ''}`,
    `NumSerieFactura=${invoice.invoice_number || ''}`,
    `FechaExpedicionFactura=${vfDate(invoice.date)}`,
    `TipoFactura=${tipoFactura(invoice)}`,
    `CuotaTotal=${vfNum(invoice.tax_amount || 0)}`,
    `ImporteTotal=${vfNum(invoice.total || 0)}`,
    `Huella=${prevHash || ''}`,
    `FechaHoraHusoGenRegistro=${fechaHoraGen}`
  ].join('&');
  return crypto.createHash('sha256').update(chain, 'utf8').digest('hex').toUpperCase();
}

// Records must come in chain order with prev_invoice_number / prev_date (the record each
// one links to) and, for credit notes, rect_invoice_number / rect_date (the corrected invoice).
// See db.verifactu.getRecordsForSubmission().
function buildVerifactuXML(invoices, business, vfCfg) {
  const registros = invoices.map(inv => {
    const chain = inv.huella_anterior
      ? `<RegistroAnterior>
            <IDEmisorFacturaAnterior>${xe(business.nif)}</IDEmisorFacturaAnterior>
            <NumSerieFacturaAnterior>${xe(inv.prev_invoice_number)}</NumSerieFacturaAnterior>
            <FechaExpedicionFacturaAnterior>${xe(vfDate(inv.prev_date))}</FechaExpedicionFacturaAnterior>
            <Huella>${xe(inv.huella_anterior)}</Huella>
          </RegistroAnterior>`
      : `<PrimerRegistro>S</PrimerRegistro>`;
    const tipo = tipoFactura(inv);
    // Credit notes carry negative amounts, i.e. they rectify "por diferencias" (I)
    const rectificativa = tipo === 'R1'
      ? `<TipoRectificativa>I</TipoRectificativa>
        <FacturasRectificadas><IDFacturaRectificada>
          <IDEmisorFactura>${xe(business.nif)}</IDEmisorFactura>
          <NumSerieFactura>${xe(inv.rect_invoice_number)}</NumSerieFactura>
          <FechaExpedicionFactura>${xe(vfDate(inv.rect_date))}</FechaExpedicionFactura>
        </IDFacturaRectificada></FacturasRectificadas>`
      : '';
    return `<RegistroAlta>
        <IDVersion>1.0</IDVersion>
        <IDFactura>
          <IDEmisorFactura>${xe(business.nif)}</IDEmisorFactura>
          <NumSerieFactura>${xe(inv.invoice_number)}</NumSerieFactura>
          <FechaExpedicionFactura>${xe(vfDate(inv.date))}</FechaExpedicionFactura>
        </IDFactura>
        <NombreRazonEmisor>${xe(business.name)}</NombreRazonEmisor>
        <TipoFactura>${tipo}</TipoFactura>
        ${rectificativa}
        <DescripcionOperacion>Servicios profesionales</DescripcionOperacion>
        ${inv.client_name ? `<Destinatarios><IDDestinatario>
          <NombreRazon>${xe(inv.client_name)}</NombreRazon>
          ${inv.client_nif ? `<NIF>${xe(inv.client_nif)}</NIF>` : ''}
        </IDDestinatario></Destinatarios>` : ''}
        <Desglose><DetalleIVA>
          <TipoImpositivo>${vfNum(inv.tax_rate||0)}</TipoImpositivo>
          <BaseImponible>${vfNum(inv.subtotal||0)}</BaseImponible>
          <CuotaRepercutida>${vfNum(inv.tax_amount||0)}</CuotaRepercutida>
        </DetalleIVA></Desglose>
        <CuotaTotal>${vfNum(inv.tax_amount||0)}</CuotaTotal>
        <ImporteTotal>${vfNum(inv.total||0)}</ImporteTotal>
        <Encadenamiento>${chain}</Encadenamiento>
        <SistemaInformatico>
          <NombreRazon>Clarifactu</NombreRazon>
          <NIF>${xe(business.nif)}</NIF>
          <NombreSistemaInformatico>Clarifactu</NombreSistemaInformatico>
          <IdSistemaInformatico>${xe(vfCfg.id_sistema||'CLARIFACTU')}</IdSistemaInformatico>
          <Version>${xe(vfCfg.version_sistema||'1.0')}</Version>
          <NumeroInstalacion>${xe(vfCfg.num_instalacion||'1')}</NumeroInstalacion>
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
  return `https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR?nif=${encodeURIComponent(business.nif)}&numserie=${encodeURIComponent(invoice.invoice_number)}&fecha=${encodeURIComponent(vfDate(invoice.date))}&importe=${encodeURIComponent(vfNum(invoice.total||0))}`;
}

module.exports = { vfNum, vfDate, vfTimestamp, xe, calcHuella, buildVerifactuXML, buildQRUrl };
