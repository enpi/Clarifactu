const path = require('path');
let Database;
let db;

function initialize(userDataPath) {
  Database = require('better-sqlite3');
  const dbPath = path.join(userDataPath, 'clarifactu.db');
  db = new Database(dbPath);

  // Enable WAL mode for better performance
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  createTables();
  runMigrations();
  seedDefaults();
}

function createTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS business_settings (
      id INTEGER PRIMARY KEY,
      name TEXT,
      nif TEXT,
      address TEXT,
      email TEXT,
      phone TEXT,
      logo TEXT,
      extra_info TEXT
    );

    CREATE TABLE IF NOT EXISTS invoice_number_settings (
      id INTEGER PRIMARY KEY,
      prefix TEXT DEFAULT 'F',
      separator TEXT DEFAULT '-',
      show_year INTEGER DEFAULT 1,
      digits INTEGER DEFAULT 4,
      current_year INTEGER,
      counter INTEGER DEFAULT 0,
      start_number INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      nif TEXT,
      address TEXT,
      email TEXT,
      phone TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      duration TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT NOT NULL UNIQUE,
      client_id INTEGER,
      date TEXT NOT NULL,
      notes TEXT,
      subtotal REAL,
      tax_rate REAL DEFAULT 0,
      tax_amount REAL,
      irpf_rate REAL DEFAULT 0,
      irpf_amount REAL DEFAULT 0,
      total REAL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY(client_id) REFERENCES clients(id)
    );

    CREATE TABLE IF NOT EXISTS invoice_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id INTEGER,
      service_id INTEGER,
      service_name TEXT,
      description TEXT,
      quantity INTEGER DEFAULT 1,
      unit_price REAL,
      total REAL,
      FOREIGN KEY(invoice_id) REFERENCES invoices(id),
      FOREIGN KEY(service_id) REFERENCES services(id)
    );

    CREATE TABLE IF NOT EXISTS verifactu_settings (
      id INTEGER PRIMARY KEY,
      enabled INTEGER DEFAULT 0,
      environment TEXT DEFAULT 'test',
      cert_path TEXT DEFAULT '',
      cert_password TEXT DEFAULT '',
      id_sistema TEXT DEFAULT 'CLARIFACTU',
      version_sistema TEXT DEFAULT '1.0',
      num_instalacion TEXT DEFAULT '1'
    );

  `);
}

const DEFAULT_REMINDER_SUBJECT = 'Recordatorio: factura {numero} pendiente de pago';
const DEFAULT_REMINDER_BODY = 'Hola {cliente},\n\nTe escribo para recordarte que la factura {numero} del {fecha}, por importe de {total}, sigue pendiente de pago ({dias} días desde su emisión).\n\nTe la adjunto de nuevo. Si ya has realizado el pago, por favor ignora este mensaje.\n\nUn saludo.';

const DEFAULT_IVA_EXEMPT_TEXT = 'Operación exenta de IVA según el artículo 20.Uno.3º de la Ley 37/1992, del Impuesto sobre el Valor Añadido.';

function runMigrations() {
  // Add irpf columns to existing databases
  try { db.exec('ALTER TABLE invoices ADD COLUMN irpf_rate REAL DEFAULT 0'); } catch (_) {}
  try { db.exec('ALTER TABLE invoices ADD COLUMN irpf_amount REAL DEFAULT 0'); } catch (_) {}

  // Add Verifactu columns
  try { db.exec('ALTER TABLE invoices ADD COLUMN huella TEXT'); } catch (_) {}
  try { db.exec('ALTER TABLE invoices ADD COLUMN huella_anterior TEXT'); } catch (_) {}
  try { db.exec('ALTER TABLE invoices ADD COLUMN fecha_hora_gen TEXT'); } catch (_) {}
  try { db.exec("ALTER TABLE invoices ADD COLUMN verifactu_status TEXT DEFAULT 'pendiente'"); } catch (_) {}
  try { db.exec('ALTER TABLE invoices ADD COLUMN verifactu_csv TEXT'); } catch (_) {}

  // Add IBAN to business_settings
  try { db.exec('ALTER TABLE business_settings ADD COLUMN iban TEXT DEFAULT \'\''); } catch (_) {}

  // Add DNIe support to verifactu_settings
  try { db.exec('ALTER TABLE verifactu_settings ADD COLUMN use_dnie INTEGER DEFAULT 0'); } catch (_) {}
  try { db.exec("ALTER TABLE verifactu_settings ADD COLUMN cert_thumbprint TEXT DEFAULT ''"); } catch (_) {}

  // Invoice action tracking
  try { db.exec("ALTER TABLE invoices ADD COLUMN email_sent_at TEXT DEFAULT ''"); } catch (_) {}

  // Payment tracking
  try { db.exec("ALTER TABLE invoices ADD COLUMN payment_status TEXT DEFAULT 'pendiente'"); } catch (_) {}
  try { db.exec("ALTER TABLE invoices ADD COLUMN payment_date TEXT DEFAULT ''"); } catch (_) {}

  // Appearance settings
  try { db.exec("ALTER TABLE business_settings ADD COLUMN dark_mode INTEGER DEFAULT 0"); } catch (_) {}
  try { db.exec("ALTER TABLE business_settings ADD COLUMN invoice_template TEXT DEFAULT 'clasica'"); } catch (_) {}

  // Signature image (base64)
  try { db.exec("ALTER TABLE business_settings ADD COLUMN signature TEXT DEFAULT ''"); } catch (_) {}


  // Overdue threshold
  try { db.exec("ALTER TABLE invoice_number_settings ADD COLUMN overdue_days INTEGER DEFAULT 30"); } catch (_) {}

  // Client tags
  try { db.exec("ALTER TABLE clients ADD COLUMN tags TEXT DEFAULT ''"); } catch (_) {}

  // Client date of birth
  try { db.exec("ALTER TABLE clients ADD COLUMN birth_date TEXT DEFAULT ''"); } catch (_) {}

  // Rectifying invoices
  try { db.exec("ALTER TABLE invoices ADD COLUMN tipo_factura TEXT DEFAULT 'F1'"); } catch (_) {}
  try { db.exec("ALTER TABLE invoices ADD COLUMN factura_rectificada_id INTEGER DEFAULT NULL"); } catch (_) {}
  try { db.exec("ALTER TABLE invoices ADD COLUMN rectified INTEGER DEFAULT 0"); } catch (_) {}
  try { db.exec("ALTER TABLE invoice_number_settings ADD COLUMN rectificativa_counter INTEGER DEFAULT 0"); } catch (_) {}

  // IVA exemption note printed on invoices with 0% VAT (sanitary services are exempt)
  try { db.exec("ALTER TABLE business_settings ADD COLUMN iva_exempt_enabled INTEGER DEFAULT 1"); } catch (_) {}
  try { db.exec(`ALTER TABLE business_settings ADD COLUMN iva_exempt_text TEXT DEFAULT '${DEFAULT_IVA_EXEMPT_TEXT}'`); } catch (_) {}

  // Payment reminders: when the last one was sent, and the email template
  try { db.exec("ALTER TABLE invoices ADD COLUMN reminder_sent_at TEXT DEFAULT ''"); } catch (_) {}

  // Backups: automatic daily backup and optional extra copy in a folder of the user's choice
  try { db.exec("ALTER TABLE business_settings ADD COLUMN auto_backup INTEGER DEFAULT 1"); } catch (_) {}
  try { db.exec("ALTER TABLE business_settings ADD COLUMN backup_dir TEXT DEFAULT ''"); } catch (_) {}

  // Onboarding flag
  try { db.exec("ALTER TABLE business_settings ADD COLUMN onboarding_done INTEGER DEFAULT 0"); } catch (_) {}

  // Create email_settings table if not exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS email_settings (
      id INTEGER PRIMARY KEY,
      gmail_user TEXT DEFAULT '',
      gmail_app_password TEXT DEFAULT '',
      default_subject TEXT DEFAULT 'Factura {numero}',
      default_body TEXT DEFAULT 'Hola {cliente},\n\nAdjunto encontrarás la factura {numero} por importe de {total}.\n\nQuedo a tu disposición para cualquier consulta.\n\nUn saludo.'
    );
  `);

  // Payment reminder template (after email_settings exists)
  try { db.exec(`ALTER TABLE email_settings ADD COLUMN reminder_subject TEXT DEFAULT '${DEFAULT_REMINDER_SUBJECT}'`); } catch (_) {}
  try { db.exec(`ALTER TABLE email_settings ADD COLUMN reminder_body TEXT DEFAULT '${DEFAULT_REMINDER_BODY}'`); } catch (_) {}

  // Activity log
  db.exec(`
    CREATE TABLE IF NOT EXISTS activity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action_type TEXT NOT NULL,
      invoice_id INTEGER,
      invoice_number TEXT,
      client_name TEXT,
      details TEXT,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );
  `);

  // Document templates
  db.exec(`
    CREATE TABLE IF NOT EXISTS document_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      body TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );
  `);

  // Documents
  db.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      body TEXT DEFAULT '',
      client_id INTEGER,
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY(client_id) REFERENCES clients(id)
    );
  `);

  // Document email tracking (must run after the documents table exists, or a fresh
  // database never gets the column)
  try { db.exec("ALTER TABLE documents ADD COLUMN email_sent_at TEXT DEFAULT ''"); } catch (_) {}

  // Expenses
  db.exec(`
    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      provider TEXT DEFAULT '',
      provider_nif TEXT DEFAULT '',
      invoice_number TEXT DEFAULT '',
      amount REAL NOT NULL,
      iva_rate REAL DEFAULT 0,
      iva_amount REAL DEFAULT 0,
      total REAL NOT NULL,
      deductible_pct REAL DEFAULT 100,
      deductible_amount REAL NOT NULL,
      pdf_file TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
}

