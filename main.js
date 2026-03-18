const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const AdmZip = require('adm-zip');

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
      sandbox: false
    },
    titleBarStyle: 'default',
    show: false
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'renderer', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
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
ipcMain.handle('invoices:search', (e, query) => db.invoices.search(query));
ipcMain.handle('invoices:getByYear', (e, year) => db.invoices.getByYear(year));
ipcMain.handle('invoices:markEmailSent', (e, id) => { db.invoices.markEmailSent(id); return { success: true }; });
ipcMain.handle('invoices:markAsPaid', (e, id, date) => { db.invoices.markAsPaid(id, date); return { success: true }; });
ipcMain.handle('invoices:markAsPending', (e, id) => { db.invoices.markAsPending(id); return { success: true }; });
ipcMain.handle('invoices:getByClient', (e, clientId) => db.invoices.getByClient(clientId));
ipcMain.handle('invoices:getOverdue', (e, days) => db.invoices.getOverdue(days));

ipcMain.handle('invoices:exportCSV', async (e, year) => {
  const list = year ? db.invoices.getByYear(year) : db.invoices.getAll();
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
    defaultPath: `facturas${year ? '-' + year : ''}.csv`,
    filters: [{ name: 'CSV (Excel)', extensions: ['csv'] }]
  });
  if (result.canceled) return { success: false };
  fs.writeFileSync(result.filePath, '\uFEFF' + csv, 'utf8'); // BOM for Excel
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
ipcMain.handle('settings:saveAppearance', (e, data) => db.settings.saveAppearance(data));

