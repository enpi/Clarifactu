// ─── Invoices Page ─────────────────────────────────────────────────────────────

let allInvoicesData = [];
let filteredInvoicesData = [];
let invoicesPage = 1;
const INVOICES_PER_PAGE = 20;
let currentSort = { field: 'date', dir: 'desc' };
let vfEnabled = false;
let overdueDays = 30;
let selectedInvoiceIds = new Set();

function isOverdue(inv) {
  if (inv.payment_status === 'pagada') return false;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - overdueDays);
  return inv.date && inv.date <= cutoff.toISOString().split('T')[0];
}

function paymentBadge(inv) {
  if (inv.payment_status === 'pagada') {
    return `<span class="badge badge-paid" title="Cobrada el ${inv.payment_date || ''}">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
      Cobrada
    </span>`;
  }
  if (isOverdue(inv)) {
    return `<span class="badge badge-overdue">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      Vencida
    </span>`;
  }
  return `<span class="badge badge-pending">Pendiente</span>`;
}

async function renderInvoices(container) {
  const year = new Date().getFullYear();
  const [vfCfg, numSettings] = await Promise.all([
    window.api.verifactu.getSettings(),
    window.api.settings.getNumberSettings()
  ]);
  vfEnabled = !!(vfCfg && vfCfg.enabled);
  overdueDays = numSettings?.overdue_days ?? 30;

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Facturas</h1>
        <p class="page-subtitle">Historial de todas tus facturas</p>
      </div>
      <button class="btn btn-primary" onclick="navigateTo('new-invoice')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        Nueva factura
      </button>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="toolbar" style="margin-bottom:0;flex:1;flex-wrap:wrap;">
          <div class="search-wrapper">
            <span class="search-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </span>
            <input type="text" class="search-input" id="invoice-search" placeholder="Buscar por número o cliente...">
          </div>
          <select class="year-select" id="invoice-year-filter">
            <option value="">Todos los años</option>
            ${generateInvoiceYearOptions(year)}
          </select>
          <select class="sort-select" id="invoice-payment-filter">
            <option value="">Todos los estados</option>
            <option value="pendiente">Pendiente</option>
            <option value="pagada">Cobrada</option>
            <option value="vencida">Vencida (+${overdueDays} días)</option>
          </select>
          <select class="sort-select" id="invoice-sort">
            <option value="date-desc">Fecha (reciente)</option>
            <option value="date-asc">Fecha (antigua)</option>
            <option value="number-asc">Número (asc)</option>
            <option value="number-desc">Número (desc)</option>
            <option value="client-asc">Cliente (A-Z)</option>
            <option value="total-desc">Importe (mayor)</option>
            <option value="total-asc">Importe (menor)</option>
          </select>
          <div style="position:relative;flex-shrink:0;" id="inv-export-wrapper">
            <button class="btn btn-secondary btn-sm" id="inv-export-toggle" style="display:flex;align-items:center;gap:5px;">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Exportar
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            <div id="inv-export-menu" style="display:none;position:absolute;right:0;top:calc(100% + 4px);background:var(--card-bg);border:1px solid var(--border);border-radius:8px;box-shadow:var(--shadow-lg,0 8px 24px rgba(0,0,0,.15));z-index:200;min-width:140px;overflow:hidden;">
              <button id="export-csv-btn" style="display:flex;align-items:center;gap:8px;width:100%;padding:9px 14px;background:none;border:none;cursor:pointer;font-size:13px;color:var(--text-primary);text-align:left;" onmouseover="this.style.background='var(--content-bg)'" onmouseout="this.style.background='none'">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                CSV
              </button>
              <button id="export-excel-btn" style="display:flex;align-items:center;gap:8px;width:100%;padding:9px 14px;background:none;border:none;cursor:pointer;font-size:13px;color:var(--text-primary);text-align:left;" onmouseover="this.style.background='var(--content-bg)'" onmouseout="this.style.background='none'">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/></svg>
                Excel
              </button>
              <button id="export-pdf-summary-btn" style="display:flex;align-items:center;gap:8px;width:100%;padding:9px 14px;background:none;border:none;cursor:pointer;font-size:13px;color:var(--text-primary);text-align:left;" onmouseover="this.style.background='var(--content-bg)'" onmouseout="this.style.background='none'">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                PDF
              </button>
            </div>
          </div>
          <span id="invoice-count" class="text-muted" style="font-size:13px;"></span>
        </div>
      </div>
      <div id="bulk-action-bar" style="display:none;align-items:center;gap:10px;padding:8px 16px;background:var(--primary);color:#fff;font-size:13px;font-weight:500;">
        <span class="bulk-count"></span>
        <div style="flex:1;"></div>
        <button class="btn btn-sm" style="background:rgba(255,255,255,0.2);color:#fff;border:1px solid rgba(255,255,255,0.4);" id="bulk-paid-btn">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
          Marcar cobradas
        </button>
        <button class="btn btn-sm" style="background:rgba(255,255,255,0.2);color:#fff;border:1px solid rgba(255,255,255,0.4);" id="bulk-email-btn">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
          Enviar email
        </button>
        <button class="btn btn-sm" style="background:rgba(255,255,255,0.2);color:#fff;border:1px solid rgba(255,255,255,0.4);" id="bulk-pdf-btn">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          Descargar PDF
        </button>
        <button class="btn btn-sm" style="background:rgba(239,68,68,0.25);color:#fff;border:1px solid rgba(239,68,68,0.5);" id="bulk-delete-btn">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
          Eliminar
        </button>
        <button class="btn btn-sm btn-icon" style="background:rgba(255,255,255,0.15);color:#fff;border:none;" id="bulk-clear-btn" title="Limpiar selección">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th style="width:36px;padding:10px 8px;">
                <input type="checkbox" id="inv-select-all" style="width:15px;height:15px;cursor:pointer;">
              </th>
              <th>Número</th>
              <th>Fecha</th>
              <th>Cliente</th>
              <th class="text-right">Total</th>
              <th style="width:110px;text-align:center;">Cobro</th>
              ${vfEnabled ? '<th style="width:90px;text-align:center;">Verifactu</th>' : ''}
              <th style="width:140px;"></th>
            </tr>
          </thead>
          <tbody id="invoices-tbody">
            <tr><td colspan="${vfEnabled ? 8 : 7}"><div class="loading"><div class="spinner"></div>Cargando...</div></td></tr>
          </tbody>
        </table>
      </div>
      <div id="invoices-pagination"></div>
      ${vfEnabled ? `<div class="verifactu-bar">
        <span class="vf-label">Verifactu:</span>
        <button class="btn btn-sm btn-secondary" onclick="vfProcessAll()">Calcular huellas</button>
        <button class="btn btn-sm btn-primary" onclick="vfSubmitAll()">Enviar a AEAT</button>
        <button class="btn btn-sm btn-ghost" onclick="vfExportXML()">Exportar XML</button>
      </div>` : ''}
    </div>
  `;

  // Events
  document.getElementById('invoice-search').addEventListener('input', debounce(filterAndRenderInvoices, 200));
  document.getElementById('invoice-year-filter').addEventListener('change', filterAndRenderInvoices);
  document.getElementById('invoice-payment-filter').addEventListener('change', filterAndRenderInvoices);
  document.getElementById('invoice-sort').addEventListener('change', filterAndRenderInvoices);

  // Export dropdown
  const exportToggle = document.getElementById('inv-export-toggle');
  const exportMenu   = document.getElementById('inv-export-menu');
  exportToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    exportMenu.style.display = exportMenu.style.display === 'none' ? 'block' : 'none';
  });
  document.addEventListener('click', () => { exportMenu.style.display = 'none'; }, { capture: true, passive: true });

  const getYear = () => { const el = document.getElementById('invoice-year-filter'); return el?.value ? parseInt(el.value) : null; };

  document.getElementById('export-csv-btn').addEventListener('click', async () => {
    exportMenu.style.display = 'none';
    const result = await window.api.invoices.exportCSV(getYear());
    if (result.success) showToast('CSV exportado correctamente', 'success');
  });
  document.getElementById('export-excel-btn').addEventListener('click', async () => {
    exportMenu.style.display = 'none';
    const result = await window.api.invoices.exportExcel(getYear());
    if (result.success) showToast('Excel exportado correctamente', 'success');
  });
  document.getElementById('export-pdf-summary-btn').addEventListener('click', async () => {
    exportMenu.style.display = 'none';
    const result = await window.api.invoices.exportPDFSummary(getYear());
    if (result && result.success) showToast('PDF exportado correctamente', 'success');
    else if (result && result.reason !== 'cancelled') showToast('Error al exportar PDF', 'error');
  });

  await loadInvoices();

  document.getElementById('inv-select-all').addEventListener('change', (e) => {
    const cbs = document.querySelectorAll('.inv-select-cb');
    cbs.forEach(cb => {
      const id = parseInt(cb.dataset.id);
      if (e.target.checked) selectedInvoiceIds.add(id);
      else selectedInvoiceIds.delete(id);
      cb.checked = e.target.checked;
    });
    updateBulkBar();
  });

  document.getElementById('bulk-clear-btn').addEventListener('click', () => {
    selectedInvoiceIds.clear();
    document.querySelectorAll('.inv-select-cb').forEach(cb => cb.checked = false);
    updateBulkBar();
  });

  document.getElementById('bulk-delete-btn').addEventListener('click', () => bulkDeleteInvoices());
  document.getElementById('bulk-pdf-btn').addEventListener('click', () => bulkDownloadPDFs());
  document.getElementById('bulk-email-btn').addEventListener('click', () => bulkSendEmails());
  document.getElementById('bulk-paid-btn').addEventListener('click', () => bulkMarkAsPaid());
}

function generateInvoiceYearOptions(currentYear) {
  const years = [];
  for (let y = currentYear; y >= currentYear - 5; y--) {
    years.push(`<option value="${y}">${y}</option>`);
  }
  return years.join('');
}

async function loadInvoices() {
  allInvoicesData = await window.api.invoices.getAll();
  filterAndRenderInvoices();
}

function filterAndRenderInvoices() {
  const searchEl = document.getElementById('invoice-search');
  const yearEl = document.getElementById('invoice-year-filter');
  const paymentEl = document.getElementById('invoice-payment-filter');
  const sortEl = document.getElementById('invoice-sort');

  if (!searchEl) return;

  const query = searchEl.value.toLowerCase();
  const year = yearEl ? yearEl.value : '';
  const paymentFilter = paymentEl ? paymentEl.value : '';
  const sortValue = sortEl ? sortEl.value : 'date-desc';

  let filtered = allInvoicesData.filter(inv => {
    const matchSearch = !query ||
      inv.invoice_number.toLowerCase().includes(query) ||
      (inv.client_name || '').toLowerCase().includes(query);

    const matchYear = !year || (inv.date && inv.date.startsWith(year));

    let matchPayment = true;
    if (paymentFilter === 'pagada') {
      matchPayment = inv.payment_status === 'pagada';
    } else if (paymentFilter === 'pendiente') {
      matchPayment = inv.payment_status !== 'pagada' && !isOverdue(inv);
    } else if (paymentFilter === 'vencida') {
      matchPayment = isOverdue(inv);
    }

    return matchSearch && matchYear && matchPayment;
  });

  // Sort
  const [sortField, sortDir] = sortValue.split('-');
  filtered.sort((a, b) => {
    let aVal, bVal;
    switch (sortField) {
      case 'date':
        aVal = a.date;
        bVal = b.date;
        break;
      case 'number':
        aVal = a.invoice_number;
        bVal = b.invoice_number;
        break;
      case 'client':
        aVal = (a.client_name || '').toLowerCase();
        bVal = (b.client_name || '').toLowerCase();
        break;
      case 'total':
        aVal = a.total;
        bVal = b.total;
        break;
      default:
        aVal = a.date;
        bVal = b.date;
    }

    if (sortDir === 'asc') {
      return aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
    } else {
      return aVal < bVal ? 1 : aVal > bVal ? -1 : 0;
    }
  });

  filteredInvoicesData = filtered;
  invoicesPage = 1;
  selectedInvoiceIds.clear();
  updateBulkBar();
  renderInvoicesPage();

  const countEl = document.getElementById('invoice-count');
  if (countEl) {
    const totalAmt = filtered.reduce((sum, inv) => sum + (inv.total || 0), 0);
    const unpaidTotal = filtered.filter(inv => inv.payment_status !== 'pagada').reduce((sum, inv) => sum + (inv.total || 0), 0);
    const unpaidCount = filtered.filter(inv => inv.payment_status !== 'pagada').length;
    countEl.innerHTML = `${filtered.length} factura${filtered.length !== 1 ? 's' : ''} · ${formatCurrency(totalAmt)}` +
      (unpaidCount > 0 ? ` <span style="color:#dc2626;font-size:11px;margin-left:6px;">· ${unpaidCount} pendiente${unpaidCount > 1 ? 's' : ''}: ${formatCurrency(unpaidTotal)}</span>` : '');
  }
}

function renderInvoicesPage() {
  const totalPages = Math.ceil(filteredInvoicesData.length / INVOICES_PER_PAGE) || 1;
  const page = Math.min(invoicesPage, totalPages);
  const start = (page - 1) * INVOICES_PER_PAGE;
  renderInvoicesTable(filteredInvoicesData.slice(start, start + INVOICES_PER_PAGE));
  renderPagination('invoices-pagination', page, totalPages, (p) => { invoicesPage = p; renderInvoicesPage(); });
  // Wire up row checkboxes
  document.querySelectorAll('.inv-select-cb').forEach(cb => {
    cb.addEventListener('change', (e) => {
      const id = parseInt(e.target.id || e.target.dataset.id);
      if (e.target.checked) selectedInvoiceIds.add(id);
      else selectedInvoiceIds.delete(id);
      const row = e.target.closest('tr');
      if (row) row.classList.toggle('row-selected', e.target.checked);
      updateBulkBar();
    });
  });
}

function updateBulkBar() {
  const bar = document.getElementById('bulk-action-bar');
  if (!bar) return;
  const count = selectedInvoiceIds.size;
  bar.style.display = count > 0 ? 'flex' : 'none';
  const countEl = bar.querySelector('.bulk-count');
  if (countEl) countEl.textContent = `${count} factura${count !== 1 ? 's' : ''} seleccionada${count !== 1 ? 's' : ''}`;
  // Sync select-all
  const allCb = document.getElementById('inv-select-all');
  if (allCb) {
    const pageIds = [...document.querySelectorAll('.inv-select-cb')].map(cb => parseInt(cb.dataset.id));
    const allChecked = pageIds.length > 0 && pageIds.every(id => selectedInvoiceIds.has(id));
    const someChecked = pageIds.some(id => selectedInvoiceIds.has(id));
    allCb.checked = allChecked;
    allCb.indeterminate = someChecked && !allChecked;
  }
}

function vfBadge(status) {
  const map = {
    'enviada':  ['badge-green',  'Enviada'],
    'error':    ['badge-red',    'Error'],
    'pendiente':['badge-yellow', 'Pendiente'],
  };
  const [cls, label] = map[status] || ['badge-yellow', 'Pendiente'];
  return `<span class="badge ${cls}">${label}</span>`;
}

function renderInvoicesTable(invoices) {
  const tbody = document.getElementById('invoices-tbody');
  if (!tbody) return;

  if (invoices.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="${vfEnabled ? 8 : 7}">
          <div class="empty-state">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
            <p>No se encontraron facturas.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = invoices.map(inv => `
    <tr class="${selectedInvoiceIds.has(inv.id) ? 'row-selected' : ''}">
      <td style="padding:10px 8px;">
        <input type="checkbox" class="inv-select-cb" data-id="${inv.id}" style="width:15px;height:15px;cursor:pointer;" ${selectedInvoiceIds.has(inv.id) ? 'checked' : ''}>
      </td>
      <td>
        <span class="badge ${inv.tipo_factura === 'R1' ? 'badge-red' : 'badge-blue'}">${escapeHtml(inv.invoice_number)}</span>
        ${inv.tipo_factura === 'R1' ? `<span style="font-size:10px;background:#fee2e2;color:#991b1b;border-radius:4px;padding:1px 5px;font-weight:600;margin-left:4px;">RECT</span>` : ''}
        ${inv.rectified ? `<span style="font-size:10px;background:#f3f4f6;color:#6b7280;border-radius:4px;padding:1px 5px;margin-left:4px;">Rectificada</span>` : ''}
        ${inv.email_sent_at ? `<span class="email-sent-badge" title="Email enviado el ${formatDateTime(inv.email_sent_at)}">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
          Enviado
        </span>` : ''}
      </td>
      <td>${formatDate(inv.date)}</td>
      <td>${escapeHtml(inv.client_name || 'Sin cliente')}</td>
      <td class="text-right fw-bold">${formatCurrency(inv.total)}</td>
      <td style="text-align:center;">
        <div style="display:flex;flex-direction:column;align-items:center;gap:4px;">
          ${paymentBadge(inv)}
          ${inv.payment_status === 'pagada'
            ? `<button class="btn btn-ghost btn-sm" style="font-size:10px;padding:1px 6px;" onclick="togglePayment(${inv.id}, 'pendiente')">Desmarcar</button>`
            : `<button class="btn btn-ghost btn-sm" style="font-size:10px;padding:1px 6px;color:#059669;" onclick="togglePayment(${inv.id}, 'pagada')">Marcar cobrada</button>`
          }
        </div>
      </td>
      ${vfEnabled ? `<td style="text-align:center;">${vfBadge(inv.verifactu_status)}</td>` : ''}
      <td>
        <div class="table-actions" style="gap:2px;">
          <button class="btn btn-ghost btn-sm btn-icon" title="Ver factura" onclick="viewInvoice(${inv.id})">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
          <button class="btn btn-ghost btn-sm btn-icon" title="Editar factura" onclick="editInvoice(${inv.id})">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="btn btn-ghost btn-sm btn-icon" title="Duplicar factura" onclick="duplicateInvoice(${inv.id})">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          </button>
          <button class="btn btn-ghost btn-sm btn-icon" title="Exportar PDF" onclick="exportInvoicePDF(${inv.id})">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          </button>
          ${inv.client_email ? `<button class="btn btn-ghost btn-sm btn-icon" title="Enviar por email" onclick="sendInvoiceEmail(${inv.id})">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
          </button>` : ''}
          ${inv.tipo_factura !== 'R1' && !inv.rectified ? `<button class="btn btn-ghost btn-sm btn-icon" title="Crear rectificativa" onclick="createRectificativa(${inv.id})" style="color:#b45309;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.5"/></svg>
          </button>` : ''}
          <button class="btn btn-ghost btn-sm btn-icon danger" title="Eliminar" onclick="deleteInvoice(${inv.id}, '${escapeHtml(inv.invoice_number).replace(/'/g, "\\'")}')">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

