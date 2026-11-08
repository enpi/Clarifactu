// ─── Excel export (SpreadsheetML 2003: opens in Excel and LibreOffice) ─────────
// workbook([{ name, columns: [{ header, type: 'String' | 'Number' }], rows: [[...]], totals?: [...] }])

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function cell(value, type, style) {
  const st = style ? ` ss:StyleID="${style}"` : '';
  if (type === 'Number' && value !== '' && value != null && !isNaN(Number(value))) {
    return `<Cell${st}><Data ss:Type="Number">${(Math.round(Number(value) * 100) / 100).toFixed(2)}</Data></Cell>`;
  }
  return `<Cell${st}><Data ss:Type="String">${esc(value)}</Data></Cell>`;
}

function sheetXml({ name, columns, rows, totals, notes = [] }) {
  const header = `<Row>${columns.map(c => cell(c.header, 'String', 'header')).join('')}</Row>`;
  const body = rows.map(r => `<Row>${r.map((v, i) => cell(v, columns[i] && columns[i].type)).join('')}</Row>`).join('');
  const total = totals ? `<Row>${totals.map((v, i) => cell(v, columns[i] && columns[i].type, 'total')).join('')}</Row>` : '';
  const foot = notes.map(n => `<Row>${cell(n, 'String', 'note')}</Row>`).join('');
  // Sheet names: max 31 chars, no []:*?/\
  const safeName = String(name).replace(/[[\]:*?/\\]/g, ' ').slice(0, 31);
  return `<Worksheet ss:Name="${esc(safeName)}"><Table>${header}${body}${total}${notes.length ? '<Row></Row>' + foot : ''}</Table></Worksheet>`;
}

function workbook(sheets) {
  const styles = '<Styles>' +
    '<Style ss:ID="header"><Font ss:Bold="1"/><Interior ss:Color="#EFF6FF" ss:Pattern="Solid"/></Style>' +
    '<Style ss:ID="total"><Font ss:Bold="1"/></Style>' +
    '<Style ss:ID="note"><Font ss:Italic="1" ss:Color="#64748B"/></Style>' +
    '</Styles>';
  return '<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?>' +
    '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">' +
    styles + sheets.map(sheetXml).join('') + '</Workbook>';
}

module.exports = { workbook };
