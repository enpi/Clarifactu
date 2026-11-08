const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const AdmZip = require('adm-zip');

// Tests (Playwright) run the app against their own throwaway data folder
if (process.env.CLARIFACTU_USER_DATA) app.setPath('userData', process.env.CLARIFACTU_USER_DATA);
// ...and with the window hidden, so test runs don't pop windows up on screen
const HIDE_WINDOW = process.env.CLARIFACTU_HIDE_WINDOW === '1';

// ─── Auto-updater (only in packaged builds) ───────────────────────────────────
let autoUpdater = null;
try {
  ({ autoUpdater } = require('electron-updater'));
  autoUpdater.logger = console;
  autoUpdater.autoDownload = true;
  autoUpdater.allowPrerelease = false;
} catch (_) {}

// ─── License System ───────────────────────────────────────────────────────────
const LICENSE_SECRET = 'clrf-license-secret-k9x2q7w4m1';

function validateLicenseKey(key) {
  const clean = key.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (clean.length !== 25) return false;
  const body = `${clean.slice(0,5)}-${clean.slice(5,10)}-${clean.slice(10,15)}-${clean.slice(15,20)}`;
  const check = clean.slice(20);
  const expected = crypto.createHmac('sha256', LICENSE_SECRET)
    .update(body)
    .digest('hex')
    .toUpperCase()
    .substring(0, 5);
  return check === expected;
}

function getLicensePath() {
  return path.join(app.getPath('userData'), 'license.json');
}

function isLicenseActivated() {
  try {
    const data = JSON.parse(fs.readFileSync(getLicensePath(), 'utf8'));
    return data.activated === true && validateLicenseKey(data.key || '');
  } catch {
    return false;
  }
}

function saveLicense(key) {
  fs.writeFileSync(getLicensePath(), JSON.stringify({
    activated: true,
    key: key.toUpperCase().replace(/[^A-Z0-9]/g, ''),
    activatedAt: new Date().toISOString()
  }));
}

// Keep a global reference of the window object
let mainWindow;
let licenseWindow;

function createLicenseWindow() {
  licenseWindow = new BrowserWindow({
    width: 560,
    height: 600,
    resizable: false,
    center: true,
    titleBarStyle: 'default',
    title: 'Clarifactu – Activación',
    icon: path.join(__dirname, 'assets', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'src', 'license-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    },
    show: false
  });

  licenseWindow.loadFile(path.join(__dirname, 'src', 'license.html'));
  licenseWindow.setMenuBarVisibility(false);
  licenseWindow.once('ready-to-show', () => licenseWindow.show());
  licenseWindow.on('closed', () => { licenseWindow = null; });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    icon: path.join(__dirname, 'assets', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      backgroundThrottling: !HIDE_WINDOW
    },
    titleBarStyle: 'default',
    show: false
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'renderer', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    if (!HIDE_WINDOW) mainWindow.show();

    // Check for updates after window is visible (only in packaged app)
    if (app.isPackaged && autoUpdater) {
      setTimeout(() => autoUpdater.checkForUpdates(), 3000);
    }
  });

  // Open DevTools in dev mode
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  app.setAppUserModelId('com.clarifactu.app');

  // Initialize database
  const db = require('./src/database/db');
  db.initialize(app.getPath('userData'));

  if (isLicenseActivated()) {
    createWindow();
    scheduleAutoBackup();
  } else {
    createLicenseWindow();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      if (isLicenseActivated()) createWindow();
      else createLicenseWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// ─── IPC Handlers ────────────────────────────────────────────────────────────

const db = require('./src/database/db');

// Clients
ipcMain.handle('clients:getAll', () => db.clients.getAll());
ipcMain.handle('clients:getById', (e, id) => db.clients.getById(id));
ipcMain.handle('clients:create', (e, data) => db.clients.create(data));
ipcMain.handle('clients:update', (e, id, data) => db.clients.update(id, data));
ipcMain.handle('clients:delete', (e, id) => db.clients.delete(id));
ipcMain.handle('clients:search', (e, query) => db.clients.search(query));
ipcMain.handle('clients:getAllTags', () => db.clients.getAllTags());
ipcMain.handle('clients:getByTag', (e, tag) => db.clients.getByTag(tag));

// Client import: pick a file and get a preview; nothing is saved until importCommit
ipcMain.handle('clients:importPreview', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Importar clientes',
    filters: [{ name: 'Hoja de cálculo', extensions: ['csv', 'xlsx', 'txt'] }],
    properties: ['openFile']
  });
  if (result.canceled || !result.filePaths.length) return { success: false, reason: 'cancelled' };
  try {
    const importer = require('./src/import-clients');
    const file = result.filePaths[0];
    const { columns, clients } = importer.mapRows(importer.readClientFile(file, fs.readFileSync(file)));
    return { success: true, file: path.basename(file), columns, ...importer.planImport(clients, db.clients.getAll()) };
  } catch (err) {
    return { success: false, error: err.message };
  }
});
ipcMain.handle('clients:importCommit', (e, list) => {
  // Re-check against the current clients in case something changed since the preview
  const { toCreate, skipped } = require('./src/import-clients').planImport(list, db.clients.getAll());
  return { success: true, created: db.clients.bulkCreate(toCreate), skipped: skipped.length };
});

// Services
ipcMain.handle('services:getAll', () => db.services.getAll());
ipcMain.handle('services:getById', (e, id) => db.services.getById(id));
ipcMain.handle('services:create', (e, data) => db.services.create(data));
ipcMain.handle('services:update', (e, id, data) => db.services.update(id, data));
ipcMain.handle('services:delete', (e, id) => db.services.delete(id));
ipcMain.handle('services:search', (e, query) => db.services.search(query));

// Invoices
ipcMain.handle('invoices:getAll', () => db.invoices.getAll());
ipcMain.handle('invoices:getById', (e, id) => db.invoices.getById(id));
ipcMain.handle('invoices:create', (e, data) => db.invoices.create(data));
ipcMain.handle('invoices:update', (e, id, data) => db.invoices.update(id, data));
ipcMain.handle('invoices:delete', (e, id) => db.invoices.delete(id));
ipcMain.handle('invoices:checkRenumber', (e, id, newNumber) => db.invoices.checkRenumber(id, newNumber));
ipcMain.handle('invoices:renumber', (e, id, newNumber) => db.invoices.renumber(id, newNumber));
ipcMain.handle('invoices:getNumberingGaps', () => db.invoices.getNumberingGaps());
ipcMain.handle('invoices:search', (e, query) => db.invoices.search(query));
ipcMain.handle('invoices:getByYear', (e, year) => db.invoices.getByYear(year));
ipcMain.handle('invoices:markEmailSent', (e, id) => { db.invoices.markEmailSent(id); return { success: true }; });
ipcMain.handle('invoices:markReminderSent', (e, id) => { db.invoices.markReminderSent(id); return { success: true }; });
ipcMain.handle('invoices:markAsPaid', (e, id, date) => { db.invoices.markAsPaid(id, date); return { success: true }; });
ipcMain.handle('invoices:markAsPending', (e, id) => { db.invoices.markAsPending(id); return { success: true }; });
ipcMain.handle('invoices:getByClient', (e, clientId) => db.invoices.getByClient(clientId));
ipcMain.handle('invoices:getOverdue', (e, days) => db.invoices.getOverdue(days));
ipcMain.handle('invoices:getByRectifiedId', (e, id) => db.invoices.getByRectifiedId(id));