function seedDefaults() {
  // Insert default business settings if not exists
  const bs = db.prepare('SELECT id FROM business_settings WHERE id = 1').get();
  if (!bs) {
    db.prepare(`
      INSERT INTO business_settings (id, name, nif, address, email, phone, logo, extra_info)
      VALUES (1, '', '', '', '', '', '', '')
    `).run();
  }

  // Insert default invoice number settings if not exists
  const ns = db.prepare('SELECT id FROM invoice_number_settings WHERE id = 1').get();
  if (!ns) {
    const currentYear = new Date().getFullYear();
    db.prepare(`
      INSERT INTO invoice_number_settings (id, prefix, separator, show_year, digits, current_year, counter, start_number)
      VALUES (1, 'F', '-', 1, 4, ?, 0, 1)
    `).run(currentYear);
  }

  // Insert default verifactu settings if not exists
  const vs = db.prepare('SELECT id FROM verifactu_settings WHERE id = 1').get();
  if (!vs) {
    db.prepare('INSERT INTO verifactu_settings (id) VALUES (1)').run();
  }

  // Insert default email settings if not exists
  const es = db.prepare('SELECT id FROM email_settings WHERE id = 1').get();
  if (!es) {
    db.prepare('INSERT INTO email_settings (id) VALUES (1)').run();
  }

}

// ─── Clients ──────────────────────────────────────────────────────────────────

const clients = {
  getAll() {
    return db.prepare('SELECT * FROM clients ORDER BY name ASC').all();
  },
  getById(id) {
    return db.prepare('SELECT * FROM clients WHERE id = ?').get(id);
  },
  // All-or-nothing import of several clients
  bulkCreate(list) {
    const stmt = db.prepare(`
      INSERT INTO clients (name, nif, address, email, phone, notes, tags, birth_date)
      VALUES (@name, @nif, @address, @email, @phone, @notes, @tags, @birth_date)
    `);
    return db.transaction(() => {
      for (const c of list) {
        stmt.run({ name: c.name, nif: c.nif || '', address: c.address || '', email: c.email || '', phone: c.phone || '',
          notes: c.notes || '', tags: c.tags || '', birth_date: c.birth_date || '' });
      }
      return list.length;
    })();
  },
  create(data) {
    const stmt = db.prepare(`
      INSERT INTO clients (name, nif, address, email, phone, notes, tags, birth_date)
      VALUES (@name, @nif, @address, @email, @phone, @notes, @tags, @birth_date)
    `);
    const result = stmt.run({ tags: '', birth_date: '', ...data });
    return { id: result.lastInsertRowid, ...data };
  },
  update(id, data) {
    const stmt = db.prepare(`
      UPDATE clients SET name=@name, nif=@nif, address=@address,
        email=@email, phone=@phone, notes=@notes, tags=@tags, birth_date=@birth_date
      WHERE id=@id
    `);
    stmt.run({ tags: '', birth_date: '', ...data, id });
    return db.prepare('SELECT * FROM clients WHERE id = ?').get(id);
  },
  delete(id) {
    db.prepare('DELETE FROM clients WHERE id = ?').run(id);
    return { success: true };
  },
  search(query) {
    const q = `%${query}%`;
    return db.prepare(`
      SELECT * FROM clients
      WHERE name LIKE ? OR nif LIKE ? OR email LIKE ? OR phone LIKE ?
      ORDER BY name ASC
    `).all(q, q, q, q);
  },
  getAllTags() {
    const rows = db.prepare(`SELECT tags FROM clients WHERE tags IS NOT NULL AND tags != ''`).all();
    const tagSet = new Set();
    rows.forEach(r => r.tags.split(',').map(t => t.trim()).filter(Boolean).forEach(t => tagSet.add(t)));
    return Array.from(tagSet).sort();
  },
  getByTag(tag) {
    const q = `%${tag}%`;
    return db.prepare(`SELECT * FROM clients WHERE tags LIKE ? ORDER BY name ASC`).all(q);
  }
};

// ─── Services ─────────────────────────────────────────────────────────────────

const services = {
  getAll() {
    return db.prepare('SELECT * FROM services ORDER BY name ASC').all();
  },
  getById(id) {
    return db.prepare('SELECT * FROM services WHERE id = ?').get(id);
  },
  create(data) {
    const stmt = db.prepare(`
      INSERT INTO services (name, description, price, duration)
      VALUES (@name, @description, @price, @duration)
    `);
    const result = stmt.run(data);
    return { id: result.lastInsertRowid, ...data };
  },
  update(id, data) {
    const stmt = db.prepare(`
      UPDATE services SET name=@name, description=@description,
        price=@price, duration=@duration
      WHERE id=@id
    `);
    stmt.run({ ...data, id });
    return db.prepare('SELECT * FROM services WHERE id = ?').get(id);
  },
  delete(id) {
    db.prepare('DELETE FROM services WHERE id = ?').run(id);
    return { success: true };
  },
  search(query) {
    const q = `%${query}%`;
    return db.prepare(`
      SELECT * FROM services
      WHERE name LIKE ? OR description LIKE ?
      ORDER BY name ASC
    `).all(q, q);
  }
};

