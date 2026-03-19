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

  // Document email tracking
  try { db.exec("ALTER TABLE documents ADD COLUMN email_sent_at TEXT DEFAULT ''"); } catch (_) {}

  // Overdue threshold
  try { db.exec("ALTER TABLE invoice_number_settings ADD COLUMN overdue_days INTEGER DEFAULT 30"); } catch (_) {}

  // Client tags
  try { db.exec("ALTER TABLE clients ADD COLUMN tags TEXT DEFAULT ''"); } catch (_) {}

  // Rectifying invoices
  try { db.exec("ALTER TABLE invoices ADD COLUMN tipo_factura TEXT DEFAULT 'F1'"); } catch (_) {}
  try { db.exec("ALTER TABLE invoices ADD COLUMN factura_rectificada_id INTEGER DEFAULT NULL"); } catch (_) {}
  try { db.exec("ALTER TABLE invoices ADD COLUMN rectified INTEGER DEFAULT 0"); } catch (_) {}
  try { db.exec("ALTER TABLE invoice_number_settings ADD COLUMN rectificativa_counter INTEGER DEFAULT 0"); } catch (_) {}

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
  create(data) {
    const stmt = db.prepare(`
      INSERT INTO clients (name, nif, address, email, phone, notes, tags)
      VALUES (@name, @nif, @address, @email, @phone, @notes, @tags)
    `);
    const result = stmt.run({ tags: '', ...data });
    return { id: result.lastInsertRowid, ...data };
  },
  update(id, data) {
    const stmt = db.prepare(`
      UPDATE clients SET name=@name, nif=@nif, address=@address,
        email=@email, phone=@phone, notes=@notes, tags=@tags
      WHERE id=@id
    `);
    stmt.run({ tags: '', ...data, id });
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

// ─── Invoices ─────────────────────────────────────────────────────────────────

const invoices = {
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
      const result = insertInvoice.run({ tipo_factura: 'F1', factura_rectificada_id: null, ...invoiceData });
      const invoiceId = result.lastInsertRowid;

      for (const item of items) {
        insertItem.run({ ...item, invoice_id: invoiceId });
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
      deleteItems.run(id);
      deleteInvoice.run(id);
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
  },
  markAsRectified(id) {
    db.prepare(`UPDATE invoices SET rectified = 1 WHERE id = ?`).run(id);
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
    db.prepare(`
      UPDATE invoice_number_settings
      SET current_year=?, counter=0
      WHERE id=1
    `).run(year);
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
    const s = db.prepare('SELECT * FROM invoice_number_settings WHERE id = 1').get();
    const year = new Date().getFullYear();
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
      const row = db.prepare(`
        SELECT
          COALESCE(SUM(subtotal), 0) as base,
          COALESCE(SUM(tax_amount), 0) as iva,
          COALESCE(SUM(irpf_amount), 0) as irpf,
          COUNT(*) as count
        FROM invoices
        WHERE strftime('%Y', date) = ?
          AND strftime('%m', date) >= ? AND strftime('%m', date) <= ?
      `).get(String(year), q.start, q.end);
      return { label: q.label, ...row };
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
    // Get the most recent invoice's hash for chaining
    const query = excludeId
      ? 'SELECT huella, invoice_number, date, id FROM invoices WHERE huella IS NOT NULL AND id != ? ORDER BY id DESC LIMIT 1'
      : 'SELECT huella, invoice_number, date, id FROM invoices WHERE huella IS NOT NULL ORDER BY id DESC LIMIT 1';
    return excludeId
      ? db.prepare(query).get(excludeId)
      : db.prepare(query).get();
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
    db.prepare(`
      UPDATE email_settings
      SET gmail_user=@gmail_user, gmail_app_password=@gmail_app_password,
          default_subject=@default_subject, default_body=@default_body
      WHERE id=1
    `).run(data);
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
             c.address as client_address, c.email as client_email
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

// ─── Invoice: markEmailSent ────────────────────────────────────────────────────

invoices.markEmailSent = function(id) {
  db.prepare("UPDATE invoices SET email_sent_at = datetime('now', 'localtime') WHERE id = ?").run(id);
};

function close() {
  if (db) {
    try { db.close(); } catch (_) {}
    db = null;
  }
}

module.exports = {
  initialize,
  close,
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
  documentTemplates
};