const MONTH_NAMES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
// File name and title parts for an exported period: 2026 + '03' → "-2026-03" / "marzo 2026"
const periodSuffix = (year, period) => [year, period].filter(Boolean).map(v => '-' + v).join('');
const periodLabel = (year, period) => [
  period ? (period.startsWith('T') ? `${period.slice(1)}.º trimestre` : MONTH_NAMES[Number(period) - 1]) : '',
  year || ''
].filter(Boolean).join(' ');

ipcMain.handle('invoices:exportCSV', async (e, year, period = '') => {
  const list = db.invoices.getByPeriod(year, period);
  const header = 'Número,Fecha,Cliente,Base imponible,IVA %,Cuota IVA,IRPF %,Cuota IRPF,Total,Estado cobro,Fecha cobro';
  const rows = list.map(inv => [
    inv.invoice_number,
    inv.date,
    inv.client_name || '',
    (inv.subtotal || 0).toFixed(2),
    (inv.tax_rate || 0).toFixed(2),
    (inv.tax_amount || 0).toFixed(2),
    (inv.irpf_rate || 0).toFixed(2),
    (inv.irpf_amount || 0).toFixed(2),
    (inv.total || 0).toFixed(2),
    inv.payment_status || 'pendiente',
    inv.payment_date || ''
  ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));

  const csv = [header, ...rows].join('\r\n');
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Exportar facturas a CSV',
    defaultPath: `facturas${periodSuffix(year, period)}.csv`,
    filters: [{ name: 'CSV (Excel)', extensions: ['csv'] }]
  });
  if (result.canceled) return { success: false };
  fs.writeFileSync(result.filePath, '\uFEFF' + csv, 'utf8');
  shell.showItemInFolder(result.filePath);
  return { success: true };
});

ipcMain.handle('invoices:exportExcel', async (e, year, period = '') => {
  const list = db.invoices.getByPeriod(year, period);
  const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const headers = ['Número','Fecha','Cliente','Base imponible','IVA %','Cuota IVA','IRPF %','Cuota IRPF','Total','Estado cobro','Fecha cobro'];
  const headerRow = headers.map(h => `<Cell><Data ss:Type="String">${esc(h)}</Data></Cell>`).join('');
  const dataRows = list.map(inv => {
    const vals = [
      inv.invoice_number, inv.date, inv.client_name || '',
      (inv.subtotal||0).toFixed(2), (inv.tax_rate||0).toFixed(2), (inv.tax_amount||0).toFixed(2),
      (inv.irpf_rate||0).toFixed(2), (inv.irpf_amount||0).toFixed(2), (inv.total||0).toFixed(2),
      inv.payment_status || 'pendiente', inv.payment_date || ''
    ];
    return `<Row>${vals.map(v => `<Cell><Data ss:Type="String">${esc(v)}</Data></Cell>`).join('')}</Row>`;
  }).join('');
  const xml = `<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Facturas"><Table><Row>${headerRow}</Row>${dataRows}</Table></Worksheet></Workbook>`;
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Exportar facturas a Excel',
    defaultPath: `facturas${periodSuffix(year, period)}.xls`,
    filters: [{ name: 'Excel', extensions: ['xls'] }]
  });
  if (result.canceled) return { success: false };
  fs.writeFileSync(result.filePath, xml, 'utf8');
  shell.showItemInFolder(result.filePath);
  return { success: true };
});