// Generate Invoice Number
ipcMain.handle('generateInvoiceNumber', () => {
  const settings = db.settings.getNumberSettings();
  const year = new Date().getFullYear();

  // Reset counter if year changed
  if (settings.current_year !== year) {
    db.settings.resetYearCounter(year);
    settings.counter = 0;
    settings.current_year = year;
  }

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

// ─── Verifactu ───────────────────────────────────────────────────────────────


function vfNum(n) { return (Math.round((n || 0) * 100) / 100).toFixed(2); }

function vfDate(s) {
  if (!s) return '';
  const p = s.split('-');
  return p.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : s;
}

function vfTimestamp() {
  const n = new Date(), z = v => String(v).padStart(2, '0');
  return `${n.getFullYear()}-${z(n.getMonth()+1)}-${z(n.getDate())}T${z(n.getHours())}:${z(n.getMinutes())}:${z(n.getSeconds())}+01:00`;
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

function xe(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
}

function buildVerifactuXML(invoices, business, vfCfg) {
  const registros = invoices.map(inv => {
    const chain = inv.huella_anterior
      ? `<RegistroAnterior>
            <IDEmisorFacturaAnterior>${xe(business.nif)}</IDEmisorFacturaAnterior>
            <NumSerieFacturaAnterior>${xe(inv._prevNumSerie||'')}</NumSerieFacturaAnterior>
            <FechaExpedicionFacturaAnterior>${xe(inv._prevFecha||'')}</FechaExpedicionFacturaAnterior>
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

ipcMain.handle('verifactu:getSettings', () => db.verifactu.getSettings());
ipcMain.handle('verifactu:saveSettings', (e, data) => db.verifactu.saveSettings(data));

ipcMain.handle('verifactu:processInvoice', (e, invoiceId) => {
  const invoice = db.invoices.getById(invoiceId);
  const business = db.settings.getBusiness();
  const prev = db.verifactu.getLastInvoiceHash(invoiceId);
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
  const invoices = invoiceIds.map(id => {
    const inv = db.invoices.getById(id);
    const client = inv.client_id ? db.clients.getById(inv.client_id) : null;
    return { ...inv, client_nif: client?.nif || '', client_name: client?.name || inv.client_name || '' };
  });
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
  const invoices = invoiceIds.map(id => {
    const inv = db.invoices.getById(id);
    const client = inv.client_id ? db.clients.getById(inv.client_id) : null;
    return { ...inv, client_nif: client?.nif||'', client_name: client?.name||inv.client_name||'' };
  });
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
  const invoices = invoiceIds.map(id => {
    const inv = db.invoices.getById(id);
    const client = inv.client_id ? db.clients.getById(inv.client_id) : null;
    return { ...inv, client_nif: client?.nif || '', client_name: client?.name || inv.client_name || '' };
  });
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

function getBackupsDir() {
  return path.join(app.getPath('userData'), 'backups');
}

function loadRegistry(backupsDir) {
  try {
    return JSON.parse(fs.readFileSync(path.join(backupsDir, 'registry.json'), 'utf8'));
  } catch (_) {
    return [];
  }
}

function saveRegistry(backupsDir, registry) {
  fs.writeFileSync(path.join(backupsDir, 'registry.json'), JSON.stringify(registry, null, 2), 'utf8');
}

ipcMain.handle('backup:list', () => {
  return loadRegistry(getBackupsDir());
});

ipcMain.handle('backup:create', () => {
  const userDataPath = app.getPath('userData');
  const dbPath = path.join(userDataPath, 'clarifactu.db');
  const backupsDir = getBackupsDir();

  if (!fs.existsSync(dbPath)) {
    return { success: false, error: 'No se encontró la base de datos' };
  }

  if (!fs.existsSync(backupsDir)) fs.mkdirSync(backupsDir, { recursive: true });

  const now = new Date();
  const pad = v => String(v).padStart(2, '0');
  const timestamp = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  const filename = `backup_${timestamp}.db`;
  const destPath = path.join(backupsDir, filename);

  // WAL checkpoint is handled by better-sqlite3 automatically on copy (WAL is consistent)

  fs.copyFileSync(dbPath, destPath);
  const stat = fs.statSync(destPath);

  let registry = loadRegistry(backupsDir);
  registry.unshift({ filename, createdAt: now.toISOString(), size: stat.size });

  // Keep last 5, delete old files
  const removed = registry.splice(5);
  for (const entry of removed) {
    try { fs.unlinkSync(path.join(backupsDir, entry.filename)); } catch (_) {}
  }

  saveRegistry(backupsDir, registry);
  return { success: true, list: registry };
});

ipcMain.handle('backup:download', async (e, filename) => {
  const backupPath = path.join(getBackupsDir(), filename);
  if (!fs.existsSync(backupPath)) {
    return { success: false, error: 'Archivo de backup no encontrado' };
  }

  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Descargar backup',
    defaultPath: filename,
    filters: [{ name: 'Base de datos SQLite', extensions: ['db'] }]
  });

  if (result.canceled || !result.filePath) return { success: false };

  fs.copyFileSync(backupPath, result.filePath);
  shell.showItemInFolder(result.filePath);
  return { success: true };
});

ipcMain.handle('backup:restore', async (e, filename) => {
  const userDataPath = app.getPath('userData');
  const dbPath = path.join(userDataPath, 'clarifactu.db');
  const backupPath = path.join(getBackupsDir(), filename);

  if (!fs.existsSync(backupPath)) {
    return { success: false, error: 'El archivo de backup no existe' };
  }

  // Close DB connection before overwriting the file
  db.close();

  try {
    fs.copyFileSync(backupPath, dbPath);
  } catch (err) {
    return { success: false, error: err.message };
  }

  // Relaunch the app to reinitialize with the restored DB
  app.relaunch();
  app.quit();
  return { success: true };
});

ipcMain.handle('backup:importFile', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Importar backup externo',
    filters: [{ name: 'Base de datos SQLite', extensions: ['db'] }],
    properties: ['openFile']
  });

  if (result.canceled || !result.filePaths.length) return { success: false };

  const importPath = result.filePaths[0];
  const userDataPath = app.getPath('userData');
  const dbPath = path.join(userDataPath, 'clarifactu.db');

  // Close DB before overwriting
  db.close();

  try {
    fs.copyFileSync(importPath, dbPath);
  } catch (err) {
    return { success: false, error: err.message };
  }

  app.relaunch();
  app.quit();
  return { success: true };
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