// ─── Invoice numbering helpers ────────────────────────────────────────────────

// Mirrors the format used by the generateInvoiceNumber IPC handler in main.js.
function numberPrefix(s, year) {
  return s.show_year
    ? `${s.prefix}${s.separator}${year}${s.separator}`
    : `${s.prefix}${s.separator}`;
}

function formatInvoiceNumber(s, year, n) {
  return numberPrefix(s, year) + String(n).padStart(s.digits, '0');
}

// Returns the sequence number if `number` follows the current series, else null.
function parseSequence(s, year, number) {
  const prefix = numberPrefix(s, year);
  if (!number.startsWith(prefix)) return null;
  const rest = number.slice(prefix.length);
  return /^\d+$/.test(rest) ? parseInt(rest, 10) : null;
}

// ─── VeriFactu record state ───────────────────────────────────────────────────
// no hash → pendiente (hash calculated) → enviada (registered at AEAT, final) / error

function isRegistered(inv) {
  return inv.verifactu_status === 'enviada' || !!inv.verifactu_csv;
}

function assertNotRegistered(inv, action) {
  if (isRegistered(inv)) {
    throw new Error(`La factura ${inv.invoice_number} ya está registrada en VeriFactu (AEAT) y no se puede ${action}. Emite una factura rectificativa.`);
  }
}

// Records chained after `inv` (each one's huella_anterior is the previous one's huella).
function hashChainAfter(inv) {
  const next = db.prepare('SELECT * FROM invoices WHERE huella_anterior = ? AND id != ?');
  const after = [];
  const seen = new Set([inv.id]);
  let cur = inv;
  while (cur.huella) {
    const n = next.get(cur.huella, cur.id);
    if (!n || seen.has(n.id)) break;
    seen.add(n.id);
    after.push(n);
    cur = n;
  }
  return after;
}

// Clears the hash of `inv` and of every record chained after it, so the chain can be
// recalculated without links pointing at hashes that no longer exist.
// Returns how many later records lost their hash. Throws if one is already registered.
function invalidateHashChain(inv) {
  if (!inv.huella) return 0;
  const after = hashChainAfter(inv);
  const registered = after.find(isRegistered);
  if (registered) {
    throw new Error(`La huella de ${inv.invoice_number} está encadenada con ${registered.invoice_number}, ya registrada en VeriFactu; no se puede modificar.`);
  }
  const clear = db.prepare(`UPDATE invoices SET huella = NULL, huella_anterior = NULL, fecha_hora_gen = NULL,
    verifactu_status = 'pendiente', verifactu_csv = NULL WHERE id = ?`);
  [inv, ...after].forEach(r => clear.run(r.id));
  return after.length;
}

function invoiceNumberExists(number, excludeId = null) {
  return !!db.prepare('SELECT 1 FROM invoices WHERE invoice_number = ? AND id IS NOT ?').get(number, excludeId);
}

// Validates a renumbering without touching anything. Errors block, warnings need confirmation.
function checkRenumber(id, newNumber) {
  const num = String(newNumber || '').trim();
  const inv = db.prepare('SELECT * FROM invoices WHERE id = ?').get(id);
  if (!inv) return { ok: false, error: 'La factura no existe.' };
  if (!num) return { ok: false, error: 'El nuevo número no puede estar vacío.' };
  if (num === inv.invoice_number) return { ok: false, error: 'La factura ya tiene ese número.' };
  if (invoiceNumberExists(num, id)) return { ok: false, error: `Ya existe una factura con el número ${num}.` };
  if (isRegistered(inv)) {
    return { ok: false, error: 'Esta factura ya está registrada en VeriFactu (AEAT) y no se puede renumerar.' };
  }
  const chainedAfter = inv.huella ? hashChainAfter(inv) : [];
  const registeredAfter = chainedAfter.find(isRegistered);
  if (registeredAfter) {
    return { ok: false, error: `La huella de esta factura está encadenada con ${registeredAfter.invoice_number}, ya registrada en VeriFactu; renumerarla rompería la cadena.` };
  }

  const warnings = [];
  const s = db.prepare('SELECT * FROM invoice_number_settings WHERE id = 1').get();
  const year = String(inv.date || '').slice(0, 4) || s.current_year;
  const seq = parseSequence(s, year, num);
  if (seq !== null) {
    const prev = db.prepare('SELECT invoice_number, date FROM invoices WHERE invoice_number = ?').get(formatInvoiceNumber(s, year, seq - 1));
    const next = db.prepare('SELECT invoice_number, date FROM invoices WHERE invoice_number = ?').get(formatInvoiceNumber(s, year, seq + 1));
    if ((prev && prev.date > inv.date) || (next && next.date < inv.date)) {
      warnings.push(`La fecha de la factura (${inv.date}) no queda en orden con sus vecinas` +
        `${prev ? ` (${prev.invoice_number}: ${prev.date})` : ''}${next ? ` (${next.invoice_number}: ${next.date})` : ''}.` +
        ' La numeración debe ser correlativa también en fechas.');
    }
  } else {
    warnings.push('El nuevo número no sigue el formato de numeración configurado.');
  }
  if (inv.email_sent_at) warnings.push('Esta factura ya se envió por email con el número antiguo; el cliente tendrá una copia con ese número.');
  if (inv.huella) {
    warnings.push('Se borrará su huella VeriFactu (aún no enviada) y habrá que recalcularla' +
      (chainedAfter.length ? `, junto con la de ${chainedAfter.length} factura(s) posterior(es) encadenada(s).` : '.'));
  }

  return { ok: true, invoice: inv, newNumber: num, warnings };
}

// '03' → ['03'], 'T2' → ['04','05','06'], '' → null (no month filter)
function periodMonths(period) {
  if (!period) return null;
  const t = /^T([1-4])$/.exec(period);
  if (t) { const first = (Number(t[1]) - 1) * 3 + 1; return [0, 1, 2].map(k => String(first + k).padStart(2, '0')); }
  if (/^(0[1-9]|1[0-2])$/.test(period)) return [period];
  throw new Error(`Periodo no válido: ${period}`);
}

// ─── Invoices ─────────────────────────────────────────────────────────────────