ipcMain.handle('invoices:exportPDFSummary', async (e, year, period = '') => {
  const list = db.invoices.getByPeriod(year, period);
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Exportar listado de facturas a PDF',
    defaultPath: `facturas${periodSuffix(year, period)}.pdf`,
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  });
  if (result.canceled) return { success: false, reason: 'cancelled' };
  const esc = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const rows = list.map(inv => `<tr>
    <td>${esc(inv.invoice_number)}</td><td>${esc(inv.date)}</td><td>${esc(inv.client_name||'')}</td>
    <td style="text-align:right">${parseFloat(inv.total||0).toLocaleString('es-ES',{minimumFractionDigits:2})} €</td>
    <td style="text-align:center">${esc(inv.payment_status||'pendiente')}</td>
    <td>${esc(inv.payment_date||'')}</td>
  </tr>`).join('');
  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>
    body{font-family:-apple-system,'Segoe UI',Arial,sans-serif;font-size:12px;color:#1e293b;padding:40px 48px;}
    h1{font-size:18px;margin:0 0 4px 0;}p{margin:0 0 20px 0;font-size:12px;color:#64748b;}
    table{width:100%;border-collapse:collapse;}
    th{background:#f1f5f9;padding:8px 10px;text-align:left;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;border-bottom:2px solid #e2e8f0;}
    td{padding:7px 10px;border-bottom:1px solid #f1f5f9;font-size:12px;}
    tr:nth-child(even) td{background:#fafafa;}
  </style></head><body>
    <h1>Listado de facturas${periodLabel(year, period) ? ' — ' + periodLabel(year, period) : ''}</h1>
    <p>Generado el ${new Date().toLocaleDateString('es-ES',{year:'numeric',month:'long',day:'numeric'})}</p>
    <table><thead><tr><th>Número</th><th>Fecha</th><th>Cliente</th><th style="text-align:right">Total</th><th style="text-align:center">Estado</th><th>Fecha cobro</th></tr></thead>
    <tbody>${rows}</tbody></table>
  </body></html>`;
  const pdfWin = new BrowserWindow({ width:1000, height:1400, show:false, webPreferences:{ nodeIntegration:false, contextIsolation:true, sandbox:false } });
  await pdfWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  await new Promise(r => setTimeout(r, 600));
  try {
    const buf = await pdfWin.webContents.printToPDF({ pageSize:'A4', printBackground:true, margins:{top:0,bottom:0,left:0,right:0} });
    fs.writeFileSync(result.filePath, buf);
    pdfWin.close();
    shell.openPath(result.filePath);
    return { success: true };
  } catch (err) { pdfWin.close(); return { success: false, reason: err.message }; }
});

ipcMain.handle('dashboard:exportFiscalExcel', async (e, year) => {
  const quarters = db.dashboard.getFiscalSummary(year);
  const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const headers = ['Trimestre','Base imponible','IVA repercutido','IRPF retenido','Nº facturas'];
  const headerRow = headers.map(h => `<Cell><Data ss:Type="String">${esc(h)}</Data></Cell>`).join('');
  const dataRows = quarters.map(q => {
    const vals = [`T${q.quarter}`, (q.base||0).toFixed(2), (q.iva||0).toFixed(2), (q.irpf||0).toFixed(2), q.count||0];
    return `<Row>${vals.map(v => `<Cell><Data ss:Type="String">${esc(v)}</Data></Cell>`).join('')}</Row>`;
  }).join('');
  const xml = `<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Ingresos por trimestre"><Table><Row>${headerRow}</Row>${dataRows}</Table></Worksheet></Workbook>`;
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Exportar resumen fiscal a Excel',
    defaultPath: `resumen-ingresos-${year}.xls`,
    filters: [{ name: 'Excel', extensions: ['xls'] }]
  });
  if (result.canceled) return { success: false };
  fs.writeFileSync(result.filePath, xml, 'utf8');
  shell.showItemInFolder(result.filePath);
  return { success: true };
});

ipcMain.handle('dashboard:exportFiscalPDF', async (e, year) => {
  const quarters = db.dashboard.getFiscalSummary(year);
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Exportar resumen fiscal a PDF',
    defaultPath: `resumen-ingresos-${year}.pdf`,
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  });
  if (result.canceled) return { success: false, reason: 'cancelled' };
  const fmt = n => parseFloat(n||0).toLocaleString('es-ES',{minimumFractionDigits:2});
  const rows = quarters.map(q => `<tr>
    <td style="text-align:center;font-weight:600">T${q.quarter}</td>
    <td style="text-align:right">${fmt(q.base)} €</td>
    <td style="text-align:right">${fmt(q.iva)} €</td>
    <td style="text-align:right">${fmt(q.irpf)} €</td>
    <td style="text-align:center">${q.count||0}</td>
  </tr>`).join('');
  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>
    body{font-family:-apple-system,'Segoe UI',Arial,sans-serif;font-size:13px;color:#1e293b;padding:48px 56px;}
    h1{font-size:20px;margin:0 0 4px 0;}p{margin:0 0 24px 0;font-size:12px;color:#64748b;}
    table{width:100%;border-collapse:collapse;}
    th{background:#f1f5f9;padding:10px 14px;text-align:left;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;border-bottom:2px solid #e2e8f0;}
    td{padding:10px 14px;border-bottom:1px solid #f1f5f9;}
    tr:nth-child(even) td{background:#fafafa;}
  </style></head><body>
    <h1>Resumen de ingresos por trimestre / ${year}</h1>
    <p>Generado el ${new Date().toLocaleDateString('es-ES',{year:'numeric',month:'long',day:'numeric'})}</p>
    <table><thead><tr><th>Trimestre</th><th style="text-align:right">Base imponible</th><th style="text-align:right">IVA repercutido</th><th style="text-align:right">IRPF retenido</th><th style="text-align:center">Nº facturas</th></tr></thead>
    <tbody>${rows}</tbody></table>
  </body></html>`;
  const pdfWin = new BrowserWindow({ width:900, height:800, show:false, webPreferences:{ nodeIntegration:false, contextIsolation:true, sandbox:false } });
  await pdfWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  await new Promise(r => setTimeout(r, 600));
  try {
    const buf = await pdfWin.webContents.printToPDF({ pageSize:'A4', printBackground:true, margins:{top:0,bottom:0,left:0,right:0} });
    fs.writeFileSync(result.filePath, buf);
    pdfWin.close();
    shell.openPath(result.filePath);
    return { success: true };
  } catch (err) { pdfWin.close(); return { success: false, reason: err.message }; }
});

// ─── Expenses ─────────────────────────────────────────────────────────────────
ipcMain.handle('expenses:getAll', () => db.expenses.getAll());
ipcMain.handle('expenses:getById', (e, id) => db.expenses.getById(id));
ipcMain.handle('expenses:create', (e, data) => db.expenses.create(data));
ipcMain.handle('expenses:update', (e, id, data) => db.expenses.update(id, data));
ipcMain.handle('expenses:delete', (e, id) => db.expenses.delete(id));
ipcMain.handle('expenses:getByYear', (e, year) => db.expenses.getByYear(year));
ipcMain.handle('expenses:getSummaryByYear', (e, year) => db.expenses.getSummaryByYear(year));

ipcMain.handle('expenses:selectDoc', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Seleccionar factura del proveedor',
    properties: ['openFile'],
    filters: [{ name: 'Documentos', extensions: ['pdf', 'jpg', 'jpeg', 'png'] }]
  });
  if (result.canceled || !result.filePaths.length) return null;
  const srcPath = result.filePaths[0];
  const ext = path.extname(srcPath);
  const fileName = `gasto-${Date.now()}${ext}`;
  const destDir = path.join(app.getPath('userData'), 'expense-docs');
  if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
  fs.copyFileSync(srcPath, path.join(destDir, fileName));
  return fileName;
});

ipcMain.handle('expenses:openDoc', (e, fileName) => {
  shell.openPath(path.join(app.getPath('userData'), 'expense-docs', fileName));
});

ipcMain.handle('expenses:deleteDoc', (e, fileName) => {
  try {
    const filePath = path.join(app.getPath('userData'), 'expense-docs', fileName);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (_) {}
  return { success: true };
});

const CATEGORY_LABELS = {
  ARRENDAMIENTOS:'Arrendamientos y cánones', SUMINISTROS:'Suministros',
  MATERIAL_OFICINA:'Consumos de explotación', SERVICIOS_PROF:'Servicios de profesionales independientes',
  SEGUROS:'Otros servicios exteriores (Seguros)', PUBLICIDAD:'Publicidad y relaciones públicas',
  FORMACION:'Otros gastos deducibles (Formación)', SEG_SOCIAL:'Seguridad Social a cargo del empresario',
  REPARACIONES:'Reparaciones y conservación', GASTOS_FINANCIEROS:'Gastos financieros',
  AMORTIZACIONES:'Amortizaciones', TRIBUTOS:'Tributos fiscalmente deducibles', OTROS:'Otros gastos deducibles'
};

const { workbook } = require('./src/spreadsheet');

async function saveSpreadsheet(title, defaultName, xml) {
  const result = await dialog.showSaveDialog(mainWindow, {
    title, defaultPath: defaultName, filters: [{ name: 'Excel', extensions: ['xls'] }]
  });
  if (result.canceled || !result.filePath) return { success: false, reason: 'cancelled' };
  fs.writeFileSync(result.filePath, xml, 'utf8');
  shell.showItemInFolder(result.filePath);
  return { success: true };
}

const sum = (rows, f) => rows.reduce((s, r) => s + (Number(r[f]) || 0), 0);

// Libros registro de ingresos y gastos (IRPF, estimación directa)
function buildLibrosRegistro(year) {
  const { ingresos, gastos } = db.fiscal.getLibroRegistro(year);
  const S = 'String', N = 'Number';
  return workbook([
    {
      name: 'Ingresos',
      columns: [
        { header: 'Fecha expedición', type: S }, { header: 'Serie y número', type: S }, { header: 'Tipo', type: S },
        { header: 'Factura rectificada', type: S }, { header: 'NIF destinatario', type: S }, { header: 'Nombre destinatario', type: S },
        { header: 'Concepto', type: S }, { header: 'Base imponible', type: N }, { header: 'Tipo IVA %', type: N },
        { header: 'Cuota IVA', type: N }, { header: 'Tipo retención %', type: N }, { header: 'Retención IRPF', type: N },
        { header: 'Total factura', type: N }, { header: 'Cobro', type: S }, { header: 'Fecha cobro', type: S }
      ],
      rows: ingresos.map(r => [
        vfDate(r.date), r.invoice_number, r.tipo_factura === 'R1' ? 'Rectificativa' : 'Ordinaria', r.rect_invoice_number || '',
        r.client_nif || '', r.client_name || '', r.concept || '', r.subtotal, r.tax_rate, r.tax_amount, r.irpf_rate, r.irpf_amount,
        r.total, r.payment_status === 'pagada' ? 'Cobrada' : 'Pendiente', r.payment_date ? vfDate(r.payment_date) : ''
      ]),
      totals: ['TOTAL', '', '', '', '', '', '', sum(ingresos, 'subtotal'), '', sum(ingresos, 'tax_amount'), '', sum(ingresos, 'irpf_amount'), sum(ingresos, 'total'), '', ''],
      notes: [`Libro registro de ventas e ingresos · Ejercicio ${year} · Generado por Clarifactu`]
    },
    {
      name: 'Gastos',
      columns: [
        { header: 'Fecha', type: S }, { header: 'Nº factura proveedor', type: S }, { header: 'NIF proveedor', type: S },
        { header: 'Nombre proveedor', type: S }, { header: 'Concepto', type: S }, { header: 'Categoría', type: S },
        { header: 'Base imponible', type: N }, { header: 'Tipo IVA %', type: N }, { header: 'Cuota IVA', type: N },
        { header: 'Total', type: N }, { header: '% deducible', type: N }, { header: 'Gasto deducible', type: N }
      ],
      rows: gastos.map(r => [
        vfDate(r.date), r.invoice_number || '', r.provider_nif || '', r.provider || '', r.description || '',
        CATEGORY_LABELS[r.category] || r.category, r.amount, r.iva_rate, r.iva_amount, r.total, r.deductible_pct, r.deductible_amount
      ]),
      totals: ['TOTAL', '', '', '', '', '', sum(gastos, 'amount'), '', sum(gastos, 'iva_amount'), sum(gastos, 'total'), '', sum(gastos, 'deductible_amount')],
      notes: [`Libro registro de compras y gastos · Ejercicio ${year} · Generado por Clarifactu`]
    }
  ]);
}

function build347(year) {
  const m = db.fiscal.get347(year);
  const S = 'String', N = 'Number';
  const columns = [
    { header: 'NIF', type: S }, { header: 'Nombre', type: S }, { header: 'Importe anual', type: N },
    { header: '1T', type: N }, { header: '2T', type: N }, { header: '3T', type: N }, { header: '4T', type: N }, { header: 'Aviso', type: S }
  ];
  const row = (g, extra = '') => [g.nif, g.name, g.total, g.q1, g.q2, g.q3, g.q4, [g.nif ? '' : 'Falta el NIF', extra].filter(Boolean).join(' · ')];
  return workbook([
    {
      name: 'Clientes (ventas)', columns,
      rows: m.clientes.map(g => row(g)),
      notes: [`Modelo 347 · Ejercicio ${year} · Clave B (ventas) · Importes con IVA, más de ${m.threshold.toFixed(2).replace('.', ',')} €`,
        `No incluye ${m.excluded.invoicesWithWithholding} factura(s) con retención de IRPF (se declaran en el modelo 190).`]
    },
    {
      name: 'Proveedores (compras)', columns,
      rows: m.proveedores.map(g => row(g, g.rent ? 'Incluye alquiler: si le practicas retención, no va en el 347' : '')),
      notes: [`Modelo 347 · Ejercicio ${year} · Clave A (compras) · Importes con IVA, más de ${m.threshold.toFixed(2).replace('.', ',')} €`,
        `No incluye cuotas de Seguridad Social ni tributos (${m.excluded.expensesNotThirdParty} gasto(s)).`]
    }
  ]);
}

ipcMain.handle('dashboard:get347', (e, year) => db.fiscal.get347(year));
ipcMain.handle('dashboard:getModelo130', (e, year) => db.fiscal.getModelo130(year));
ipcMain.handle('dashboard:exportLibros', (e, year) =>
  saveSpreadsheet('Exportar libros registro', `libros-registro-${year}.xls`, buildLibrosRegistro(year)));
ipcMain.handle('dashboard:export347', (e, year) =>
  saveSpreadsheet('Exportar modelo 347', `modelo-347-${year}.xls`, build347(year)));

ipcMain.handle('dashboard:exportModelos', async (e, year) => {
  const quarters = db.dashboard.getFiscalSummary(year);
  const expSummary = db.expenses.getSummaryByYear(year);
  const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const N = v => parseFloat(v || 0).toFixed(2);

  // Modelo 130 sheet: official casillas, cumulative from 1 January (src/modelo130.js)
  const m130 = db.fiscal.getModelo130(year);
  const m130Cols = [['01 Ingresos (acum.)','c01'],['02 Gastos deducibles (acum.)','c02'],['03 Rendimiento neto','c03'],
    ['04 20% s/ 03','c04'],['05 Pagos trimestres anteriores','c05'],['06 Retenciones (acum.)','c06'],['07 Pago fraccionado previo','c07'],
    ['12','c12'],['13 Minoración','c13'],['14','c14'],['15 Negativos anteriores','c15'],['17','c17'],['19 Resultado','c19']];
  const m130HRow = ['Trimestre', ...m130Cols.map(c => c[0])].map(h => `<Cell ss:StyleID="header"><Data ss:Type="String">${esc(h)}</Data></Cell>`).join('');
  const m130Rows = m130.rows.map(r =>
    `<Row><Cell><Data ss:Type="String">${esc(r.label)}</Data></Cell>${m130Cols.map(([, k]) => `<Cell><Data ss:Type="Number">${N(r[k])}</Data></Cell>`).join('')}</Row>`
  ).join('');
  const m130Total = `<Row><Cell><Data ss:Type="String">TOTAL A INGRESAR ${year}</Data></Cell>${m130Cols.map(([, k]) => k === 'c19'
    ? `<Cell><Data ss:Type="Number">${N(m130.rows.reduce((s, r) => s + r.aIngresar, 0))}</Data></Cell>`
    : '<Cell><Data ss:Type="String"></Data></Cell>').join('')}</Row>`;

  // Modelo 303 sheet
  const m303Headers = ['Trimestre','IVA repercutido (facturas)','IVA soportado deducible (gastos)','Resultado IVA'];
  const m303HRow = m303Headers.map(h => `<Cell ss:StyleID="header"><Data ss:Type="String">${esc(h)}</Data></Cell>`).join('');
  const m303Rows = quarters.map(q => {
    const rep = q.iva || 0;
    const sop = q.gastos_iva || 0;
    const res = rep - sop;
    return `<Row><Cell><Data ss:Type="String">${esc(q.label)}</Data></Cell>${[rep,sop,res].map(v=>`<Cell><Data ss:Type="Number">${N(v)}</Data></Cell>`).join('')}</Row>`;
  }).join('');
  const m303TotalRep = quarters.reduce((s,q)=>s+(q.iva||0),0);
  const m303TotalSop = quarters.reduce((s,q)=>s+(q.gastos_iva||0),0);
  const m303Total = `<Row><Cell><Data ss:Type="String">TOTAL ${year}</Data></Cell>${[m303TotalRep,m303TotalSop,m303TotalRep-m303TotalSop].map(v=>`<Cell><Data ss:Type="Number">${N(v)}</Data></Cell>`).join('')}</Row>`;

  // Renta (gastos por categoría) sheet
  const rentaHeaders = ['Categoría (Renta)','Clave','Nº gastos','Base imponible','IVA soportado','Importe deducible'];
  const rentaHRow = rentaHeaders.map(h => `<Cell ss:StyleID="header"><Data ss:Type="String">${esc(h)}</Data></Cell>`).join('');
  const rentaRows = expSummary.map(r => {
    const label = CATEGORY_LABELS[r.category] || r.category;
    return `<Row><Cell><Data ss:Type="String">${esc(label)}</Data></Cell><Cell><Data ss:Type="String">${esc(r.category)}</Data></Cell><Cell><Data ss:Type="Number">${r.count}</Data></Cell>${[r.total_base,r.total_iva,r.total_deducible].map(v=>`<Cell><Data ss:Type="Number">${N(v)}</Data></Cell>`).join('')}</Row>`;
  }).join('');
  const rentaTotalBase = expSummary.reduce((s,r)=>s+(r.total_base||0),0);
  const rentaTotalIva = expSummary.reduce((s,r)=>s+(r.total_iva||0),0);
  const rentaTotalDed = expSummary.reduce((s,r)=>s+(r.total_deducible||0),0);
  const rentaTotal = `<Row><Cell><Data ss:Type="String">TOTAL</Data></Cell><Cell><Data ss:Type="String"></Data></Cell><Cell><Data ss:Type="Number">${expSummary.reduce((s,r)=>s+r.count,0)}</Data></Cell>${[rentaTotalBase,rentaTotalIva,rentaTotalDed].map(v=>`<Cell><Data ss:Type="Number">${N(v)}</Data></Cell>`).join('')}</Row>`;

  const styles = `<Styles><Style ss:ID="header"><Font ss:Bold="1"/><Interior ss:Color="#EFF6FF" ss:Pattern="Solid"/></Style></Styles>`;
  const xml = `<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">${styles}<Worksheet ss:Name="Modelo 130"><Table><Row>${m130HRow}</Row>${m130Rows}${m130Total}</Table></Worksheet><Worksheet ss:Name="Modelo 303"><Table><Row>${m303HRow}</Row>${m303Rows}${m303Total}</Table></Worksheet><Worksheet ss:Name="Renta - Gastos por categoría"><Table><Row>${rentaHRow}</Row>${rentaRows}${rentaTotal}</Table></Worksheet></Workbook>`;

  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Exportar modelos fiscales',
    defaultPath: `modelos-fiscales-${year}.xls`,
    filters: [{ name: 'Excel', extensions: ['xls'] }]
  });
  if (result.canceled) return { success: false };
  fs.writeFileSync(result.filePath, xml, 'utf8');
  shell.showItemInFolder(result.filePath);
  return { success: true };
});

// Activity Log
ipcMain.handle('activityLog:add', (e, data) => { db.activityLog.add(data); return { success: true }; });
ipcMain.handle('activityLog:getRecent', (e, limit) => db.activityLog.getRecent(limit));

// Documents
ipcMain.handle('documents:getAll', () => db.documents.getAll());
ipcMain.handle('documents:getById', (e, id) => db.documents.getById(id));
ipcMain.handle('documents:create', (e, data) => db.documents.create(data));
ipcMain.handle('documents:update', (e, id, data) => db.documents.update(id, data));
ipcMain.handle('documents:delete', (e, id) => db.documents.delete(id));
ipcMain.handle('documents:search', (e, query) => db.documents.search(query));
ipcMain.handle('documents:markEmailSent', (e, id) => { db.documents.markEmailSent(id); return { success: true }; });

ipcMain.handle('documents:sendEmail', async (e, { htmlContent, title, toEmail, toName, subject, body }) => {
  const nodemailer = require('nodemailer');
  const cfg = db.emailSettings.get();

  if (!cfg.gmail_user || !cfg.gmail_app_password) {
    return { success: false, error: 'Configura Gmail en Configuración antes de enviar' };
  }

  const pdfWin = new BrowserWindow({
    width: 900, height: 1200, show: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: false }
  });

  try {
    await pdfWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);
    await new Promise(r => setTimeout(r, 800));
    const pdfBuffer = await pdfWin.webContents.printToPDF({
      pageSize: 'A4', printBackground: true,
      margins: { top: 0, bottom: 0, left: 0, right: 0 }
    });
    pdfWin.close();

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: cfg.gmail_user, pass: cfg.gmail_app_password }
    });

    const safeName = title.replace(/[^a-zA-Z0-9\-_áéíóúÁÉÍÓÚñÑ ]/g, '').trim() || 'documento';
    await transporter.sendMail({
      from: `"${cfg.gmail_user}" <${cfg.gmail_user}>`,
      to: `"${toName}" <${toEmail}>`,
      subject,
      text: body,
      attachments: [{ filename: `${safeName}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }]
    });

    return { success: true };
  } catch (err) {
    try { pdfWin.close(); } catch (_) {}
    return { success: false, error: err.message };
  }
});

ipcMain.handle('documents:exportPDF', async (e, { htmlContent, title }) => {
  const safeName = (title || 'documento').replace(/[^a-zA-Z0-9\-_áéíóúÁÉÍÓÚñÑ ]/g, '').trim() || 'documento';
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Guardar documento PDF',
    defaultPath: `${safeName}.pdf`,
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  });

  if (result.canceled || !result.filePath) return { success: false, reason: 'cancelled' };

  const pdfWindow = new BrowserWindow({
    width: 900, height: 1200, show: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: false }
  });

  await pdfWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);
  await new Promise(resolve => setTimeout(resolve, 800));

  try {
    const pdfBuffer = await pdfWindow.webContents.printToPDF({
      pageSize: 'A4', printBackground: true,
      margins: { top: 0, bottom: 0, left: 0, right: 0 }
    });
    fs.writeFileSync(result.filePath, pdfBuffer);
    pdfWindow.close();
    shell.openPath(result.filePath);
    return { success: true, path: result.filePath };
  } catch (err) {
    pdfWindow.close();
    return { success: false, reason: err.message };
  }
});

// Invoice Items
ipcMain.handle('invoiceItems:getByInvoice', (e, invoiceId) => db.invoiceItems.getByInvoice(invoiceId));

// Settings
ipcMain.handle('settings:getBusiness', () => db.settings.getBusiness());
ipcMain.handle('settings:saveBusiness', (e, data) => db.settings.saveBusiness(data));
ipcMain.handle('settings:getNumberSettings', () => db.settings.getNumberSettings());
ipcMain.handle('settings:saveNumberSettings', (e, data) => db.settings.saveNumberSettings(data));
ipcMain.handle('settings:resetCounter', () => db.settings.resetCounter());
ipcMain.handle('settings:saveIvaExemption', (e, data) => db.settings.saveIvaExemption(data));
ipcMain.handle('settings:saveAppearance', (e, data) => db.settings.saveAppearance(data));
ipcMain.handle('settings:isOnboardingDone', () => db.settings.isOnboardingDone());
ipcMain.handle('settings:markOnboardingDone', () => { db.settings.markOnboardingDone(); return true; });

// Generate Invoice Number
ipcMain.handle('generateInvoiceNumber', () => {
  const year = new Date().getFullYear();
  const settings = db.settings.ensureCurrentYear(year); // resets both series on a new year

  const newCounter = settings.counter + 1;
  const paddedNumber = String(newCounter).padStart(settings.digits, '0');

  let invoiceNumber;
  if (settings.show_year) {
    invoiceNumber = `${settings.prefix}${settings.separator}${year}${settings.separator}${paddedNumber}`;
  } else {
    invoiceNumber = `${settings.prefix}${settings.separator}${paddedNumber}`;
  }

  return { invoiceNumber, newCounter };
});

// Commit invoice number (called after successfully saving invoice)
ipcMain.handle('commitInvoiceNumber', (e, counter) => {
  db.settings.updateCounter(counter);
  return true;
});

ipcMain.handle('generateRectificativaNumber', () => db.settings.generateRectificativaNumber());
ipcMain.handle('commitRectificativaNumber', (e, counter) => { db.settings.commitRectificativaNumber(counter); return true; });

// ─── Auto-updater IPC ─────────────────────────────────────────────────────────
if (autoUpdater) {
  autoUpdater.on('update-available', (info) => {
    if (mainWindow) mainWindow.webContents.send('update:available', { version: info.version });
  });
  autoUpdater.on('download-progress', (progress) => {
    if (mainWindow) mainWindow.webContents.send('update:download-progress', { percent: Math.round(progress.percent) });
  });
  autoUpdater.on('update-downloaded', (info) => {
    if (mainWindow) mainWindow.webContents.send('update:downloaded', { version: info.version });
  });
  autoUpdater.on('error', (err) => {
    if (mainWindow) mainWindow.webContents.send('update:error', { message: err.message });
  });
}
ipcMain.handle('update:checkNow', () => { if (autoUpdater) autoUpdater.checkForUpdates(); return { checking: true }; });
ipcMain.handle('update:installNow', () => { if (autoUpdater) autoUpdater.quitAndInstall(false, true); });

// Select Signature image (same as logo but different dialog title)
ipcMain.handle('selectSignature', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Seleccionar imagen de firma',
    filters: [{ name: 'Imágenes', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] }],
    properties: ['openFile']
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  const filePath = result.filePaths[0];
  const fileBuffer = fs.readFileSync(filePath);
  const ext = path.extname(filePath).slice(1).toLowerCase();
  const base64 = `data:image/${ext};base64,${fileBuffer.toString('base64')}`;
  return base64;
});

// Select Logo
ipcMain.handle('selectLogo', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Seleccionar logo',
    filters: [
      { name: 'Imágenes', extensions: ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'] }
    ],
    properties: ['openFile']
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  const filePath = result.filePaths[0];
  const fileBuffer = fs.readFileSync(filePath);
  const ext = path.extname(filePath).slice(1).toLowerCase();
  const mimeType = ext === 'svg' ? 'image/svg+xml' : `image/${ext}`;
  const base64 = `data:${mimeType};base64,${fileBuffer.toString('base64')}`;
  return base64;
});

// App icon as data URL (reliable in packaged apps)
ipcMain.handle('app:getIconDataUrl', () => {
  try {
    const data = fs.readFileSync(path.join(__dirname, 'assets', 'icon.png'));
    return 'data:image/png;base64,' + data.toString('base64');
  } catch { return null; }
});

// App info
ipcMain.handle('app:getInfo', () => {
  let license = null;
  try {
    const data = JSON.parse(fs.readFileSync(getLicensePath(), 'utf8'));
    if (data.activated && validateLicenseKey(data.key || '')) {
      const raw = data.key.toUpperCase().replace(/[^A-Z0-9]/g, '');
      const fmt = `${raw.slice(0,5)}-${raw.slice(5,10)}-${raw.slice(10,15)}-${raw.slice(15,20)}-${raw.slice(20)}`;
      license = { key: fmt, activatedAt: data.activatedAt };
    }
  } catch {}
  return {
    version: app.getVersion(),
    electron: process.versions.electron,
    license
  };
});

// License activation
ipcMain.handle('license:activate', async (e, key) => {
  if (!validateLicenseKey(key)) {
    return { success: false, error: 'Clave de licencia no válida. Comprueba que la has introducido correctamente.' };
  }
  try {
    saveLicense(key);
    // If coming from license window, open main app
    if (licenseWindow) {
      setTimeout(() => {
        if (licenseWindow) licenseWindow.close();
        createWindow();
      }, 1500);
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: 'Error al guardar la licencia: ' + err.message };
  }
});

// Export PDF
ipcMain.handle('exportPDF', async (e, { htmlContent, invoiceNumber }) => {
  // Ask user where to save
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Guardar factura PDF',
    defaultPath: `${invoiceNumber}.pdf`,
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  });

  if (result.canceled || !result.filePath) {
    return { success: false, reason: 'cancelled' };
  }

  // Create hidden window to render the invoice
  const pdfWindow = new BrowserWindow({
    width: 900,
    height: 1200,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  });

  // Load the HTML content
  await pdfWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);

  // Wait a moment for rendering
  await new Promise(resolve => setTimeout(resolve, 800));

  try {
    const pdfBuffer = await pdfWindow.webContents.printToPDF({
      pageSize: 'A4',
      printBackground: true,
      margins: {
        top: 0,
        bottom: 0,
        left: 0,
        right: 0
      }
    });

    fs.writeFileSync(result.filePath, pdfBuffer);
    pdfWindow.close();

    // Open the PDF after saving
    shell.openPath(result.filePath);

    return { success: true, path: result.filePath };
  } catch (err) {
    pdfWindow.close();
    return { success: false, reason: err.message };
  }
});

// Export multiple PDFs as a single ZIP
ipcMain.handle('exportPDFZip', async (e, invoices) => {
  // invoices: [{ htmlContent, invoiceNumber }, ...]
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Guardar facturas como ZIP',
    defaultPath: `facturas_${new Date().toISOString().split('T')[0]}.zip`,
    filters: [{ name: 'ZIP', extensions: ['zip'] }]
  });

  if (result.canceled || !result.filePath) {
    return { success: false, reason: 'cancelled' };
  }

  const zip = new AdmZip();
  const errors = [];

  for (const inv of invoices) {
    const pdfWin = new BrowserWindow({
      width: 900, height: 1200, show: false,
      webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: false }
    });
    try {
      await pdfWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(inv.htmlContent)}`);
      await new Promise(r => setTimeout(r, 800));
      const pdfBuffer = await pdfWin.webContents.printToPDF({
        pageSize: 'A4', printBackground: true,
        margins: { top: 0, bottom: 0, left: 0, right: 0 }
      });
      zip.addFile(`${inv.invoiceNumber}.pdf`, pdfBuffer);
    } catch (err) {
      errors.push(inv.invoiceNumber);
    } finally {
      pdfWin.close();
    }
  }

  try {
    zip.writeZip(result.filePath);
    shell.openPath(path.dirname(result.filePath));
    return { success: true, path: result.filePath, errors };
  } catch (err) {
    return { success: false, reason: err.message };
  }
});