function editInvoice(id) {
  navigateTo('new-invoice', { editId: id });
}

function duplicateInvoice(id) {
  navigateTo('new-invoice', { duplicateId: id });
}

function createRectificativa(id) {
  navigateTo('new-invoice', { rectificativaOf: id });
}

async function togglePayment(id, newStatus) {
  if (newStatus === 'pagada') {
    await window.api.invoices.markAsPaid(id);
    showToast('Factura marcada como cobrada', 'success');
  } else {
    await window.api.invoices.markAsPending(id);
    showToast('Factura marcada como pendiente', 'info');
  }
  await loadInvoices();
}

async function sendInvoiceEmail(id) {
  const [invoice, items, business, emailCfg] = await Promise.all([
    window.api.invoices.getById(id),
    window.api.invoiceItems.getByInvoice(id),
    window.api.settings.getBusiness(),
    window.api.email.getSettings()
  ]);

  if (!emailCfg.gmail_user) {
    showToast('Configura Gmail en Configuración antes de enviar', 'warning');
    navigateTo('settings');
    return;
  }

  const clientEmail = invoice.client_email || '';
  const clientName = invoice.client_name || '';

  // Interpolate template variables
  function interpolate(tpl) {
    return (tpl || '')
      .replace(/\{numero\}/g, invoice.invoice_number)
      .replace(/\{cliente\}/g, clientName)
      .replace(/\{total\}/g, formatCurrency(invoice.total))
      .replace(/\{fecha\}/g, formatDate(invoice.date));
  }

  const subject = interpolate(emailCfg.default_subject);
  const body = interpolate(emailCfg.default_body);

  openModal('Enviar factura por email', `
    <div style="display:flex;flex-direction:column;gap:14px;">
      <div class="form-group" style="margin-bottom:0;">
        <label class="form-label">Destinatario</label>
        <input type="email" class="form-control" id="send-email-to" value="${escapeHtml(clientEmail)}" placeholder="email@cliente.com">
      </div>
      <div class="form-group" style="margin-bottom:0;">
        <label class="form-label">Asunto</label>
        <input type="text" class="form-control" id="send-email-subject" value="${escapeHtml(subject)}">
      </div>
      <div class="form-group" style="margin-bottom:0;">
        <label class="form-label">Mensaje</label>
        <textarea class="form-control" id="send-email-body" rows="6">${escapeHtml(body)}</textarea>
      </div>
      <div style="font-size:12px;color:var(--text-secondary);">
        Se adjuntará la factura <strong>${escapeHtml(invoice.invoice_number)}</strong> en PDF.
      </div>
      <div style="display:flex;justify-content:flex-end;gap:8px;">
        <button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
        <button class="btn btn-primary" id="confirm-send-email-btn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
          Enviar
        </button>
      </div>
    </div>
  `, { size: 'lg' });

  document.getElementById('confirm-send-email-btn').addEventListener('click', async () => {
    const toEmail = document.getElementById('send-email-to').value.trim();
    const subjectVal = document.getElementById('send-email-subject').value.trim();
    const bodyVal = document.getElementById('send-email-body').value;

    if (!toEmail) {
      showToast('Introduce un email de destino', 'error');
      return;
    }

    const btn = document.getElementById('confirm-send-email-btn');
    btn.disabled = true;
    btn.textContent = 'Enviando...';

    const htmlContent = generatePDFDocument(invoice, items, business);
    const result = await window.api.email.sendInvoice({
      htmlContent,
      invoiceNumber: invoice.invoice_number,
      toEmail,
      toName: clientName,
      subject: subjectVal,
      body: bodyVal
    });

    if (result.success) {
      showToast(`Factura enviada a ${toEmail}`, 'success');
      closeModal();
      await window.api.invoices.markEmailSent(id);
      await window.api.activityLog.add({
        action_type: 'email_enviado',
        invoice_id: id,
        invoice_number: invoice.invoice_number,
        client_name: invoice.client_name || '',
        details: `Enviado a ${toEmail}`
      });
      await loadInvoices();
    } else {
      showToast('Error al enviar: ' + result.error, 'error');
      btn.disabled = false;
      btn.textContent = 'Enviar';
    }
  });
}

