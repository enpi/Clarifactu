/**
 * Backups (src/backup.js) against a real database in a throwaway folder.
 */
const os = require('os');
const path = require('path');
const fs = require('fs');
const AdmZip = require('adm-zip');
const Database = require('better-sqlite3');
const backup = require('../../src/backup');

let db;
let userData;
const tmpDirs = [];
const mkTmp = prefix => { const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix)); tmpDirs.push(d); return d; };

const countIn = (dbPath, sql) => {
  const d = new Database(dbPath, { readonly: true });
  try { return d.prepare(sql).get().n; } finally { d.close(); }
};
// Like countIn, but a database missing the table counts as 0 rows
const countOrZero = (dbPath, sql) => {
  try { return countIn(dbPath, sql); } catch (e) { if (/no such table/.test(e.message)) return 0; throw e; }
};

beforeAll(() => {
  userData = mkTmp('clarifactu-bk-');
  jest.isolateModules(() => { db = require('../../src/database/db'); });
  db.initialize(userData);
  db.clients.create({ name: 'Cliente Backup', nif: '', address: '', email: '', phone: '', notes: '' });
  fs.mkdirSync(path.join(userData, 'expense-docs'));
  fs.writeFileSync(path.join(userData, 'expense-docs', 'gasto-1.pdf'), 'PDF proveedor');
});

afterAll(() => {
  try { db.close(); } catch (_) {}
  for (const d of tmpDirs) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) {} }
});

test('the backup includes changes still in the WAL file (copying the .db alone misses them)', async () => {
  db.clients.create({ name: 'Solo en el WAL', nif: '', address: '', email: '', phone: '', notes: '' });

  // What the old backup did: copy clarifactu.db only
  const naive = path.join(mkTmp('clarifactu-naive-'), 'copy.db');
  fs.copyFileSync(path.join(userData, 'clarifactu.db'), naive);
  // (on a database whose WAL was never checkpointed, even the tables are missing)
  const naiveCount = countOrZero(naive, "SELECT COUNT(*) n FROM clients WHERE name = 'Solo en el WAL'");

  const { entry } = await backup.createBackup({ userData, db });
  const zip = new AdmZip(path.join(backup.backupsDir(userData), entry.filename));
  const restored = path.join(mkTmp('clarifactu-unzip-'), 'clarifactu.db');
  fs.writeFileSync(restored, zip.getEntry('clarifactu.db').getData());

  expect(naiveCount).toBe(0); // the old approach lost it
  expect(countIn(restored, "SELECT COUNT(*) n FROM clients WHERE name = 'Solo en el WAL'")).toBe(1);
});

test('the backup includes the supplier invoices attached to expenses', async () => {
  const { entry } = await backup.createBackup({ userData, db });
  const zip = new AdmZip(path.join(backup.backupsDir(userData), entry.filename));
  expect(zip.getEntry('expense-docs/gasto-1.pdf').getData().toString()).toBe('PDF proveedor');
});

test('keeps only the 5 newest backups', async () => {
  for (let i = 0; i < 6; i++) await backup.createBackup({ userData, db, now: new Date(2030, 0, 1, 10, 0, i) });
  const registry = backup.loadRegistry(userData);
  expect(registry).toHaveLength(backup.KEEP);
  const onDisk = fs.readdirSync(backup.backupsDir(userData)).filter(f => f.endsWith('.zip'));
  expect(onDisk.sort()).toEqual(registry.map(r => r.filename).sort());
});

test('copies each backup to the extra folder and keeps the 5 newest there', async () => {
  const external = mkTmp('clarifactu-drive-');
  fs.writeFileSync(path.join(external, 'notas.txt'), 'no es un backup'); // must be left alone
  for (let i = 0; i < 6; i++) {
    const r = await backup.createBackup({ userData, db, externalDir: external, now: new Date(2031, 0, 1, 10, 0, i) });
    expect(r.external.success).toBe(true);
  }
  const files = fs.readdirSync(external);
  expect(files.filter(f => f.endsWith('.zip'))).toHaveLength(backup.KEEP);
  expect(files).toContain('notas.txt');
});