const invoices = {
  checkRenumber(id, newNumber) {
    const { invoice, ...rest } = checkRenumber(id, newNumber);
    return invoice ? { ...rest, oldNumber: invoice.invoice_number } : rest;
  },
  renumber(id, newNumber) {
    const tx = db.transaction(() => {
      const check = checkRenumber(id, newNumber);
      if (!check.ok) return { success: false, error: check.error };
      const inv = check.invoice;
      const oldNumber = inv.invoice_number;
      const num = check.newNumber;

      invalidateHashChain(inv);
      db.prepare('UPDATE invoices SET invoice_number = ? WHERE id = ?').run(num, id);

      // If the moved invoice was the last one issued, pull the counter back so the
      // next invoice reuses the freed number instead of opening a new gap.
      const s = db.prepare('SELECT * FROM invoice_number_settings WHERE id = 1').get();
      if (oldNumber === formatInvoiceNumber(s, s.current_year, s.counter)) {
        const floor = Math.max((s.start_number || 1) - 1, 0);
        let c = s.counter;
        while (c > floor && !invoiceNumberExists(formatInvoiceNumber(s, s.current_year, c))) c--;
        db.prepare('UPDATE invoice_number_settings SET counter = ? WHERE id = 1').run(c);
      }

      const client = inv.client_id ? db.prepare('SELECT name FROM clients WHERE id = ?').get(inv.client_id) : null;
      activityLog.add({
        action_type: 'factura_renumerada', invoice_id: id, invoice_number: num,
        client_name: client ? client.name : null, details: `${oldNumber} → ${num}`
      });
      return { success: true, oldNumber, newNumber: num };
    });
    return tx();
  },
  // Numbers missing from the current year's series (e.g. after deleting an invoice).
  getNumberingGaps() {
    const s = db.prepare('SELECT * FROM invoice_number_settings WHERE id = 1').get();
    const floor = Math.max((s.start_number || 1) - 1, 0);
    const gaps = [];
    for (let n = floor + 1; n <= s.counter; n++) {
      const num = formatInvoiceNumber(s, s.current_year, n);
      if (!invoiceNumberExists(num)) gaps.push(num);
    }
    return gaps;
  },
  getAll() {
    return db.prepare(`
      SELECT i.*, c.name as client_name, c.email as client_email
      FROM invoices i
      LEFT JOIN clients c ON i.client_id = c.id
      ORDER BY i.date DESC, i.id DESC
    `).all();
  },
  getById(id) {
    return db.prepare(`
      SELECT i.*, c.name as client_name, c.nif as client_nif,
             c.address as client_address, c.email as client_email,
             c.phone as client_phone
      FROM invoices i
      LEFT JOIN clients c ON i.client_id = c.id
      WHERE i.id = ?
    `).get(id);
  },
  create(data) {
    const { items, ...invoiceData } = data;

    const insertInvoice = db.prepare(`
      INSERT INTO invoices (invoice_number, client_id, date, notes, subtotal, tax_rate, tax_amount, irpf_rate, irpf_amount, total, tipo_factura, factura_rectificada_id)
      VALUES (@invoice_number, @client_id, @date, @notes, @subtotal, @tax_rate, @tax_amount, @irpf_rate, @irpf_amount, @total, @tipo_factura, @factura_rectificada_id)
    `);

    const insertItem = db.prepare(`
      INSERT INTO invoice_items (invoice_id, service_id, service_name, description, quantity, unit_price, total)
      VALUES (@invoice_id, @service_id, @service_name, @description, @quantity, @unit_price, @total)
    `);

    const transaction = db.transaction(() => {
      const row = { tipo_factura: 'F1', factura_rectificada_id: null, ...invoiceData };
      const result = insertInvoice.run(row);
      const invoiceId = result.lastInsertRowid;

      for (const item of items) {
        insertItem.run({ ...item, invoice_id: invoiceId });
      }

      // A credit note and the "rectified" mark on its original are one transition
      if (row.tipo_factura === 'R1' && row.factura_rectificada_id) {
        db.prepare('UPDATE invoices SET rectified = 1 WHERE id = ?').run(row.factura_rectificada_id);
      }

      return invoiceId;
    });

    const invoiceId = transaction();
    return db.prepare(`
      SELECT i.*, c.name as client_name
      FROM invoices i LEFT JOIN clients c ON i.client_id = c.id
      WHERE i.id = ?
    `).get(invoiceId);
  },
  update(id, data) {
    const { items, ...invoiceData } = data;

    const updateInvoice = db.prepare(`
      UPDATE invoices
      SET client_id=@client_id, date=@date, notes=@notes,
          subtotal=@subtotal, tax_rate=@tax_rate, tax_amount=@tax_amount,
          irpf_rate=@irpf_rate, irpf_amount=@irpf_amount, total=@total
      WHERE id=@id
    `);

    const deleteOldItems = db.prepare('DELETE FROM invoice_items WHERE invoice_id = ?');

    const insertItem = db.prepare(`
      INSERT INTO invoice_items (invoice_id, service_id, service_name, description, quantity, unit_price, total)
      VALUES (@invoice_id, @service_id, @service_name, @description, @quantity, @unit_price, @total)
    `);

    const transaction = db.transaction(() => {
      const current = db.prepare('SELECT * FROM invoices WHERE id = ?').get(id);
      if (!current) throw new Error('La factura no existe.');
      assertNotRegistered(current, 'modificar');
      // The hash covers date, VAT and total: if any of them changes it is no longer valid
      const hashedFieldChanged = current.date !== invoiceData.date ||
        Number(current.tax_amount) !== Number(invoiceData.tax_amount) ||
        Number(current.total) !== Number(invoiceData.total);
      if (hashedFieldChanged) invalidateHashChain(current);

      updateInvoice.run({ ...invoiceData, id });
      deleteOldItems.run(id);
      for (const item of items) {
        insertItem.run({ ...item, invoice_id: id });
      }
    });

    transaction();
    return db.prepare(`
      SELECT i.*, c.name as client_name
      FROM invoices i LEFT JOIN clients c ON i.client_id = c.id
      WHERE i.id = ?
    `).get(id);
  },
  delete(id) {
    const deleteItems = db.prepare('DELETE FROM invoice_items WHERE invoice_id = ?');
    const deleteInvoice = db.prepare('DELETE FROM invoices WHERE id = ?');

    const transaction = db.transaction(() => {
      const inv = db.prepare('SELECT * FROM invoices WHERE id = ?').get(id);
      if (!inv) return;
      assertNotRegistered(inv, 'eliminar');
      invalidateHashChain(inv);
      deleteItems.run(id);
      deleteInvoice.run(id);
      // Deleting a credit note puts its original back to "not rectified" unless another remains
      if (inv.tipo_factura === 'R1' && inv.factura_rectificada_id) {
        const other = db.prepare("SELECT 1 FROM invoices WHERE tipo_factura = 'R1' AND factura_rectificada_id = ?").get(inv.factura_rectificada_id);
        if (!other) db.prepare('UPDATE invoices SET rectified = 0 WHERE id = ?').run(inv.factura_rectificada_id);
      }
    });

    transaction();
    return { success: true };
  },
  search(query) {
    const q = `%${query}%`;
    return db.prepare(`
      SELECT i.*, c.name as client_name, c.email as client_email
      FROM invoices i
      LEFT JOIN clients c ON i.client_id = c.id
      WHERE i.invoice_number LIKE ? OR c.name LIKE ?
      ORDER BY i.date DESC
    `).all(q, q);
  },
  // Invoices of a period: year (or all) and optionally a month ('01'-'12') or quarter ('T1'-'T4')
  getByPeriod(year, period = '') {
    const months = periodMonths(period);
    const where = [];
    const args = [];
    if (year) { where.push("strftime('%Y', i.date) = ?"); args.push(String(year)); }
    if (months) { where.push(`strftime('%m', i.date) IN (${months.map(() => '?').join(',')})`); args.push(...months); }
    return db.prepare(`
      SELECT i.*, c.name as client_name, c.email as client_email
      FROM invoices i
      LEFT JOIN clients c ON i.client_id = c.id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY i.date DESC, i.id DESC
    `).all(...args);
  },
  getByYear(year) {
    return db.prepare(`
      SELECT i.*, c.name as client_name, c.email as client_email
      FROM invoices i
      LEFT JOIN clients c ON i.client_id = c.id
      WHERE strftime('%Y', i.date) = ?
      ORDER BY i.date DESC, i.id DESC
    `).all(String(year));
  },
  markAsPaid(id, date) {
    const d = date || new Date().toISOString().split('T')[0];
    db.prepare(`UPDATE invoices SET payment_status='pagada', payment_date=? WHERE id=?`).run(d, id);
  },
  markAsPending(id) {
    db.prepare(`UPDATE invoices SET payment_status='pendiente', payment_date='' WHERE id=?`).run(id);
  },
  getByClient(clientId) {
    return db.prepare(`
      SELECT i.*, c.name as client_name
      FROM invoices i LEFT JOIN clients c ON i.client_id = c.id
      WHERE i.client_id = ?
      ORDER BY i.date DESC
    `).all(clientId);
  },
  getOverdue(days) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - (days || 30));
    const cutoffStr = cutoff.toISOString().split('T')[0];
    return db.prepare(`
      SELECT i.*, c.name as client_name
      FROM invoices i LEFT JOIN clients c ON i.client_id = c.id
      WHERE i.payment_status != 'pagada' AND i.date <= ?
      ORDER BY i.date ASC
    `).all(cutoffStr);
  },
  getByRectifiedId(id) {
    return db.prepare(`
      SELECT i.*, c.name as client_name
      FROM invoices i LEFT JOIN clients c ON i.client_id = c.id
      WHERE i.factura_rectificada_id = ?
      ORDER BY i.date DESC
    `).all(id);
  }
};