// Dashboard stats
ipcMain.handle('dashboard:getStats', () => db.dashboard.getStats());
ipcMain.handle('dashboard:getMonthlyData', (e, year) => db.dashboard.getMonthlyData(year));
ipcMain.handle('dashboard:getFiscalSummary', (e, year) => db.dashboard.getFiscalSummary(year));
ipcMain.handle('dashboard:getTopClients', (e, year) => db.dashboard.getTopClients(year));
ipcMain.handle('dashboard:getDocumentStats', () => db.dashboard.getDocumentStats());
ipcMain.handle('dashboard:getYearComparison', (e, year1, year2) => db.dashboard.getYearComparison(year1, year2));

// Document Templates
ipcMain.handle('documentTemplates:getAll', () => db.documentTemplates.getAll());
ipcMain.handle('documentTemplates:create', (e, data) => db.documentTemplates.create(data));
ipcMain.handle('documentTemplates:update', (e, id, data) => db.documentTemplates.update(id, data));
ipcMain.handle('documentTemplates:delete', (e, id) => db.documentTemplates.delete(id));

// ─── Verifactu ───────────────────────────────────────────────────────────────


const { vfNum, vfDate, vfTimestamp, calcHuella, buildVerifactuXML } = require('./src/verifactu');

ipcMain.handle('verifactu:getSettings', () => db.verifactu.getSettings());
ipcMain.handle('verifactu:saveSettings', (e, data) => db.verifactu.saveSettings(data));

