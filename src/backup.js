// ─── Backups ──────────────────────────────────────────────────────────────────
// A backup is a .zip with the database (`clarifactu.db`) and the supplier invoices
// attached to expenses (`expense-docs/`). Older backups were a bare .db file; they
// can still be restored. No Electron here, so the tests can drive it directly.

const fs = require('fs');
const os = require('os');
const path = require('path');
const AdmZip = require('adm-zip');

const KEEP = 5;
const DB_FILE = 'clarifactu.db';
const DOCS_DIR = 'expense-docs';
const SQLITE_HEADER = Buffer.from('SQLite format 3\0', 'binary');
const BACKUP_NAME = /^backup_[\d_-]+\.(zip|db)$/;

function backupsDir(userData) {
  return path.join(userData, 'backups');
}

function loadRegistry(userData) {
  try {
    return JSON.parse(fs.readFileSync(path.join(backupsDir(userData), 'registry.json'), 'utf8'));
  } catch (_) {
    return [];
  }
}

function saveRegistry(userData, registry) {
  fs.writeFileSync(path.join(backupsDir(userData), 'registry.json'), JSON.stringify(registry, null, 2), 'utf8');
}

function timestamp(now) {
  const pad = v => String(v).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
}

// Keeps the newest KEEP backups in an external folder (only files Clarifactu named)
function pruneFolder(dir) {
  const files = fs.readdirSync(dir).filter(f => BACKUP_NAME.test(f)).sort().reverse();
  for (const f of files.slice(KEEP)) {
    try { fs.unlinkSync(path.join(dir, f)); } catch (_) {}
  }
}

/**
 * Creates a backup. `db` is the database module: its backup() uses SQLite's online
 * backup API, so the copy is consistent and includes changes still in the WAL file
 * (copying clarifactu.db alone misses them).
 * Also copied to `externalDir` when set; a failure there doesn't fail the backup.
 */
async function createBackup({ userData, db, externalDir = '', auto = false, now = new Date() }) {
  const dir = backupsDir(userData);
  fs.mkdirSync(dir, { recursive: true });

  const tmpDb = path.join(os.tmpdir(), `clarifactu-backup-${process.pid}-${Date.now()}.db`);
  await db.backup(tmpDb);

  let filename = `backup_${timestamp(now)}.zip`;
  for (let i = 1; fs.existsSync(path.join(dir, filename)); i++) filename = `backup_${timestamp(now)}-${i}.zip`;
  const dest = path.join(dir, filename);
  try {
    const zip = new AdmZip();
    zip.addLocalFile(tmpDb, '', DB_FILE);
    const docs = path.join(userData, DOCS_DIR);
    if (fs.existsSync(docs)) zip.addLocalFolder(docs, DOCS_DIR);
    zip.writeZip(dest);
  } finally {
    try { fs.unlinkSync(tmpDb); } catch (_) {}
  }

  const entry = { filename, createdAt: now.toISOString(), size: fs.statSync(dest).size, auto };
  const registry = loadRegistry(userData);
  registry.unshift(entry);
  for (const old of registry.splice(KEEP)) {
    try { fs.unlinkSync(path.join(dir, old.filename)); } catch (_) {}
  }
  saveRegistry(userData, registry);

  let external = null;
  if (externalDir) {
    try {
      fs.mkdirSync(externalDir, { recursive: true });
      fs.copyFileSync(dest, path.join(externalDir, filename));
      pruneFolder(externalDir);
      external = { success: true, dir: externalDir };
    } catch (err) {
      external = { success: false, dir: externalDir, error: err.message };
    }
  }

  return { success: true, entry, list: registry, external };
}

function isBackupDue(userData, now = new Date(), hours = 24) {
  const [latest] = loadRegistry(userData);
  return !latest || now - new Date(latest.createdAt) >= hours * 3600 * 1000;
}

/**
 * Reads and validates a backup file (.zip or legacy .db) without touching anything,
 * so a bad file is rejected before the open database is closed.
 */
function readBackupFile(file) {
  if (!fs.existsSync(file)) throw new Error('El archivo de backup no existe');
  let dbData, docs = [];
  if (file.toLowerCase().endsWith('.zip')) {
    let zip;
    try { zip = new AdmZip(file); } catch (_) { throw new Error('El archivo no es un zip válido'); }
    const dbEntry = zip.getEntry(DB_FILE);
    if (!dbEntry) throw new Error('El archivo no es un backup de Clarifactu (falta clarifactu.db)');
    dbData = dbEntry.getData();
    docs = zip.getEntries()
      .filter(e => !e.isDirectory && e.entryName.startsWith(`${DOCS_DIR}/`))
      .map(e => ({ name: e.entryName.slice(DOCS_DIR.length + 1), data: e.getData() }));
  } else {
    dbData = fs.readFileSync(file);
  }
  if (dbData.length < SQLITE_HEADER.length || !dbData.subarray(0, SQLITE_HEADER.length).equals(SQLITE_HEADER)) {
    throw new Error('El archivo no contiene una base de datos válida');
  }
  return { dbData, docs };
}

/**
 * Replaces the database (and restores the supplier invoices) with a backup read by
 * readBackupFile(). The caller must close the database first and relaunch after.
 */
function applyBackup({ dbData, docs }, userData) {
  const dbPath = path.join(userData, DB_FILE);
  // Leftover WAL files from the old database would be replayed over the restored one
  for (const ext of ['-wal', '-shm']) {
    try { if (fs.existsSync(dbPath + ext)) fs.unlinkSync(dbPath + ext); } catch (_) {}
  }
  // Write aside and rename, so a failed write never leaves a half-written database
  fs.writeFileSync(dbPath + '.restoring', dbData);
  fs.renameSync(dbPath + '.restoring', dbPath);

  const docsDir = path.resolve(userData, DOCS_DIR);
  for (const doc of docs) {
    const target = path.resolve(docsDir, doc.name);
    if (!target.startsWith(docsDir + path.sep)) continue; // ignore entries escaping the folder
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, doc.data);
  }
}

module.exports = { createBackup, isBackupDue, readBackupFile, applyBackup, loadRegistry, backupsDir, KEEP };