// ─── Invoice Items ────────────────────────────────────────────────────────────

const invoiceItems = {
  getByInvoice(invoiceId) {
    return db.prepare(`
      SELECT ii.*, s.name as service_name_ref
      FROM invoice_items ii
      LEFT JOIN services s ON ii.service_id = s.id
      WHERE ii.invoice_id = ?
      ORDER BY ii.id ASC
    `).all(invoiceId);
  }
};

// ─── Settings ─────────────────────────────────────────────────────────────────

const settings = {
  getBusiness() {
    return db.prepare('SELECT * FROM business_settings WHERE id = 1').get();
  },
  saveBusiness(data) {
    db.prepare(`
      UPDATE business_settings
      SET name=@name, nif=@nif, address=@address, email=@email,
          phone=@phone, logo=@logo, extra_info=@extra_info, iban=@iban,
          signature=@signature
      WHERE id=1
    `).run(data);
    return db.prepare('SELECT * FROM business_settings WHERE id = 1').get();
  },
  saveBackupSettings({ auto_backup, backup_dir }) {
    db.prepare('UPDATE business_settings SET auto_backup = ?, backup_dir = ? WHERE id = 1')
      .run(auto_backup ? 1 : 0, String(backup_dir || ''));
    return db.prepare('SELECT * FROM business_settings WHERE id = 1').get();
  },
  saveIvaExemption({ iva_exempt_enabled, iva_exempt_text }) {
    db.prepare('UPDATE business_settings SET iva_exempt_enabled = ?, iva_exempt_text = ? WHERE id = 1')
      .run(iva_exempt_enabled ? 1 : 0, String(iva_exempt_text || '').trim() || DEFAULT_IVA_EXEMPT_TEXT);
    return db.prepare('SELECT * FROM business_settings WHERE id = 1').get();
  },
  saveAppearance(data) {
    db.prepare(`
      UPDATE business_settings
      SET dark_mode=@dark_mode, invoice_template=@invoice_template
      WHERE id=1
    `).run(data);
    return db.prepare('SELECT * FROM business_settings WHERE id = 1').get();
  },
  getNumberSettings() {
    return db.prepare('SELECT * FROM invoice_number_settings WHERE id = 1').get();
  },
  saveNumberSettings(data) {
    db.prepare(`
      UPDATE invoice_number_settings
      SET prefix=@prefix, separator=@separator, show_year=@show_year,
          digits=@digits, start_number=@start_number, overdue_days=@overdue_days
      WHERE id=1
    `).run(data);
    return db.prepare('SELECT * FROM invoice_number_settings WHERE id = 1').get();
  },
  resetYearCounter(year) {
    // Both series (normal and credit notes) restart every year
    db.prepare(`
      UPDATE invoice_number_settings
      SET current_year=?, counter=0, rectificativa_counter=0
      WHERE id=1
    `).run(year);
  },
  // Starts the new year's numbering on the first number generated in a new year.
  ensureCurrentYear(year = new Date().getFullYear()) {
    const s = db.prepare('SELECT current_year FROM invoice_number_settings WHERE id = 1').get();
    if (s.current_year !== year) this.resetYearCounter(year);
    return db.prepare('SELECT * FROM invoice_number_settings WHERE id = 1').get();
  },
  resetCounter() {
    const ns = db.prepare('SELECT start_number FROM invoice_number_settings WHERE id=1').get();
    const startAt = (ns && ns.start_number) ? ns.start_number - 1 : 0;
    db.prepare(`UPDATE invoice_number_settings SET counter=? WHERE id=1`).run(startAt);
    return db.prepare('SELECT * FROM invoice_number_settings WHERE id=1').get();
  },
  updateCounter(counter) {
    db.prepare(`
      UPDATE invoice_number_settings SET counter=? WHERE id=1
    `).run(counter);
  },
  generateRectificativaNumber() {
    const year = new Date().getFullYear();
    const s = this.ensureCurrentYear(year);
    const sep = s.separator || '-';
    const digits = s.digits || 4;
    const newCounter = (s.rectificativa_counter || 0) + 1;
    const padded = String(newCounter).padStart(digits, '0');
    const number = `R${sep}${year}${sep}${padded}`;
    return { invoiceNumber: number, newCounter };
  },
  commitRectificativaNumber(counter) {
    db.prepare('UPDATE invoice_number_settings SET rectificativa_counter=? WHERE id=1').run(counter);
  },
  isOnboardingDone() {
    const row = db.prepare('SELECT onboarding_done, name FROM business_settings WHERE id = 1').get();
    // Auto-mark done for existing users who already have data
    if (row && !row.onboarding_done && row.name && row.name.trim() !== '') {
      db.prepare('UPDATE business_settings SET onboarding_done = 1 WHERE id = 1').run();
      return true;
    }
    return !!(row && row.onboarding_done);
  },
  markOnboardingDone() {
    db.prepare('UPDATE business_settings SET onboarding_done = 1 WHERE id = 1').run();
  }
};

// ─── Dashboard ────────────────────────────────────────────────────────────────