ipcMain.handle('verifactu:processInvoice', (e, invoiceId) => {
  const prev = db.verifactu.prepareHash(invoiceId); // throws for registered records
  const invoice = db.invoices.getById(invoiceId);
  const business = db.settings.getBusiness();
  const fechaHoraGen = vfTimestamp();
  const prevHash = prev ? prev.huella : '';
  const huella = calcHuella(invoice, business, prevHash, fechaHoraGen);
  db.verifactu.updateInvoiceVerifactu(invoiceId, {
    huella, huella_anterior: prevHash, fecha_hora_gen: fechaHoraGen,
    verifactu_status: 'pendiente', verifactu_csv: null
  });
  return { huella, fechaHoraGen };
});

ipcMain.handle('verifactu:generateQR', async (e, invoiceId) => {
  let QRCode;
  try { QRCode = require('qrcode'); } catch (_) { return { success: false }; }
  const invoice = db.invoices.getById(invoiceId);
  const business = db.settings.getBusiness();
  if (!invoice || !business.nif) return { success: false };
  const url = `https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR?nif=${encodeURIComponent(business.nif)}&numserie=${encodeURIComponent(invoice.invoice_number)}&fecha=${encodeURIComponent(vfDate(invoice.date))}&importe=${encodeURIComponent(vfNum(invoice.total||0))}`;
  try {
    const dataUrl = await QRCode.toDataURL(url, { width: 120, margin: 1 });
    return { success: true, dataUrl, url };
  } catch (err) { return { success: false, error: err.message }; }
});