async function viewInvoice(id) {
  const fetches = [
    window.api.invoices.getById(id),
    window.api.invoiceItems.getByInvoice(id),
    window.api.settings.getBusiness(),
  ];
  if (vfEnabled) fetches.push(window.api.verifactu.generateQR(id));
  const [invoice, items, business, qrResult] = await Promise.all(fetches);

  const qrDataUrl = vfEnabled && qrResult?.success ? qrResult.dataUrl : null;
  const html = generateInvoiceHTML(invoice, items, business, qrDataUrl);

  openModal('Factura ' + invoice.invoice_number, `
    <div style="display:flex;justify-content:flex-end;margin-bottom:16px;gap:10px;">
      ${vfEnabled ? `<button class="btn btn-secondary btn-sm" onclick="vfProcessSingle(${id})" title="Calcular huella Verifactu">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        ${invoice.huella ? 'Recalcular huella' : 'Calcular huella'}
      </button>` : ''}
      <button class="btn btn-primary" onclick="exportInvoicePDF(${id})">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        Exportar PDF
      </button>
    </div>
    <div style="border:1px solid var(--border);border-radius:8px;overflow:hidden;">
      ${html}
    </div>
  `, { size: 'xl' });
}

async function exportInvoicePDF(id) {
  const fetches = [
    window.api.invoices.getById(id),
    window.api.invoiceItems.getByInvoice(id),
    window.api.settings.getBusiness(),
  ];
  if (vfEnabled) fetches.push(window.api.verifactu.generateQR(id));
  const [invoice, items, business, qrResult] = await Promise.all(fetches);

  const qrDataUrl = vfEnabled && qrResult?.success ? qrResult.dataUrl : null;
  const htmlContent = generatePDFDocument(invoice, items, business, qrDataUrl);

  const result = await window.api.exportPDF({
    htmlContent,
    invoiceNumber: invoice.invoice_number
  });

  if (result.success) {
    showToast(`PDF guardado en ${result.path}`, 'success');
    await window.api.activityLog.add({
      action_type: 'pdf_exportado',
      invoice_id: id,
      invoice_number: invoice.invoice_number,
      client_name: invoice.client_name || '',
      details: null
    });
  } else if (result.reason !== 'cancelled') {
    showToast('Error al exportar PDF: ' + result.reason, 'error');
  }
}