const dashboard = {
  getStats() {
    const year = new Date().getFullYear();

    const totalThisYear = db.prepare(`
      SELECT COALESCE(SUM(total), 0) as total
      FROM invoices
      WHERE strftime('%Y', date) = ?
    `).get(String(year));

    const totalInvoices = db.prepare('SELECT COUNT(*) as count FROM invoices').get();
    const totalClients = db.prepare('SELECT COUNT(*) as count FROM clients').get();
    const totalServices = db.prepare('SELECT COUNT(*) as count FROM services').get();

    const unpaid = db.prepare(`
      SELECT COUNT(*) as count, COALESCE(SUM(total), 0) as total
      FROM invoices WHERE payment_status != 'pagada'
    `).get();

    return {
      totalThisYear: totalThisYear.total,
      totalInvoices: totalInvoices.count,
      totalClients: totalClients.count,
      totalServices: totalServices.count,
      unpaidCount: unpaid.count,
      unpaidTotal: unpaid.total
    };
  },
  getMonthlyData(year) {
    const rows = db.prepare(`
      SELECT
        CAST(strftime('%m', date) AS INTEGER) as month,
        COALESCE(SUM(total), 0) as total,
        COUNT(*) as count
      FROM invoices
      WHERE strftime('%Y', date) = ?
      GROUP BY month
      ORDER BY month ASC
    `).all(String(year));

    // Fill all 12 months
    const months = Array.from({ length: 12 }, (_, i) => {
      const found = rows.find(r => r.month === i + 1);
      return {
        month: i + 1,
        total: found ? found.total : 0,
        count: found ? found.count : 0
      };
    });

    return months;
  },
  getTopClients(year) {
    return db.prepare(`
      SELECT c.name as client_name, c.id as client_id,
             COALESCE(SUM(i.total), 0) as total,
             COUNT(*) as count
      FROM invoices i
      LEFT JOIN clients c ON i.client_id = c.id
      WHERE strftime('%Y', i.date) = ?
      GROUP BY i.client_id
      ORDER BY total DESC
      LIMIT 5
    `).all(String(year));
  },
  getDocumentStats() {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const total = db.prepare('SELECT COUNT(*) as count FROM documents').get();
    const sentThisMonth = db.prepare(`
      SELECT COUNT(*) as count FROM documents
      WHERE email_sent_at != '' AND email_sent_at IS NOT NULL
        AND strftime('%Y-%m', email_sent_at) = ?
    `).get(`${year}-${month}`);
    return { total: total.count, sentThisMonth: sentThisMonth.count };
  },
  getYearComparison(year1, year2) {
    const getMonthly = (y) => db.prepare(`
      SELECT CAST(strftime('%m', date) AS INTEGER) as month,
             COALESCE(SUM(total), 0) as total
      FROM invoices
      WHERE strftime('%Y', date) = ?
        AND (tipo_factura IS NULL OR tipo_factura = 'F1')
      GROUP BY month ORDER BY month ASC
    `).all(String(y));
    const fill = (rows) => Array.from({ length: 12 }, (_, i) => {
      const found = rows.find(r => r.month === i + 1);
      return found ? found.total : 0;
    });
    return {
      year1: { year: year1, data: fill(getMonthly(year1)) },
      year2: { year: year2, data: fill(getMonthly(year2)) }
    };
  },
  getFiscalSummary(year) {
    const quarters = [
      { label: 'T1', start: '01', end: '03' },
      { label: 'T2', start: '04', end: '06' },
      { label: 'T3', start: '07', end: '09' },
      { label: 'T4', start: '10', end: '12' },
    ];
    return quarters.map(q => {
      const inv = db.prepare(`
        SELECT
          COALESCE(SUM(subtotal), 0) as base,
          COALESCE(SUM(tax_amount), 0) as iva,
          COALESCE(SUM(irpf_amount), 0) as irpf,
          COUNT(*) as count
        FROM invoices
        WHERE strftime('%Y', date) = ?
          AND strftime('%m', date) >= ? AND strftime('%m', date) <= ?
      `).get(String(year), q.start, q.end);
      const exp = db.prepare(`
        SELECT
          COALESCE(SUM(amount), 0) as gastos_base,
          COALESCE(SUM(iva_amount), 0) as gastos_iva,
          COALESCE(SUM(deductible_amount), 0) as gastos_deducibles
        FROM expenses
        WHERE strftime('%Y', date) = ?
          AND strftime('%m', date) >= ? AND strftime('%m', date) <= ?
      `).get(String(year), q.start, q.end);
      return { label: q.label, ...inv, ...exp };
    });
  }
};

// ─── Verifactu ────────────────────────────────────────────────────────────────

const verifactu = {
  getSettings() {
    return db.prepare('SELECT * FROM verifactu_settings WHERE id = 1').get();
  },
  saveSettings(data) {
    db.prepare(`
      UPDATE verifactu_settings
      SET enabled=@enabled, environment=@environment, cert_path=@cert_path,
          cert_password=@cert_password, id_sistema=@id_sistema,
          version_sistema=@version_sistema, num_instalacion=@num_instalacion,
          use_dnie=@use_dnie, cert_thumbprint=@cert_thumbprint
      WHERE id=1
    `).run(data);
    return db.prepare('SELECT * FROM verifactu_settings WHERE id = 1').get();
  },
  getLastInvoiceHash(excludeId = null) {
    // The chain tail: the hashed record no other record links to. Highest id is not enough,
    // since a recalculated older invoice becomes the newest record in the chain.
    return db.prepare(`
      SELECT huella, invoice_number, date, id FROM invoices i
      WHERE huella IS NOT NULL AND id IS NOT @ex
        AND NOT EXISTS (SELECT 1 FROM invoices j WHERE j.huella_anterior = i.huella AND j.id IS NOT @ex)
      ORDER BY fecha_hora_gen DESC, id DESC LIMIT 1
    `).get({ ex: excludeId });
  },
  // Records ready for AEAT, in chain order (each after the record it links to), with the
  // data the XML needs about the previous record and, for credit notes, the corrected invoice.
  getRecordsForSubmission(ids) {
    const rows = ids.map(id => db.prepare(`
      SELECT i.*, c.name AS client_name, c.nif AS client_nif,
             p.invoice_number AS prev_invoice_number, p.date AS prev_date,
             r.invoice_number AS rect_invoice_number, r.date AS rect_date
      FROM invoices i
      LEFT JOIN clients c ON c.id = i.client_id
      LEFT JOIN invoices p ON i.huella_anterior IS NOT NULL AND i.huella_anterior != '' AND p.huella = i.huella_anterior
      LEFT JOIN invoices r ON r.id = i.factura_rectificada_id
      WHERE i.id = ?
    `).get(id)).filter(Boolean);

    // Position in the chain = number of links back to a record outside this batch
    const byHash = new Map(rows.filter(r => r.huella).map(r => [r.huella, r]));
    const depth = r => {
      let d = 0, cur = r;
      const seen = new Set();
      while (cur && cur.huella_anterior && byHash.has(cur.huella_anterior) && !seen.has(cur.id)) {
        seen.add(cur.id);
        cur = byHash.get(cur.huella_anterior);
        d++;
      }
      return d;
    };
    return rows
      .map(r => ({ r, d: depth(r) }))
      .sort((a, b) => a.d - b.d || String(a.r.fecha_hora_gen).localeCompare(String(b.r.fecha_hora_gen)) || a.r.id - b.r.id)
      .map(x => x.r);
  },
  // Call before (re)calculating a hash: refuses registered records and clears this
  // record's old hash and any chained after it. Returns the record to chain to.
  prepareHash(id) {
    return db.transaction(() => {
      const inv = db.prepare('SELECT * FROM invoices WHERE id = ?').get(id);
      if (!inv) throw new Error('La factura no existe.');
      assertNotRegistered(inv, 'recalcular su huella');
      invalidateHashChain(inv);
      return verifactu.getLastInvoiceHash(id);
    })();
  },
  updateInvoiceVerifactu(id, data) {
    db.prepare(`
      UPDATE invoices SET huella=@huella, huella_anterior=@huella_anterior,
        fecha_hora_gen=@fecha_hora_gen, verifactu_status=@verifactu_status,
        verifactu_csv=@verifactu_csv
      WHERE id=@id
    `).run({ ...data, id });
  },
  getPendingInvoices() {
    return db.prepare(`
      SELECT i.*, c.name as client_name, c.nif as client_nif
      FROM invoices i
      LEFT JOIN clients c ON i.client_id = c.id
      WHERE i.verifactu_status = 'pendiente' OR i.verifactu_status IS NULL
      ORDER BY i.id ASC
    `).all();
  },
  getAllWithStatus() {
    return db.prepare(`
      SELECT i.*, c.name as client_name
      FROM invoices i
      LEFT JOIN clients c ON i.client_id = c.id
      ORDER BY i.id DESC
    `).all();
  }
};

