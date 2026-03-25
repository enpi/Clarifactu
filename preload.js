const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // ── Clients ──────────────────────────────────────────────────────────────
  clients: {
    getAll: () => ipcRenderer.invoke('clients:getAll'),
    getById: (id) => ipcRenderer.invoke('clients:getById', id),
    create: (data) => ipcRenderer.invoke('clients:create', data),
    update: (id, data) => ipcRenderer.invoke('clients:update', id, data),
    delete: (id) => ipcRenderer.invoke('clients:delete', id),
    search: (query) => ipcRenderer.invoke('clients:search', query),
    getAllTags: () => ipcRenderer.invoke('clients:getAllTags'),
    getByTag: (tag) => ipcRenderer.invoke('clients:getByTag', tag)
  },

  // ── Services ─────────────────────────────────────────────────────────────
  services: {
    getAll: () => ipcRenderer.invoke('services:getAll'),
    getById: (id) => ipcRenderer.invoke('services:getById', id),
    create: (data) => ipcRenderer.invoke('services:create', data),
    update: (id, data) => ipcRenderer.invoke('services:update', id, data),
    delete: (id) => ipcRenderer.invoke('services:delete', id),
    search: (query) => ipcRenderer.invoke('services:search', query)
  },

  // ── Invoices ──────────────────────────────────────────────────────────────
  invoices: {
    getAll: () => ipcRenderer.invoke('invoices:getAll'),
    getById: (id) => ipcRenderer.invoke('invoices:getById', id),
    create: (data) => ipcRenderer.invoke('invoices:create', data),
    update: (id, data) => ipcRenderer.invoke('invoices:update', id, data),
    delete: (id) => ipcRenderer.invoke('invoices:delete', id),
    search: (query) => ipcRenderer.invoke('invoices:search', query),
    getByYear: (year) => ipcRenderer.invoke('invoices:getByYear', year),
    markEmailSent: (id) => ipcRenderer.invoke('invoices:markEmailSent', id),
    markAsPaid: (id, date) => ipcRenderer.invoke('invoices:markAsPaid', id, date),
    markAsPending: (id) => ipcRenderer.invoke('invoices:markAsPending', id),
    getByClient: (clientId) => ipcRenderer.invoke('invoices:getByClient', clientId),
    getOverdue: (days) => ipcRenderer.invoke('invoices:getOverdue', days),
    getByRectifiedId: (id) => ipcRenderer.invoke('invoices:getByRectifiedId', id),
    markAsRectified: (id) => ipcRenderer.invoke('invoices:markAsRectified', id),
    exportCSV: (year) => ipcRenderer.invoke('invoices:exportCSV', year),
    exportExcel: (year) => ipcRenderer.invoke('invoices:exportExcel', year),
    exportPDFSummary: (year) => ipcRenderer.invoke('invoices:exportPDFSummary', year)
  },

  // ── Activity Log ──────────────────────────────────────────────────────────
  activityLog: {
    add: (data) => ipcRenderer.invoke('activityLog:add', data),
    getRecent: (limit) => ipcRenderer.invoke('activityLog:getRecent', limit)
  },

  // ── Invoice Items ─────────────────────────────────────────────────────────
  invoiceItems: {
    getByInvoice: (invoiceId) => ipcRenderer.invoke('invoiceItems:getByInvoice', invoiceId)
  },

  // ── Settings ──────────────────────────────────────────────────────────────
  settings: {
    getBusiness: () => ipcRenderer.invoke('settings:getBusiness'),
    saveBusiness: (data) => ipcRenderer.invoke('settings:saveBusiness', data),
    getNumberSettings: () => ipcRenderer.invoke('settings:getNumberSettings'),
    saveNumberSettings: (data) => ipcRenderer.invoke('settings:saveNumberSettings', data),
    resetCounter: () => ipcRenderer.invoke('settings:resetCounter'),
    saveAppearance: (data) => ipcRenderer.invoke('settings:saveAppearance', data),
    isOnboardingDone: () => ipcRenderer.invoke('settings:isOnboardingDone'),
    markOnboardingDone: () => ipcRenderer.invoke('settings:markOnboardingDone')
  },

  // ── Invoice Number ────────────────────────────────────────────────────────
  generateInvoiceNumber: () => ipcRenderer.invoke('generateInvoiceNumber'),
  commitInvoiceNumber: (counter) => ipcRenderer.invoke('commitInvoiceNumber', counter),
  generateRectificativaNumber: () => ipcRenderer.invoke('generateRectificativaNumber'),
  commitRectificativaNumber: (counter) => ipcRenderer.invoke('commitRectificativaNumber', counter),

  // ── PDF Export ────────────────────────────────────────────────────────────
  exportPDF: (data) => ipcRenderer.invoke('exportPDF', data),
  exportPDFZip: (invoices) => ipcRenderer.invoke('exportPDFZip', invoices),
  getInfo: () => ipcRenderer.invoke('app:getInfo'),
  getIconDataUrl: () => ipcRenderer.invoke('app:getIconDataUrl'),
  activateLicense: (key) => ipcRenderer.invoke('license:activate', key),

  // ── Logo Selection ────────────────────────────────────────────────────────
  selectLogo: () => ipcRenderer.invoke('selectLogo'),
  selectSignature: () => ipcRenderer.invoke('selectSignature'),

  // ── Expenses ──────────────────────────────────────────────────────────────
  expenses: {
    getAll: () => ipcRenderer.invoke('expenses:getAll'),
    getById: (id) => ipcRenderer.invoke('expenses:getById', id),
    create: (data) => ipcRenderer.invoke('expenses:create', data),
    update: (id, data) => ipcRenderer.invoke('expenses:update', id, data),
    delete: (id) => ipcRenderer.invoke('expenses:delete', id),
    getByYear: (year) => ipcRenderer.invoke('expenses:getByYear', year),
    getSummaryByYear: (year) => ipcRenderer.invoke('expenses:getSummaryByYear', year),
    selectDoc: () => ipcRenderer.invoke('expenses:selectDoc'),
    openDoc: (fileName) => ipcRenderer.invoke('expenses:openDoc', fileName),
    deleteDoc: (fileName) => ipcRenderer.invoke('expenses:deleteDoc', fileName),
  },

  // ── Dashboard ─────────────────────────────────────────────────────────────
  dashboard: {
    getStats: () => ipcRenderer.invoke('dashboard:getStats'),
    getMonthlyData: (year) => ipcRenderer.invoke('dashboard:getMonthlyData', year),
    getFiscalSummary: (year) => ipcRenderer.invoke('dashboard:getFiscalSummary', year),
    getTopClients: (year) => ipcRenderer.invoke('dashboard:getTopClients', year),
    getDocumentStats: () => ipcRenderer.invoke('dashboard:getDocumentStats'),
    getYearComparison: (year1, year2) => ipcRenderer.invoke('dashboard:getYearComparison', year1, year2),
    exportFiscalExcel: (year) => ipcRenderer.invoke('dashboard:exportFiscalExcel', year),
    exportFiscalPDF: (year) => ipcRenderer.invoke('dashboard:exportFiscalPDF', year),
    exportModelos: (year) => ipcRenderer.invoke('dashboard:exportModelos', year),
  },

  // ── Document Templates ────────────────────────────────────────────────────
  documentTemplates: {
    getAll: () => ipcRenderer.invoke('documentTemplates:getAll'),
    create: (data) => ipcRenderer.invoke('documentTemplates:create', data),
    update: (id, data) => ipcRenderer.invoke('documentTemplates:update', id, data),
    delete: (id) => ipcRenderer.invoke('documentTemplates:delete', id)
  },

  // ── Verifactu ─────────────────────────────────────────────────────────────
  verifactu: {
    getSettings: () => ipcRenderer.invoke('verifactu:getSettings'),
    saveSettings: (data) => ipcRenderer.invoke('verifactu:saveSettings', data),
    processInvoice: (id) => ipcRenderer.invoke('verifactu:processInvoice', id),
    generateQR: (id) => ipcRenderer.invoke('verifactu:generateQR', id),
    generateXML: (ids) => ipcRenderer.invoke('verifactu:generateXML', ids),
    saveXML: (xml) => ipcRenderer.invoke('verifactu:saveXML', xml),
    submit: (ids) => ipcRenderer.invoke('verifactu:submit', ids),
    submitWithDNIe: (ids) => ipcRenderer.invoke('verifactu:submitWithDNIe', ids),
    selectCert: () => ipcRenderer.invoke('verifactu:selectCert'),
    listWinCerts: () => ipcRenderer.invoke('verifactu:listWinCerts')
  },

  // ── Email ─────────────────────────────────────────────────────────────────
  email: {
    getSettings: () => ipcRenderer.invoke('email:getSettings'),
    saveSettings: (data) => ipcRenderer.invoke('email:saveSettings', data),
    testConnection: () => ipcRenderer.invoke('email:testConnection'),
    sendInvoice: (data) => ipcRenderer.invoke('email:sendInvoice', data)
  },

  // ── Backup ────────────────────────────────────────────────────────────────
  backup: {
    list: () => ipcRenderer.invoke('backup:list'),
    create: () => ipcRenderer.invoke('backup:create'),
    download: (filename) => ipcRenderer.invoke('backup:download', filename),
    restore: (filename) => ipcRenderer.invoke('backup:restore', filename),
    importFile: () => ipcRenderer.invoke('backup:importFile')
  },

  // ── Documents ─────────────────────────────────────────────────────────────
  documents: {
    getAll: () => ipcRenderer.invoke('documents:getAll'),
    getById: (id) => ipcRenderer.invoke('documents:getById', id),
    create: (data) => ipcRenderer.invoke('documents:create', data),
    update: (id, data) => ipcRenderer.invoke('documents:update', id, data),
    delete: (id) => ipcRenderer.invoke('documents:delete', id),
    search: (query) => ipcRenderer.invoke('documents:search', query),
    exportPDF: (data) => ipcRenderer.invoke('documents:exportPDF', data),
    markEmailSent: (id) => ipcRenderer.invoke('documents:markEmailSent', id),
    sendEmail: (data) => ipcRenderer.invoke('documents:sendEmail', data)
  },

  // ── Auto-update ───────────────────────────────────────────────────────────
  update: {
    checkNow: () => ipcRenderer.invoke('update:checkNow'),
    installNow: () => ipcRenderer.invoke('update:installNow'),
    onAvailable: (cb) => ipcRenderer.on('update:available', (e, data) => cb(data)),
    onProgress: (cb) => ipcRenderer.on('update:download-progress', (e, data) => cb(data)),
    onDownloaded: (cb) => ipcRenderer.on('update:downloaded', (e, data) => cb(data)),
    onError: (cb) => ipcRenderer.on('update:error', (e, data) => cb(data))
  },
});