async function deleteInvoice(id, number) {
  const confirmed = await showConfirm(
    '¿Eliminar factura?',
    `¿Estás seguro de que quieres eliminar la factura "${number}"? Esta acción no se puede deshacer.`
  );

  if (!confirmed) return;

  try {
    await window.api.invoices.delete(id);
    showToast('Factura eliminada', 'success');
    await window.api.activityLog.add({
      action_type: 'factura_eliminada',
      invoice_id: null,
      invoice_number: number,
      client_name: null,
      details: null
    });
    await loadInvoices();
  } catch (err) {
    showToast('Error al eliminar la factura: ' + err.message, 'error');
  }
}

// ─── Bulk Actions ─────────────────────────────────────────────────────────────

async function bulkMarkAsPaid() {
  const ids = [...selectedInvoiceIds];
  const confirmed = await showConfirm(
    `¿Marcar ${ids.length} factura${ids.length !== 1 ? 's' : ''} como cobradas?`,
    `Se registrará la fecha de hoy como fecha de cobro en las facturas que aún estén pendientes.`,
    'Marcar cobradas'
  );
  if (!confirmed) return;

  const today = new Date().toISOString().split('T')[0];
  let marked = 0;
  for (const id of ids) {
    try {
      await window.api.invoices.markAsPaid(id, today);
      marked++;
    } catch (_) {}
  }
  showToast(`${marked} factura${marked !== 1 ? 's' : ''} marcada${marked !== 1 ? 's' : ''} como cobrada${marked !== 1 ? 's' : ''}`, 'success');
  selectedInvoiceIds.clear();
  await loadInvoices();
}