ipcMain.handle('verifactu:generateXML', (e, invoiceIds) => {
  const business = db.settings.getBusiness();
  const vfCfg = db.verifactu.getSettings();
  const invoices = db.verifactu.getRecordsForSubmission(invoiceIds); // chain order
  return { success: true, xml: buildVerifactuXML(invoices, business, vfCfg) };
});

ipcMain.handle('verifactu:saveXML', async (e, xml) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Guardar XML Verifactu',
    defaultPath: `verifactu-${new Date().toISOString().slice(0,10)}.xml`,
    filters: [{ name: 'XML', extensions: ['xml'] }]
  });
  if (result.canceled) return { success: false };
  fs.writeFileSync(result.filePath, xml, 'utf8');
  shell.openPath(path.dirname(result.filePath));
  return { success: true, path: result.filePath };
});

ipcMain.handle('verifactu:submit', async (e, invoiceIds) => {
  const vfCfg = db.verifactu.getSettings();
  // Route to DNIe (smart card) path if enabled
  if (vfCfg.use_dnie) {
    return submitViaDNIe(invoiceIds, vfCfg);
  }
  const https = require('https');
  const business = db.settings.getBusiness();
  const invoices = db.verifactu.getRecordsForSubmission(invoiceIds); // chain order
  if (invoices.some(inv => !inv.huella)) {
    return { success: false, error: 'Hay facturas sin huella calculada. Calcula las huellas primero.' };
  }
  const xml = buildVerifactuXML(invoices, business, vfCfg);
  const isTest = vfCfg.environment !== 'produccion';
  const hostname = isTest ? 'prewww1.aeat.es' : 'www1.aeat.es';
  const opts = {
    hostname, port: 443,
    path: '/wlpl/TIKE-CONT/ws/SistemaFacturacionVerifactu',
    method: 'POST',
    headers: { 'Content-Type': 'text/xml;charset=UTF-8', 'SOAPAction': '', 'Content-Length': Buffer.byteLength(xml,'utf8') },
    rejectUnauthorized: false
  };
  if (vfCfg.cert_path && fs.existsSync(vfCfg.cert_path)) {
    opts.pfx = fs.readFileSync(vfCfg.cert_path);
    if (vfCfg.cert_password) opts.passphrase = vfCfg.cert_password;
  }
  return new Promise(resolve => {
    const req = https.request(opts, res => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        const ok = res.statusCode >= 200 && res.statusCode < 300;
        const csv = (data.match(/<CSV>([^<]+)<\/CSV>/)||[])[1] || null;
        const errDesc = (data.match(/<DescripcionErrorRegistroFacturacion>([^<]+)<\/DescripcionErrorRegistroFacturacion>/)||[])[1] || null;
        for (const id of invoiceIds) {
          const inv = db.invoices.getById(id);
          db.verifactu.updateInvoiceVerifactu(id, {
            huella: inv.huella, huella_anterior: inv.huella_anterior,
            fecha_hora_gen: inv.fecha_hora_gen,
            verifactu_status: ok ? 'enviada' : 'error', verifactu_csv: csv
          });
        }
        resolve({ success: ok, statusCode: res.statusCode, csv, error: errDesc });
      });
    });
    req.on('error', err => resolve({ success: false, error: err.message }));
    req.write(xml, 'utf8');
    req.end();
  });
});