// ─── Email Settings ───────────────────────────────────────────────────────────

const emailSettings = {
  get() {
    return db.prepare('SELECT * FROM email_settings WHERE id = 1').get();
  },
  save(data) {
    // Fields not sent keep their current value
    const current = db.prepare('SELECT * FROM email_settings WHERE id = 1').get();
    const row = { ...current, ...data };
    row.reminder_subject = String(row.reminder_subject || '').trim() || DEFAULT_REMINDER_SUBJECT;
    row.reminder_body = String(row.reminder_body || '').trim() ? row.reminder_body : DEFAULT_REMINDER_BODY;
    db.prepare(`
      UPDATE email_settings
      SET gmail_user=@gmail_user, gmail_app_password=@gmail_app_password,
          default_subject=@default_subject, default_body=@default_body,
          reminder_subject=@reminder_subject, reminder_body=@reminder_body
      WHERE id=1
    `).run(row);
    return db.prepare('SELECT * FROM email_settings WHERE id = 1').get();
  }
};


// ─── Activity Log ──────────────────────────────────────────────────────────────

const activityLog = {
  add({ action_type, invoice_id, invoice_number, client_name, details }) {
    db.prepare(`
      INSERT INTO activity_log (action_type, invoice_id, invoice_number, client_name, details)
      VALUES (@action_type, @invoice_id, @invoice_number, @client_name, @details)
    `).run({ action_type, invoice_id: invoice_id || null, invoice_number: invoice_number || null, client_name: client_name || null, details: details || null });
    // Keep only the last 500 entries
    db.prepare(`
      DELETE FROM activity_log WHERE id NOT IN (
        SELECT id FROM activity_log ORDER BY id DESC LIMIT 500
      )
    `).run();
  },
  getRecent(limit = 30) {
    return db.prepare(`
      SELECT * FROM activity_log ORDER BY id DESC LIMIT ?
    `).all(limit);
  }
};

// ─── Document Templates ───────────────────────────────────────────────────────

const documentTemplates = {
  getAll() {
    return db.prepare('SELECT * FROM document_templates ORDER BY name ASC').all();
  },
  create(data) {
    const result = db.prepare('INSERT INTO document_templates (name, body) VALUES (@name, @body)').run(data);
    return db.prepare('SELECT * FROM document_templates WHERE id = ?').get(result.lastInsertRowid);
  },
  update(id, data) {
    db.prepare('UPDATE document_templates SET name=@name, body=@body WHERE id=@id').run({ ...data, id });
    return db.prepare('SELECT * FROM document_templates WHERE id = ?').get(id);
  },
  delete(id) {
    db.prepare('DELETE FROM document_templates WHERE id = ?').run(id);
    return { success: true };
  }
};

// ─── Documents ────────────────────────────────────────────────────────────────

const documents = {
  getAll() {
    return db.prepare(`
      SELECT d.*, c.name as client_name, c.email as client_email
      FROM documents d
      LEFT JOIN clients c ON d.client_id = c.id
      ORDER BY d.created_at DESC
    `).all();
  },
  getById(id) {
    return db.prepare(`
      SELECT d.*, c.name as client_name, c.nif as client_nif,
             c.address as client_address, c.email as client_email,
             c.birth_date as client_birth_date
      FROM documents d
      LEFT JOIN clients c ON d.client_id = c.id
      WHERE d.id = ?
    `).get(id);
  },
  create(data) {
    const result = db.prepare(`
      INSERT INTO documents (title, body, client_id)
      VALUES (@title, @body, @client_id)
    `).run(data);
    return db.prepare(`
      SELECT d.*, c.name as client_name
      FROM documents d LEFT JOIN clients c ON d.client_id = c.id
      WHERE d.id = ?
    `).get(result.lastInsertRowid);
  },
  update(id, data) {
    db.prepare(`
      UPDATE documents SET title=@title, body=@body, client_id=@client_id
      WHERE id=@id
    `).run({ ...data, id });
    return db.prepare(`
      SELECT d.*, c.name as client_name
      FROM documents d LEFT JOIN clients c ON d.client_id = c.id
      WHERE d.id = ?
    `).get(id);
  },
  delete(id) {
    db.prepare('DELETE FROM documents WHERE id = ?').run(id);
    return { success: true };
  },
  search(query) {
    const q = `%${query}%`;
    return db.prepare(`
      SELECT d.*, c.name as client_name, c.email as client_email
      FROM documents d
      LEFT JOIN clients c ON d.client_id = c.id
      WHERE d.title LIKE ? OR d.body LIKE ? OR c.name LIKE ?
      ORDER BY d.created_at DESC
    `).all(q, q, q);
  },
  markEmailSent(id) {
    db.prepare("UPDATE documents SET email_sent_at = datetime('now', 'localtime') WHERE id = ?").run(id);
  }
};

// ─── Expenses ─────────────────────────────────────────────────────────────────

const expenses = {
  getAll() {
    return db.prepare('SELECT * FROM expenses ORDER BY date DESC, id DESC').all();
  },
  getById(id) {
    return db.prepare('SELECT * FROM expenses WHERE id = ?').get(id);
  },
  create(data) {
    const amount = data.amount || 0;
    const iva_amount = amount * (data.iva_rate || 0) / 100;
    const deductible_pct = data.deductible_pct !== undefined ? data.deductible_pct : 100;
    const deductible_amount = amount * deductible_pct / 100;
    const total = amount + iva_amount;
    const stmt = db.prepare(`
      INSERT INTO expenses (date, description, category, provider, provider_nif, invoice_number,
        amount, iva_rate, iva_amount, total, deductible_pct, deductible_amount, pdf_file, notes)
      VALUES (@date, @description, @category, @provider, @provider_nif, @invoice_number,
        @amount, @iva_rate, @iva_amount, @total, @deductible_pct, @deductible_amount, @pdf_file, @notes)
    `);
    const result = stmt.run({
      provider: '', provider_nif: '', invoice_number: '', pdf_file: '', notes: '',
      ...data, iva_amount, deductible_amount, deductible_pct, total
    });
    return db.prepare('SELECT * FROM expenses WHERE id = ?').get(result.lastInsertRowid);
  },
  update(id, data) {
    const amount = data.amount || 0;
    const iva_amount = amount * (data.iva_rate || 0) / 100;
    const deductible_pct = data.deductible_pct !== undefined ? data.deductible_pct : 100;
    const deductible_amount = amount * deductible_pct / 100;
    const total = amount + iva_amount;
    db.prepare(`
      UPDATE expenses SET date=@date, description=@description, category=@category,
        provider=@provider, provider_nif=@provider_nif, invoice_number=@invoice_number,
        amount=@amount, iva_rate=@iva_rate, iva_amount=@iva_amount, total=@total,
        deductible_pct=@deductible_pct, deductible_amount=@deductible_amount,
        pdf_file=@pdf_file, notes=@notes
      WHERE id=@id
    `).run({
      provider: '', provider_nif: '', invoice_number: '', pdf_file: '', notes: '',
      ...data, iva_amount, deductible_amount, deductible_pct, total, id
    });
    return db.prepare('SELECT * FROM expenses WHERE id = ?').get(id);
  },
  delete(id) {
    db.prepare('DELETE FROM expenses WHERE id = ?').run(id);
    return { success: true };
  },
  getByYear(year) {
    return db.prepare(`
      SELECT * FROM expenses
      WHERE strftime('%Y', date) = ?
      ORDER BY date DESC, id DESC
    `).all(String(year));
  },
  getSummaryByYear(year) {
    return db.prepare(`
      SELECT category,
        COALESCE(SUM(amount), 0) as total_base,
        COALESCE(SUM(iva_amount), 0) as total_iva,
        COALESCE(SUM(deductible_amount), 0) as total_deducible,
        COUNT(*) as count
      FROM expenses
      WHERE strftime('%Y', date) = ?
      GROUP BY category
      ORDER BY total_deducible DESC
    `).all(String(year));
  }
};