async function bulkDeleteInvoices() {
  const ids = [...selectedInvoiceIds];
  const confirmed = await showConfirm(
    `¿Eliminar ${ids.length} factura${ids.length !== 1 ? 's' : ''}?`,
    `Se eliminarán ${ids.length} factura${ids.length !== 1 ? 's' : ''} de forma permanente. Esta acción no se puede deshacer.`,
    'Eliminar todas'
  );
  if (!confirmed) return;

  let deleted = 0;
  for (const id of ids) {
    try {
      await window.api.invoices.delete(id);
      deleted++;
    } catch (_) {}
  }
  showToast(`${deleted} factura${deleted !== 1 ? 's' : ''} eliminada${deleted !== 1 ? 's' : ''}`, 'success');
  selectedInvoiceIds.clear();
  await loadInvoices();
}

async function bulkDownloadPDFs() {
  const ids = [...selectedInvoiceIds];
  const business = await window.api.settings.getBusiness();

  showToast(`Generando ${ids.length} PDF${ids.length !== 1 ? 's' : ''}...`, 'info');

  const invoicePayloads = [];
  for (const id of ids) {
    const [invoice, items] = await Promise.all([
      window.api.invoices.getById(id),
      window.api.invoiceItems.getByInvoice(id)
    ]);
    invoicePayloads.push({
      htmlContent: generatePDFDocument(invoice, items, business),
      invoiceNumber: invoice.invoice_number
    });
  }

  const result = await window.api.exportPDFZip(invoicePayloads);
  if (result.success) {
    const errs = result.errors?.length ? ` (${result.errors.length} fallaron)` : '';
    showToast(`ZIP guardado con ${invoicePayloads.length - (result.errors?.length || 0)} facturas${errs}`, 'success');
  } else if (result.reason !== 'cancelled') {
    showToast('Error al crear el ZIP: ' + result.reason, 'error');
  }
}