ipcMain.handle('verifactu:selectCert', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Seleccionar certificado digital (.p12 / .pfx)',
    filters: [{ name: 'Certificado digital', extensions: ['p12', 'pfx'] }],
    properties: ['openFile']
  });
  return result.canceled ? null : result.filePaths[0];
});

async function submitViaDNIe(invoiceIds, vfCfg) {
  const { execSync } = require('child_process');
  const business = db.settings.getBusiness();
  const invoices = db.verifactu.getRecordsForSubmission(invoiceIds); // chain order
  if (invoices.some(inv => !inv.huella)) {
    return { success: false, error: 'Hay facturas sin huella calculada. Calcula las huellas primero.' };
  }
  if (!vfCfg.cert_thumbprint) {
    return { success: false, error: 'No hay certificado DNIe seleccionado. Ve a Configuración > Verifactu.' };
  }
  const xml = buildVerifactuXML(invoices, business, vfCfg);
  const isTest = vfCfg.environment !== 'produccion';
  const endpoint = isTest
    ? 'https://prewww1.aeat.es/wlpl/TIKE-CONT/ws/SistemaFacturacionVerifactu'
    : 'https://www1.aeat.es/wlpl/TIKE-CONT/ws/SistemaFacturacionVerifactu';
  const os = require('os');
  const ts = Date.now();
  const tmpXml = path.join(os.tmpdir(), `verifactu-${ts}.xml`);
  const tmpPs  = path.join(os.tmpdir(), `verifactu-submit-${ts}.ps1`);
  fs.writeFileSync(tmpXml, xml, 'utf8');
  const thumbprint = vfCfg.cert_thumbprint;
  const psScript = `
$thumb = "${thumbprint}"
$store = New-Object System.Security.Cryptography.X509Certificates.X509Store("MY","CurrentUser")
$store.Open("ReadOnly")
$cert = $store.Certificates | Where-Object { $_.Thumbprint -eq $thumb } | Select-Object -First 1
$store.Close()
if (-not $cert) {
  Write-Output '{"error":"Certificado no encontrado en el almacen"}'
  exit 1
}
$handler = New-Object System.Net.Http.HttpClientHandler
$handler.ClientCertificates.Add($cert) | Out-Null
$handler.ServerCertificateCustomValidationCallback = [System.Net.Http.HttpClientHandler]::DangerousAcceptAnyServerCertificateValidator
$client = New-Object System.Net.Http.HttpClient($handler)
$body = [System.IO.File]::ReadAllText("${tmpXml.replace(/\\/g, '\\\\')}")
$content = New-Object System.Net.Http.StringContent($body, [System.Text.Encoding]::UTF8, "text/xml")
$resp = $client.PostAsync("${endpoint}", $content).GetAwaiter().GetResult()
$text = $resp.Content.ReadAsStringAsync().GetAwaiter().GetResult()
$status = [int]$resp.StatusCode
Write-Output ([PSCustomObject]@{ status=$status; body=$text } | ConvertTo-Json -Compress)
`;
  fs.writeFileSync(tmpPs, psScript, 'utf8');
  try {
    const out = execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${tmpPs}"`, { encoding: 'utf8', timeout: 30000 });
    try { fs.unlinkSync(tmpXml); } catch (_) {}
    try { fs.unlinkSync(tmpPs); } catch (_) {}
    const result = JSON.parse(out.trim());
    if (result.error) return { success: false, error: result.error };
    const ok = result.status >= 200 && result.status < 300;
    const csv = (result.body.match(/<CSV>([^<]+)<\/CSV>/) || [])[1] || null;
    const errDesc = (result.body.match(/<DescripcionErrorRegistroFacturacion>([^<]+)<\/DescripcionErrorRegistroFacturacion>/) || [])[1] || null;
    for (const id of invoiceIds) {
      const inv = db.invoices.getById(id);
      db.verifactu.updateInvoiceVerifactu(id, {
        huella: inv.huella, huella_anterior: inv.huella_anterior,
        fecha_hora_gen: inv.fecha_hora_gen,
        verifactu_status: ok ? 'enviada' : 'error', verifactu_csv: csv
      });
    }
    return { success: ok, statusCode: result.status, csv, error: errDesc };
  } catch (err) {
    try { fs.unlinkSync(tmpXml); } catch (_) {}
    try { fs.unlinkSync(tmpPs); } catch (_) {}
    return { success: false, error: err.message };
  }
}

