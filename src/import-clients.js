// ─── Client import from CSV / Excel (.xlsx) ───────────────────────────────────
// read → rows of cells; mapRows → client objects by header; planImport → what to
// create and what to skip (duplicates of existing clients or within the file).

const AdmZip = require('adm-zip');

// ── CSV ──
function parseCSV(text) {
  text = String(text).replace(/^﻿/, '');
  const firstLine = text.split(/\r?\n/, 1)[0] || '';
  // Spanish Excel exports use ';'. Pick whichever separator the header uses more (outside quotes).
  const count = ch => firstLine.replace(/"[^"]*"/g, '').split(ch).length - 1;
  const sep = count(';') > count(',') ? ';' : (count('\t') > count(',') ? '\t' : ',');

  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === sep) { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(v => String(v).trim() !== ''));
}

// ── XLSX (first sheet) ──
const xmlText = s => s.replace(/<[^>]+>/g, '')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

function columnIndex(ref) {
  const letters = (ref.match(/^[A-Z]+/) || ['A'])[0];
  return [...letters].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1;
}

function parseXLSX(buffer) {
  let zip;
  try { zip = new AdmZip(buffer); } catch (_) { throw new Error('El archivo no es un Excel (.xlsx) válido'); }
  const read = name => { const e = zip.getEntry(name); return e ? e.getData().toString('utf8') : null; };

  const shared = [];
  const sst = read('xl/sharedStrings.xml');
  if (sst) for (const si of sst.match(/<si>[\s\S]*?<\/si>/g) || []) {
    shared.push((si.match(/<t[^>]*>[\s\S]*?<\/t>/g) || []).map(xmlText).join(''));
  }

  // First sheet in workbook order
  let sheetPath = 'xl/worksheets/sheet1.xml';
  const wb = read('xl/workbook.xml'), rels = read('xl/_rels/workbook.xml.rels');
  const firstSheet = wb && wb.match(/<sheet\b[^>]*r:id="([^"]+)"/);
  if (firstSheet && rels) {
    const rel = rels.match(new RegExp(`<Relationship\\b[^>]*Id="${firstSheet[1]}"[^>]*>`));
    const target = rel && rel[0].match(/Target="([^"]+)"/);
    if (target) sheetPath = target[1].startsWith('/') ? target[1].slice(1) : `xl/${target[1].replace(/^\.\//, '')}`;
  }
  const sheet = read(sheetPath);
  if (!sheet) throw new Error('No se ha encontrado ninguna hoja en el Excel');

  const rows = [];
  for (const r of sheet.match(/<row\b[\s\S]*?<\/row>/g) || []) {
    const cells = [];
    for (const c of r.match(/<c\b[^>]*?(?:\/>|>[\s\S]*?<\/c>)/g) || []) {
      const ref = (c.match(/\br="([A-Z]+\d+)"/) || [])[1];
      const type = (c.match(/\bt="([^"]+)"/) || [])[1];
      const v = (c.match(/<v>([\s\S]*?)<\/v>/) || [])[1];
      let value = '';
      if (type === 's') value = shared[parseInt(v, 10)] ?? '';
      else if (type === 'inlineStr') value = (c.match(/<t[^>]*>[\s\S]*?<\/t>/g) || []).map(xmlText).join('');
      else if (v != null) value = xmlText(v);
      cells[ref ? columnIndex(ref) : cells.length] = value;
    }
    rows.push(Array.from(cells, v => v ?? ''));
  }
  return rows.filter(r => r.some(v => String(v).trim() !== ''));
}

function readClientFile(fileName, buffer) {
  return /\.xlsx$/i.test(fileName) ? parseXLSX(buffer) : parseCSV(buffer.toString('utf8'));
}