async function bulkSendEmails() {
  const ids = [...selectedInvoiceIds];
  const [business, emailCfg] = await Promise.all([
    window.api.settings.getBusiness(),
    window.api.email.getSettings()
  ]);

  if (!emailCfg.gmail_user) {
    showToast('Configura Gmail en Configuración antes de enviar', 'warning');
    navigateTo('settings');
    return;
  }

  // Load all invoices to check which have email
  const invoices = await Promise.all(ids.map(id => window.api.invoices.getById(id)));
  const withEmail = invoices.filter(inv => inv.client_email);
  const withoutEmail = invoices.filter(inv => !inv.client_email);

  const confirmed = await showConfirm(
    `Enviar ${withEmail.length} email${withEmail.length !== 1 ? 's' : ''}`,
    `Se enviará cada factura al email del cliente correspondiente.` +
    (withoutEmail.length > 0 ? `\n\n${withoutEmail.length} factura${withoutEmail.length !== 1 ? 's' : ''} sin email de cliente serán omitidas.` : ''),
    'Enviar'
  );
  if (!confirmed) return;

  function interpolate(tpl, invoice) {
    return (tpl || '')
      .replace(/\{numero\}/g, invoice.invoice_number)
      .replace(/\{cliente\}/g, invoice.client_name || '')
      .replace(/\{total\}/g, formatCurrency(invoice.total))
      .replace(/\{fecha\}/g, formatDate(invoice.date));
  }

  showToast(`Enviando ${withEmail.length} email${withEmail.length !== 1 ? 's' : ''}...`, 'info');
  let ok = 0, fail = 0;
  for (const invoice of withEmail) {
    try {
      const items = await window.api.invoiceItems.getByInvoice(invoice.id);
      const htmlContent = generatePDFDocument(invoice, items, business);
      const result = await window.api.email.sendInvoice({
        htmlContent,
        invoiceNumber: invoice.invoice_number,
        toEmail: invoice.client_email,
        toName: invoice.client_name || '',
        subject: interpolate(emailCfg.default_subject, invoice),
        body: interpolate(emailCfg.default_body, invoice)
      });
      if (result.success) {
        ok++;
        await window.api.invoices.markEmailSent(invoice.id);
        await window.api.activityLog.add({
          action_type: 'email_enviado',
          invoice_id: invoice.id,
          invoice_number: invoice.invoice_number,
          client_name: invoice.client_name || '',
          details: `Enviado a ${invoice.client_email} (envío masivo)`
        });
      } else {
        fail++;
      }
    } catch (_) { fail++; }
  }

  if (ok > 0) showToast(`${ok} email${ok !== 1 ? 's' : ''} enviado${ok !== 1 ? 's' : ''} correctamente`, 'success');
  if (fail > 0) showToast(`${fail} email${fail !== 1 ? 's' : ''} fallaron`, 'error');
  selectedInvoiceIds.clear();
  await loadInvoices();
}

// ─── Verifactu Functions ──────────────────────────────────────────────────────