ipcMain.handle('verifactu:listWinCerts', async () => {
  const { execSync } = require('child_process');
  const os = require('os');
  const psScript = `
$store = New-Object System.Security.Cryptography.X509Certificates.X509Store("MY","CurrentUser")
$store.Open("ReadOnly")
$certs = $store.Certificates | Where-Object { $_.HasPrivateKey } | ForEach-Object {
  [PSCustomObject]@{
    Subject      = $_.Subject
    Thumbprint   = $_.Thumbprint
    NotAfter     = $_.NotAfter.ToString("yyyy-MM-dd")
    Issuer       = $_.Issuer
    FriendlyName = $_.FriendlyName
  }
}
$store.Close()
if ($certs) { $certs | ConvertTo-Json -Compress } else { "[]" }
`;
  const tmpPs = path.join(os.tmpdir(), `clarifactu-listcerts-${Date.now()}.ps1`);
  fs.writeFileSync(tmpPs, psScript, 'utf8');
  try {
    const out = execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${tmpPs}"`, { encoding: 'utf8', timeout: 10000 });
    try { fs.unlinkSync(tmpPs); } catch (_) {}
    let parsed = JSON.parse(out.trim());
    if (!Array.isArray(parsed)) parsed = [parsed];
    return { success: true, certs: parsed };
  } catch (err) {
    try { fs.unlinkSync(tmpPs); } catch (_) {}
    return { success: false, error: err.message };
  }
});

ipcMain.handle('verifactu:submitWithDNIe', async (e, invoiceIds) => {
  const vfCfg = db.verifactu.getSettings();
  return submitViaDNIe(invoiceIds, vfCfg);
});

// ─── Email IPC Handlers ───────────────────────────────────────────────────────

ipcMain.handle('email:getSettings', () => db.emailSettings.get());
ipcMain.handle('email:saveSettings', (e, data) => db.emailSettings.save(data));

ipcMain.handle('email:testConnection', async (e) => {
  const nodemailer = require('nodemailer');
  const cfg = db.emailSettings.get();
  if (!cfg.gmail_user || !cfg.gmail_app_password) {
    return { success: false, error: 'Configura el email y la contraseña de aplicación primero' };
  }
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: cfg.gmail_user, pass: cfg.gmail_app_password }
  });
  try {
    await transporter.verify();
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ─── Backup IPC Handlers ──────────────────────────────────────────────────────

const backup = require('./src/backup');

function runBackup(auto = false) {
  const biz = db.settings.getBusiness();
  return backup.createBackup({ userData: app.getPath('userData'), db, externalDir: biz.backup_dir || '', auto });
}

// Daily automatic backup, a few seconds after start so it doesn't slow the launch
function scheduleAutoBackup() {
  setTimeout(async () => {
    try {
      const biz = db.settings.getBusiness();
      if (biz.auto_backup && backup.isBackupDue(app.getPath('userData'))) await runBackup(true);
    } catch (err) {
      console.error('Auto backup failed:', err.message);
    }
  }, 8000);
}

// Replaces the data with a backup file and restarts. The file is validated before
// anything changes, and the current data is backed up first so a restore can be undone.
async function restoreFrom(file) {
  const pkg = backup.readBackupFile(file);
  await runBackup(false);
  db.close();
  try {
    backup.applyBackup(pkg, app.getPath('userData'));
  } finally {
    // Restart either way: the database is closed and must be reopened
    app.relaunch();
    app.quit();
  }
  return { success: true };
}

ipcMain.handle('backup:list', () => backup.loadRegistry(app.getPath('userData')));

ipcMain.handle('backup:create', async () => {
  try {
    return await runBackup(false);
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('backup:saveSettings', (e, data) => db.settings.saveBackupSettings(data));

ipcMain.handle('backup:chooseDir', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Carpeta donde guardar también los backups',
    properties: ['openDirectory', 'createDirectory']
  });
  return result.canceled || !result.filePaths.length ? null : result.filePaths[0];
});

ipcMain.handle('backup:download', async (e, filename) => {
  const backupPath = path.join(backup.backupsDir(app.getPath('userData')), path.basename(filename));
  if (!fs.existsSync(backupPath)) {
    return { success: false, error: 'Archivo de backup no encontrado' };
  }
  const ext = path.extname(backupPath).slice(1);
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Descargar backup',
    defaultPath: path.basename(filename),
    filters: [{ name: ext === 'zip' ? 'Backup de Clarifactu' : 'Base de datos SQLite', extensions: [ext] }]
  });
  if (result.canceled || !result.filePath) return { success: false };
  fs.copyFileSync(backupPath, result.filePath);
  shell.showItemInFolder(result.filePath);
  return { success: true };
});

ipcMain.handle('backup:restore', async (e, filename) => {
  try {
    return await restoreFrom(path.join(backup.backupsDir(app.getPath('userData')), path.basename(filename)));
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('backup:importFile', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Importar backup externo',
    filters: [{ name: 'Backup de Clarifactu', extensions: ['zip', 'db'] }],
    properties: ['openFile']
  });
  if (result.canceled || !result.filePaths.length) return { success: false };
  try {
    return await restoreFrom(result.filePaths[0]);
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('email:sendInvoice', async (e, { htmlContent, invoiceNumber, toEmail, toName, subject, body }) => {
  const nodemailer = require('nodemailer');
  const cfg = db.emailSettings.get();

  if (!cfg.gmail_user || !cfg.gmail_app_password) {
    return { success: false, error: 'Configura Gmail en Configuración antes de enviar' };
  }

  // Generate PDF buffer using hidden window
  const pdfWin = new BrowserWindow({
    width: 900, height: 1200, show: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: false }
  });

  try {
    await pdfWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);
    await new Promise(r => setTimeout(r, 800));
    const pdfBuffer = await pdfWin.webContents.printToPDF({
      pageSize: 'A4', printBackground: true,
      margins: { top: 0, bottom: 0, left: 0, right: 0 }
    });
    pdfWin.close();

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: cfg.gmail_user, pass: cfg.gmail_app_password }
    });

    await transporter.sendMail({
      from: `"${cfg.gmail_user}" <${cfg.gmail_user}>`,
      to: `"${toName}" <${toEmail}>`,
      subject,
      text: body,
      attachments: [{
        filename: `${invoiceNumber}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf'
      }]
    });

    return { success: true };
  } catch (err) {
    try { pdfWin.close(); } catch (_) {}
    return { success: false, error: err.message };
  }
});