// ── Header mapping ──
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const FIELD_ALIASES = {
  name: ['nombre', 'name', 'cliente', 'nombre y apellidos', 'nombre completo', 'razon social', 'full name', 'paciente'],
  nif: ['nif', 'dni', 'nie', 'cif', 'nif cif', 'dni nie', 'nif dni', 'documento', 'tax id', 'vat'],
  email: ['email', 'e mail', 'correo', 'correo electronico', 'mail'],
  phone: ['telefono', 'tel', 'movil', 'phone', 'celular', 'telefono movil', 'mobile'],
  address: ['direccion', 'domicilio', 'address', 'direccion postal'],
  notes: ['notas', 'observaciones', 'notes', 'comentarios'],
  tags: ['etiquetas', 'tags', 'grupo', 'grupos'],
  birth_date: ['fecha nacimiento', 'fecha de nacimiento', 'nacimiento', 'birth date', 'birthday', 'date of birth', 'f nacimiento']
};

function mapHeader(header) {
  const map = {};
  header.forEach((h, i) => {
    const n = norm(h);
    for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
      if (map[field] === undefined && aliases.includes(n)) map[field] = i;
    }
  });
  return map;
}

// dd/mm/yyyy, d-m-yy, yyyy-mm-dd or an Excel serial number → yyyy-mm-dd ('' if not a date)
function toIsoDate(v) {
  const s = String(v || '').trim();
  if (!s) return '';
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (m) {
    const y = m[3].length === 2 ? (Number(m[3]) > 30 ? '19' : '20') + m[3] : m[3];
    return `${y}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  if (/^\d{4,5}(\.\d+)?$/.test(s)) { // Excel serial date (days since 1899-12-30)
    const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(Number(s)) * 86400000);
    return d.toISOString().slice(0, 10);
  }
  return '';
}

function mapRows(rows) {
  if (!rows.length) throw new Error('El archivo está vacío');
  const map = mapHeader(rows[0]);
  if (map.name === undefined) {
    throw new Error('No se encuentra la columna del nombre. La primera fila debe tener cabeceras, por ejemplo: Nombre, NIF, Email, Teléfono, Dirección');
  }
  const get = (r, f) => (map[f] === undefined ? '' : String(r[map[f]] ?? '').trim());
  return {
    columns: Object.keys(map),
    clients: rows.slice(1).map((r, i) => ({
      line: i + 2, // spreadsheet row number, for messages
      name: get(r, 'name'), nif: get(r, 'nif').toUpperCase().replace(/[\s.-]/g, ''), email: get(r, 'email').toLowerCase(),
      phone: get(r, 'phone'), address: get(r, 'address'), notes: get(r, 'notes'), tags: get(r, 'tags'),
      birth_date: toIsoDate(get(r, 'birth_date'))
    }))
  };
}

// Splits mapped clients into the ones to create and the ones skipped (with the reason)
function planImport(clients, existing) {
  const nifs = new Map(), emails = new Map();
  for (const c of existing) {
    if (c.nif) nifs.set(String(c.nif).toUpperCase().replace(/[\s.-]/g, ''), c.name);
    if (c.email) emails.set(String(c.email).toLowerCase(), c.name);
  }
  const toCreate = [], skipped = [];
  for (const c of clients) {
    if (!c.name) { skipped.push({ ...c, reason: 'Sin nombre' }); continue; }
    if (c.nif && nifs.has(c.nif)) { skipped.push({ ...c, reason: `Ya existe un cliente con el NIF ${c.nif} (${nifs.get(c.nif)})` }); continue; }
    if (c.email && emails.has(c.email)) { skipped.push({ ...c, reason: `Ya existe un cliente con el email ${c.email} (${emails.get(c.email)})` }); continue; }
    toCreate.push(c);
    // Later rows of the same file count as duplicates too
    if (c.nif) nifs.set(c.nif, c.name);
    if (c.email) emails.set(c.email, c.name);
  }
  return { toCreate, skipped };
}

module.exports = { parseCSV, parseXLSX, readClientFile, mapRows, planImport, toIsoDate };
