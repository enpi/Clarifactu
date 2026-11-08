/**
 * Client import (src/import-clients.js) and db.clients.bulkCreate.
 */
const os = require('os');
const path = require('path');
const fs = require('fs');
const AdmZip = require('adm-zip');
const imp = require('../../src/import-clients');

describe('CSV', () => {
  test('Spanish Excel export: ";" separator, BOM, quotes and accents in headers', () => {
    const csv = '﻿Nombre;NIF/CIF;Teléfono;Dirección\r\n"García; Ana";12.345.678-z;600 111 222;"C/ Mayor, 1"\r\nLuis;;;\r\n';
    const { columns, clients } = imp.mapRows(imp.parseCSV(csv));
    expect(columns).toEqual(expect.arrayContaining(['name', 'nif', 'phone', 'address']));
    expect(clients[0]).toMatchObject({ line: 2, name: 'García; Ana', nif: '12345678Z', phone: '600 111 222', address: 'C/ Mayor, 1' });
    expect(clients[1]).toMatchObject({ name: 'Luis', nif: '' });
  });

  test('"," separator, escaped quotes, line breaks inside a quoted field, English headers', () => {
    const csv = 'name,email,notes\nAna,ANA@Mail.com,"Dice ""hola""\nsegunda línea"\n';
    const { clients } = imp.mapRows(imp.parseCSV(csv));
    expect(clients).toHaveLength(1);
    expect(clients[0]).toMatchObject({ email: 'ana@mail.com', notes: 'Dice "hola"\nsegunda línea' });
  });

  test('empty lines (also lines with only separators) are ignored', () => {
    expect(imp.parseCSV('Nombre;NIF\n\nAna;1\n;\n')).toEqual([['Nombre', 'NIF'], ['Ana', '1']]);
  });

  test('a file without a name column is rejected with a clear message', () => {
    expect(() => imp.mapRows(imp.parseCSV('NIF;Email\n1;a@b.c'))).toThrow(/columna del nombre/);
    expect(() => imp.mapRows([])).toThrow(/vacío/);
  });
});

describe('dates', () => {
  test.each([
    ['03/04/1985', '1985-04-03'], ['3-4-85', '1985-04-03'], ['1/2/05', '2005-02-01'],
    ['1985-04-03', '1985-04-03'], ['31140', '1985-04-03'], ['45658', '2025-01-01'], ['', ''], ['no sé', '']
  ])('%s → %s', (input, expected) => {
    expect(imp.toIsoDate(input)).toBe(expected);
  });
});

describe('XLSX', () => {
  // Minimal real .xlsx: shared strings, an inline string, a number, a gap (no B2 cell), sheet named "Pacientes"
  function makeXlsx() {
    const zip = new AdmZip();
    zip.addFile('xl/workbook.xml', Buffer.from('<workbook xmlns:r="r"><sheets><sheet name="Pacientes" sheetId="1" r:id="rId7"/></sheets></workbook>'));
    zip.addFile('xl/_rels/workbook.xml.rels', Buffer.from('<Relationships><Relationship Id="rId7" Type="worksheet" Target="worksheets/pacientes.xml"/></Relationships>'));
    zip.addFile('xl/sharedStrings.xml', Buffer.from('<sst><si><t>Nombre</t></si><si><t>Email</t></si><si><t>Fecha de nacimiento</t></si><si><r><t>Marta </t></r><r><t>&amp; Co</t></r></si></sst>'));
    zip.addFile('xl/worksheets/pacientes.xml', Buffer.from(
      '<worksheet><sheetData>' +
      '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c></row>' +
      '<row r="2"><c r="A2" t="s"><v>3</v></c><c r="C2"><v>31140</v></c></row>' +
      '<row r="3"><c r="A3" t="inlineStr"><is><t>Pedro</t></is></c><c r="B3" t="str"><v>pedro@x.es</v></c></row>' +
      '</sheetData></worksheet>'));
    return zip.toBuffer();
  }

  test('reads the first sheet with shared and inline strings, gaps and dates', () => {
    const { clients } = imp.mapRows(imp.readClientFile('clientes.xlsx', makeXlsx()));
    expect(clients).toEqual([
      expect.objectContaining({ name: 'Marta & Co', email: '', birth_date: '1985-04-03' }),
      expect.objectContaining({ name: 'Pedro', email: 'pedro@x.es', birth_date: '' })
    ]);
  });

  test('a file that is not an xlsx is rejected', () => {
    expect(() => imp.readClientFile('x.xlsx', Buffer.from('hola'))).toThrow(/Excel/);
  });
});

describe('planImport', () => {
  const existing = [{ name: 'Ana Existente', nif: '12345678Z', email: 'ana@mail.com' }];

  test('skips rows without name and duplicates of existing clients (by NIF or email)', () => {
    const { toCreate, skipped } = imp.planImport([
      { line: 2, name: 'Nueva', nif: '87654321X', email: '' },
      { line: 3, name: '', nif: '', email: '' },
      { line: 4, name: 'Ana otra vez', nif: '12345678Z', email: '' },
      { line: 5, name: 'Ana por email', nif: '', email: 'ana@mail.com' }
    ], existing);
    expect(toCreate.map(c => c.line)).toEqual([2]);
    expect(skipped.map(c => [c.line, c.reason])).toEqual([
      [3, 'Sin nombre'],
      [4, expect.stringMatching(/NIF 12345678Z \(Ana Existente\)/)],
      [5, expect.stringMatching(/email ana@mail.com/)]
    ]);
  });

  test('a row repeated in the same file is imported once', () => {
    const { toCreate, skipped } = imp.planImport([
      { line: 2, name: 'Rosa', nif: 'Y1234567X', email: '' },
      { line: 3, name: 'Rosa (copia)', nif: 'Y1234567X', email: '' }
    ], []);
    expect(toCreate).toHaveLength(1);
    expect(skipped[0].line).toBe(3);
  });
});

describe('db.clients.bulkCreate', () => {
  let db, dir;
  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'clarifactu-import-'));
    jest.isolateModules(() => { db = require('../../src/database/db'); });
    db.initialize(dir);
  });
  afterAll(() => {
    try { db.close(); } catch (_) {}
    try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
  });

  test('creates every client with all fields', () => {
    expect(db.clients.bulkCreate([
      { name: 'Uno', nif: '1A', email: 'uno@x.es', phone: '1', address: 'A', notes: 'n', tags: 'vip', birth_date: '1990-01-01' },
      { name: 'Dos' }
    ])).toBe(2);
    const all = db.clients.getAll();
    expect(all.find(c => c.name === 'Uno')).toMatchObject({ nif: '1A', tags: 'vip', birth_date: '1990-01-01' });
    expect(all.find(c => c.name === 'Dos')).toMatchObject({ nif: '', email: '' });
  });

  test('is all or nothing: one bad row creates none', () => {
    const before = db.clients.getAll().length;
    expect(() => db.clients.bulkCreate([{ name: 'Tres' }, { name: null }])).toThrow();
    expect(db.clients.getAll()).toHaveLength(before);
  });
});