// ─── Invoice: markReminderSent ────────────────────────────────────────────────

invoices.markReminderSent = function(id) {
  db.prepare("UPDATE invoices SET reminder_sent_at = datetime('now', 'localtime') WHERE id = ?").run(id);
};

// ─── Invoice: markEmailSent ────────────────────────────────────────────────────

invoices.markEmailSent = function(id) {
  db.prepare("UPDATE invoices SET email_sent_at = datetime('now', 'localtime') WHERE id = ?").run(id);
};

// ─── Fiscal reports ───────────────────────────────────────────────────────────

const { calcModelo130 } = require('../modelo130');

const M347_THRESHOLD = 3005.06;
// Payments that are not operations with a third party (Social Security fees, taxes)
const M347_EXCLUDED_EXPENSE_CATEGORIES = ['SEG_SOCIAL', 'TRIBUTOS'];

const quarterOf = isoDate => Math.floor((parseInt(String(isoDate).slice(5, 7), 10) - 1) / 3) + 1;

// Adds `amount` to the group `key`, keeping per-quarter totals
function addToGroup(groups, key, base, amount, date) {
  const g = groups.get(key) || { ...base, total: 0, q1: 0, q2: 0, q3: 0, q4: 0, count: 0 };
  g.total += amount;
  g[`q${quarterOf(date)}`] += amount;
  g.count++;
  groups.set(key, g);
}

const round2 = n => Math.round(n * 100) / 100;

const fiscal = {
  // Modelo 130 for a year, quarter by quarter (cumulative, see src/modelo130.js).
  // Casilla 13 needs the previous year's net income: taken from the previous year's data in
  // Clarifactu when there is any; otherwise unknown (no reduction applied).
  getModelo130(year) {
    const y = Number(year);
    const prev = String(y - 1);
    const hasPrev = db.prepare(`
      SELECT (SELECT COUNT(*) FROM invoices WHERE strftime('%Y', date) = ?) +
             (SELECT COUNT(*) FROM expenses WHERE strftime('%Y', date) = ?) AS n`).get(prev, prev).n > 0;
    let prevYearNet = null;
    if (hasPrev) {
      const inc = db.prepare(`SELECT COALESCE(SUM(subtotal), 0) AS v FROM invoices WHERE strftime('%Y', date) = ?`).get(prev).v;
      const exp = db.prepare(`SELECT COALESCE(SUM(deductible_amount), 0) AS v FROM expenses WHERE strftime('%Y', date) = ?`).get(prev).v;
      prevYearNet = round2(inc - exp);
    }
    return { year: y, prevYearNet, rows: calcModelo130(dashboard.getFiscalSummary(y), { prevYearNet }) };
  },

  // Libros registro de ingresos y gastos (IRPF, estimación directa) for a year
  getLibroRegistro(year) {
    const y = String(year);
    const ingresos = db.prepare(`
      SELECT i.date, i.invoice_number, i.tipo_factura, c.nif AS client_nif, c.name AS client_name,
             i.subtotal, i.tax_rate, i.tax_amount, i.irpf_rate, i.irpf_amount, i.total,
             i.payment_status, i.payment_date, r.invoice_number AS rect_invoice_number,
             (SELECT GROUP_CONCAT(service_name, ', ') FROM invoice_items WHERE invoice_id = i.id) AS concept
      FROM invoices i
      LEFT JOIN clients c ON c.id = i.client_id
      LEFT JOIN invoices r ON r.id = i.factura_rectificada_id
      WHERE strftime('%Y', i.date) = ?
      ORDER BY i.date ASC, i.invoice_number ASC
    `).all(y);
    const gastos = db.prepare(`
      SELECT date, invoice_number, provider_nif, provider, description, category,
             amount, iva_rate, iva_amount, total, deductible_pct, deductible_amount
      FROM expenses
      WHERE strftime('%Y', date) = ?
      ORDER BY date ASC, id ASC
    `).all(y);
    return { ingresos, gastos };
  },

  // Modelo 347: third parties with more than 3.005,06 € (VAT included) in the year.
  // Invoices with IRPF withholding are left out (they go in modelo 190, not the 347).
  get347(year) {
    const y = String(year);
    const clients = new Map();
    let withheld = 0;
    const invs = db.prepare(`
      SELECT i.date, i.subtotal, i.tax_amount, i.irpf_amount, i.client_id, c.nif, c.name
      FROM invoices i LEFT JOIN clients c ON c.id = i.client_id
      WHERE strftime('%Y', i.date) = ?
    `).all(y);
    for (const inv of invs) {
      if (Number(inv.irpf_amount) > 0) { withheld++; continue; }
      const nif = String(inv.nif || '').trim().toUpperCase();
      const key = nif || `client:${inv.client_id}`;
      addToGroup(clients, key, { nif, name: inv.name || 'Sin cliente' }, (inv.subtotal || 0) + (inv.tax_amount || 0), inv.date);
    }

    const providers = new Map();
    let excludedExpenses = 0;
    const exps = db.prepare(`SELECT date, provider, provider_nif, category, total FROM expenses WHERE strftime('%Y', date) = ?`).all(y);
    for (const e of exps) {
      if (M347_EXCLUDED_EXPENSE_CATEGORIES.includes(e.category)) { excludedExpenses++; continue; }
      const nif = String(e.provider_nif || '').trim().toUpperCase();
      const name = String(e.provider || '').trim();
      const key = nif || `name:${name.toLowerCase()}`;
      addToGroup(providers, key, { nif, name: name || 'Sin proveedor', rent: false }, e.total || 0, e.date);
      if (e.category === 'ARRENDAMIENTOS') providers.get(key).rent = true;
    }

    const over = groups => [...groups.values()]
      .filter(g => Math.abs(g.total) > M347_THRESHOLD)
      .map(g => ({ ...g, total: round2(g.total), q1: round2(g.q1), q2: round2(g.q2), q3: round2(g.q3), q4: round2(g.q4) }))
      .sort((a, b) => b.total - a.total);

    return {
      year: Number(year),
      threshold: M347_THRESHOLD,
      clientes: over(clients),
      proveedores: over(providers),
      excluded: { invoicesWithWithholding: withheld, expensesNotThirdParty: excludedExpenses }
    };
  }
};

// Consistent copy of the live database (includes changes still in the WAL file)
function backup(destPath) {
  return db.backup(destPath);
}

function close() {
  if (db) {
    try { db.close(); } catch (_) {}
    db = null;
  }
}

module.exports = {
  initialize,
  close,
  backup,
  fiscal,
  clients,
  services,
  invoices,
  invoiceItems,
  settings,
  dashboard,
  verifactu,
  emailSettings,
  activityLog,
  documents,
  documentTemplates,
  expenses
};