async function vfProcessSingle(id) {
  try {
    await window.api.verifactu.processInvoice(id);
    showToast('Huella Verifactu calculada', 'success');
    await loadInvoices();
    closeModal();
    setTimeout(() => viewInvoice(id), 100);
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}

async function vfProcessAll() {
  const invoices = await window.api.invoices.getAll();
  const pending = invoices.filter(inv => !inv.huella);
  if (pending.length === 0) {
    showToast('Todas las facturas ya tienen huella calculada', 'info');
    return;
  }
  showToast(`Calculando ${pending.length} huellas...`, 'info');
  for (const inv of pending) {
    await window.api.verifactu.processInvoice(inv.id);
  }
  showToast(`${pending.length} huellas Verifactu calculadas`, 'success');
  await loadInvoices();
}

async function vfSubmitAll() {
  const invoices = await window.api.invoices.getAll();
  const pending = invoices.filter(inv => inv.huella && inv.verifactu_status !== 'enviada');
  if (pending.length === 0) {
    showToast('No hay facturas pendientes de envío (con huella)', 'info');
    return;
  }
  const confirmed = await showConfirm(
    'Enviar a AEAT',
    `Se enviarán ${pending.length} factura(s) al servicio Verifactu de la AEAT. ¿Continuar?`,
    'Enviar'
  );
  if (!confirmed) return;
  showToast('Enviando a AEAT...', 'info');
  const result = await window.api.verifactu.submit(pending.map(inv => inv.id));
  if (result.success) {
    showToast(`Enviado correctamente${result.csv ? ' · CSV: ' + result.csv : ''}`, 'success');
  } else {
    showToast('Error al enviar: ' + (result.error || `HTTP ${result.statusCode}`), 'error');
  }
  await loadInvoices();
}

async function vfExportXML() {
  const invoices = await window.api.invoices.getAll();
  if (invoices.length === 0) { showToast('No hay facturas', 'info'); return; }
  const withHuella = invoices.filter(inv => inv.huella);
  if (withHuella.length === 0) {
    showToast('Calcula las huellas primero', 'warning');
    return;
  }
  const xmlResult = await window.api.verifactu.generateXML(withHuella.map(inv => inv.id));
  if (!xmlResult.success) { showToast('Error generando XML', 'error'); return; }
  const saveResult = await window.api.verifactu.saveXML(xmlResult.xml);
  if (saveResult.success) showToast('XML guardado en ' + saveResult.path, 'success');
}

// ─── Invoice HTML Generator ────────────────────────────────────────────────────

function getTemplateVars(template) {
  switch (template) {
    case 'minimal':
      return { accent: '#1e293b', accentLight: '#f1f5f9', accentText: '#1e293b', titleLabel: '#1e293b' };
    case 'moderna':
      return { accent: '#0f172a', accentLight: '#ede9fe', accentText: '#7c3aed', titleLabel: '#7c3aed' };
    default:
      return { accent: '#2563EB', accentLight: '#eff6ff', accentText: '#2563EB', titleLabel: '#2563EB' };
  }
}

function generateInvoiceHTML(invoice, items, business, qrDataUrl = null) {
  const logoHtml = business.logo
    ? `<img src="${business.logo}" class="inv-logo" alt="Logo">`
    : `<div class="inv-logo-placeholder">Sin logo</div>`;

  const businessInfo = [
    business.nif ? `NIF: ${escapeHtml(business.nif)}` : '',
    business.address ? escapeHtml(business.address) : '',
    business.extra_info ? escapeHtml(business.extra_info) : ''
  ].filter(Boolean).join('<br>');

  const clientInfo = [
    invoice.client_nif ? `NIF: ${escapeHtml(invoice.client_nif)}` : '',
    invoice.client_address ? escapeHtml(invoice.client_address) : ''
  ].filter(Boolean).join('<br>');

  const itemsRows = items.map(item => `
    <tr>
      <td>${escapeHtml(item.service_name)}</td>
      <td>${escapeHtml(item.description || '')}</td>
      <td style="text-align:center;">${item.quantity}</td>
      <td style="text-align:right;">${formatCurrency(item.unit_price)}</td>
      <td style="text-align:right;">${formatCurrency(item.total)}</td>
    </tr>
  `).join('');

  const tpl = getTemplateVars(business.invoice_template);

  return `
    <div class="invoice-preview invoice-tpl-${business.invoice_template || 'clasica'}">
      <div class="inv-header" style="border-bottom-color:${tpl.accent};">
        <div>
          ${logoHtml}
          ${business.name ? `<div class="inv-company-name" style="margin-top:10px;">${escapeHtml(business.name)}</div>` : ''}
          <div class="inv-company-detail">${businessInfo}</div>
        </div>
        <div class="inv-title-area">
          <div class="inv-title" style="color:${tpl.titleLabel};">FACTURA</div>
          <div class="inv-number">${escapeHtml(invoice.invoice_number)}</div>
          <div class="inv-date">${formatDate(invoice.date)}</div>
        </div>
      </div>

      <div class="inv-parties">
        <div>
          <div class="inv-party-label">Factura de</div>
          <div class="inv-party-name">${escapeHtml(business.name || 'Mi empresa')}</div>
          <div class="inv-party-detail">${businessInfo}</div>
        </div>
        <div>
          <div class="inv-party-label">Facturado a</div>
          <div class="inv-party-name">${escapeHtml(invoice.client_name || 'Cliente')}</div>
          <div class="inv-party-detail">${clientInfo}</div>
        </div>
      </div>

      <table class="inv-table">
        <thead>
          <tr>
            <th>Concepto</th>
            <th>Descripción</th>
            <th style="text-align:center;width:60px;">Cant.</th>
            <th style="text-align:right;width:110px;">Precio unit.</th>
            <th style="text-align:right;width:110px;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${itemsRows}
        </tbody>
      </table>

      <div class="inv-totals">
        <div class="inv-total-row">
          <span>Subtotal</span>
          <span>${formatCurrency(invoice.subtotal)}</span>
        </div>
        ${invoice.tax_rate > 0 ? `
        <div class="inv-total-row">
          <span>IVA (${invoice.tax_rate}%)</span>
          <span>${formatCurrency(invoice.tax_amount)}</span>
        </div>` : ''}
        ${invoice.irpf_rate > 0 ? `
        <div class="inv-total-row" style="color:#ef4444;">
          <span>IRPF (${invoice.irpf_rate}%)</span>
          <span>−${formatCurrency(invoice.irpf_amount)}</span>
        </div>` : ''}
        <div class="inv-total-row">
          <span>TOTAL</span>
          <span>${formatCurrency(invoice.total)}</span>
        </div>
      </div>

      <div class="inv-qr-block">
        <div style="flex:1;">
          ${invoice.notes ? `
            <div class="inv-notes">
              <div class="inv-notes-label">Notas</div>
              <div class="inv-notes-text">${escapeHtml(invoice.notes)}</div>
            </div>` : ''}
          ${business.iban ? `
            <div class="inv-notes" style="margin-top:10px;">
              <div class="inv-notes-label">Datos de pago</div>
              <div class="inv-notes-text">IBAN: <strong>${escapeHtml(business.iban)}</strong></div>
            </div>` : ''}
        </div>
        ${qrDataUrl ? `
          <div style="text-align:center;">
            <img src="${qrDataUrl}" style="width:90px;height:90px;" alt="QR Verifactu">
            <div style="font-size:9px;color:#94a3b8;margin-top:3px;">Verificar en AEAT</div>
          </div>` : ''}
      </div>
    </div>
  `;
}

function generatePDFDocument(invoice, items, business, qrDataUrl = null) {
  const tpl = getTemplateVars(business.invoice_template);
  const logoHtml = business.logo
    ? `<img src="${business.logo}" style="max-width:160px;max-height:80px;object-fit:contain;" alt="Logo">`
    : '';

  const businessInfo = [
    business.nif ? `NIF: ${escapeHtml(business.nif)}` : '',
    business.address ? escapeHtml(business.address) : '',
    business.extra_info ? escapeHtml(business.extra_info) : ''
  ].filter(Boolean).join('<br>');

  const clientInfo = [
    invoice.client_nif ? `NIF: ${escapeHtml(invoice.client_nif)}` : '',
    invoice.client_address ? escapeHtml(invoice.client_address) : ''
  ].filter(Boolean).join('<br>');

  const itemsRows = items.map(item => `
    <tr>
      <td style="padding:11px 14px;border-bottom:1px solid #f1f5f9;color:#1e293b;">${escapeHtml(item.service_name)}</td>
      <td style="padding:11px 14px;border-bottom:1px solid #f1f5f9;color:#64748b;font-size:12px;">${escapeHtml(item.description || '')}</td>
      <td style="padding:11px 14px;border-bottom:1px solid #f1f5f9;text-align:center;">${item.quantity}</td>
      <td style="padding:11px 14px;border-bottom:1px solid #f1f5f9;text-align:right;">${formatCurrency(item.unit_price)}</td>
      <td style="padding:11px 14px;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:600;">${formatCurrency(item.total)}</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Factura ${escapeHtml(invoice.invoice_number)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', sans-serif;
      font-size: 14px;
      color: #1e293b;
      background: white;
      padding: 40px;
    }
  </style>
</head>
<body>
  <!-- Header -->
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:36px;padding-bottom:24px;border-bottom:2px solid ${tpl.accent};">
    <div>
      ${logoHtml}
      ${business.name ? `<div style="font-size:18px;font-weight:700;color:#1e293b;margin-top:${business.logo ? '10px' : '0'}">${escapeHtml(business.name)}</div>` : ''}
      <div style="font-size:12px;color:#64748b;line-height:1.7;margin-top:4px;">${businessInfo}</div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:32px;font-weight:800;color:${tpl.titleLabel};letter-spacing:-1px;margin-bottom:6px;">FACTURA</div>
      <div style="font-size:16px;font-weight:600;color:#1e293b;margin-bottom:4px;">${escapeHtml(invoice.invoice_number)}</div>
      <div style="font-size:13px;color:#64748b;">${formatDate(invoice.date)}</div>
    </div>
  </div>

  <!-- Parties -->
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;margin-bottom:32px;">
    <div>
      <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;color:#94a3b8;margin-bottom:8px;">Factura de</div>
      <div style="font-size:15px;font-weight:700;color:#1e293b;margin-bottom:4px;">${escapeHtml(business.name || 'Mi empresa')}</div>
      <div style="font-size:12px;color:#64748b;line-height:1.7;">${businessInfo}</div>
    </div>
    <div>
      <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.08em;font-weight:600;color:#94a3b8;margin-bottom:8px;">Facturado a</div>
      <div style="font-size:15px;font-weight:700;color:#1e293b;margin-bottom:4px;">${escapeHtml(invoice.client_name || 'Cliente')}</div>
      <div style="font-size:12px;color:#64748b;line-height:1.7;">${clientInfo}</div>
    </div>
  </div>

  <!-- Items table -->
  <table style="width:100%;border-collapse:collapse;margin-bottom:24px;font-size:13px;">
    <thead>
      <tr>
        <th style="background:${tpl.accent};color:white;padding:10px 14px;text-align:left;font-weight:600;font-size:11.5px;text-transform:uppercase;letter-spacing:0.05em;">Concepto</th>
        <th style="background:${tpl.accent};color:white;padding:10px 14px;text-align:left;font-weight:600;font-size:11.5px;text-transform:uppercase;letter-spacing:0.05em;">Descripción</th>
        <th style="background:${tpl.accent};color:white;padding:10px 14px;text-align:center;font-weight:600;font-size:11.5px;text-transform:uppercase;letter-spacing:0.05em;width:60px;">Cant.</th>
        <th style="background:${tpl.accent};color:white;padding:10px 14px;text-align:right;font-weight:600;font-size:11.5px;text-transform:uppercase;letter-spacing:0.05em;width:110px;">Precio unit.</th>
        <th style="background:${tpl.accent};color:white;padding:10px 14px;text-align:right;font-weight:600;font-size:11.5px;text-transform:uppercase;letter-spacing:0.05em;width:110px;">Total</th>
      </tr>
    </thead>
    <tbody>
      ${itemsRows}
    </tbody>
  </table>

  <!-- Totals -->
  <div style="margin-left:auto;width:280px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
    <div style="display:flex;justify-content:space-between;padding:10px 16px;font-size:13px;border-bottom:1px solid #e2e8f0;color:#64748b;">
      <span>Subtotal</span>
      <span>${formatCurrency(invoice.subtotal)}</span>
    </div>
    ${invoice.tax_rate > 0 ? `
    <div style="display:flex;justify-content:space-between;padding:10px 16px;font-size:13px;border-bottom:1px solid #e2e8f0;color:#64748b;">
      <span>IVA (${invoice.tax_rate}%)</span>
      <span>${formatCurrency(invoice.tax_amount)}</span>
    </div>` : ''}
    ${invoice.irpf_rate > 0 ? `
    <div style="display:flex;justify-content:space-between;padding:10px 16px;font-size:13px;border-bottom:1px solid #e2e8f0;color:#ef4444;">
      <span>IRPF (${invoice.irpf_rate}%)</span>
      <span>−${formatCurrency(invoice.irpf_amount)}</span>
    </div>` : ''}
    <div style="display:flex;justify-content:space-between;padding:12px 16px;font-size:15px;font-weight:700;background:${tpl.accent};color:white;">
      <span>TOTAL</span>
      <span>${formatCurrency(invoice.total)}</span>
    </div>
  </div>

  ${invoice.notes ? `
    <div style="margin-top:32px;padding:16px;background:#f8fafc;border-radius:8px;border-left:3px solid ${tpl.accent};">
      <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:#94a3b8;margin-bottom:6px;">Notas</div>
      <div style="font-size:13px;color:#64748b;line-height:1.6;">${escapeHtml(invoice.notes)}</div>
    </div>
  ` : ''}
  <div style="display:flex;align-items:flex-end;gap:24px;margin-top:24px;">
    <div style="flex:1;">
      ${business.iban ? `
        <div style="padding:14px 16px;background:${tpl.accentLight};border-radius:8px;border-left:3px solid ${tpl.accent};">
          <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:#94a3b8;margin-bottom:4px;">Datos de pago</div>
          <div style="font-size:13px;color:#1e293b;">IBAN: <strong>${escapeHtml(business.iban)}</strong></div>
        </div>` : ''}
    </div>
    ${qrDataUrl ? `
      <div style="text-align:center;flex-shrink:0;">
        <img src="${qrDataUrl}" style="width:90px;height:90px;display:block;" alt="QR Verifactu">
        <div style="font-size:9px;color:#94a3b8;margin-top:3px;">Verificar en AEAT</div>
      </div>` : ''}
  </div>
</body>
</html>`;
}