test('a failing extra folder does not fail the backup', async () => {
  const blocker = path.join(mkTmp('clarifactu-x-'), 'soy-un-fichero');
  fs.writeFileSync(blocker, '');
  const r = await backup.createBackup({ userData, db, externalDir: path.join(blocker, 'sub') });
  expect(r.success).toBe(true);
  expect(r.external.success).toBe(false);
});

test('a backup is due when there is none or the latest is older than 24 h', () => {
  const fresh = mkTmp('clarifactu-due-');
  expect(backup.isBackupDue(fresh)).toBe(true);
  const [latest] = backup.loadRegistry(userData);
  const t = new Date(latest.createdAt);
  expect(backup.isBackupDue(userData, new Date(t.getTime() + 23 * 3600e3))).toBe(false);
  expect(backup.isBackupDue(userData, new Date(t.getTime() + 25 * 3600e3))).toBe(true);
});

describe('restoring', () => {
  test('a zip backup restores the database and the supplier invoices', async () => {
    const { entry } = await backup.createBackup({ userData, db });
    const pkg = backup.readBackupFile(path.join(backup.backupsDir(userData), entry.filename));
    const target = mkTmp('clarifactu-restore-');
    fs.writeFileSync(path.join(target, 'clarifactu.db-wal'), 'stale'); // leftover from the old database
    backup.applyBackup(pkg, target);
    expect(fs.existsSync(path.join(target, 'clarifactu.db-wal'))).toBe(false); // before opening it, which creates a new one
    expect(countIn(path.join(target, 'clarifactu.db'), "SELECT COUNT(*) n FROM clients WHERE name = 'Cliente Backup'")).toBe(1);
    expect(fs.readFileSync(path.join(target, 'expense-docs', 'gasto-1.pdf'), 'utf8')).toBe('PDF proveedor');
  });

  test('an old .db backup can still be restored', async () => {
    const legacy = path.join(mkTmp('clarifactu-legacy-'), 'backup_2026-03-12_12-50-17.db');
    await db.backup(legacy);
    const target = mkTmp('clarifactu-restore-');
    backup.applyBackup(backup.readBackupFile(legacy), target);
    expect(countIn(path.join(target, 'clarifactu.db'), 'SELECT COUNT(*) n FROM clients')).toBeGreaterThan(0);
  });

  test('files that are not Clarifactu backups are rejected before anything changes', () => {
    const dir = mkTmp('clarifactu-bad-');
    const notDb = path.join(dir, 'x.db');
    fs.writeFileSync(notDb, 'hola');
    expect(() => backup.readBackupFile(notDb)).toThrow(/base de datos válida/);

    const zipNoDb = new AdmZip();
    zipNoDb.addFile('otra-cosa.txt', Buffer.from('x'));
    zipNoDb.writeZip(path.join(dir, 'x.zip'));
    expect(() => backup.readBackupFile(path.join(dir, 'x.zip'))).toThrow(/falta clarifactu.db/);

    expect(() => backup.readBackupFile(path.join(dir, 'no-existe.zip'))).toThrow(/no existe/);
  });

  test('zip entries that try to escape the supplier invoices folder are ignored', () => {
    const target = mkTmp('clarifactu-slip-');
    const dbData = fs.readFileSync(path.join(userData, 'clarifactu.db'));
    backup.applyBackup({ dbData, docs: [{ name: '../../evil.txt', data: Buffer.from('x') }, { name: 'ok.pdf', data: Buffer.from('y') }] }, target);
    expect(fs.existsSync(path.join(target, '..', 'evil.txt'))).toBe(false);
    expect(fs.existsSync(path.join(target, 'expense-docs', 'ok.pdf'))).toBe(true);
  });
});

test('backup settings default to a daily automatic backup with no extra folder', () => {
  const biz = db.settings.getBusiness();
  expect(biz.auto_backup).toBe(1);
  expect(biz.backup_dir).toBe('');
  const saved = db.settings.saveBackupSettings({ auto_backup: false, backup_dir: 'D:\\Drive\\Clarifactu' });
  expect(saved.auto_backup).toBe(0);
  expect(saved.backup_dir).toBe('D:\\Drive\\Clarifactu');
});
