// ─── Dashboard Page ────────────────────────────────────────────────────────────

async function renderDashboard(container) {
  const year = new Date().getFullYear();

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Dashboard</h1>
        <p class="page-subtitle">Resumen de tu actividad de facturación</p>
      </div>
      <div style="display:flex;align-items:center;gap:10px;">
        <label style="font-size:13px;color:var(--text-secondary);">Año:</label>
        <select class="year-select" id="dash-year-select">
          ${generateYearOptions(year)}
        </select>
      </div>
    </div>

    <div id="unpaid-warning" style="display:none;background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:12px 16px;margin-bottom:16px;color:#92400e;font-size:13.5px;"></div>

    <div class="stats-grid" id="stats-grid" style="grid-template-columns:repeat(5,1fr);">
      <div class="stat-card skeleton-card"><div class="loading"><div class="spinner"></div></div></div>
      <div class="stat-card skeleton-card"><div class="loading"><div class="spinner"></div></div></div>
      <div class="stat-card skeleton-card"><div class="loading"><div class="spinner"></div></div></div>
      <div class="stat-card skeleton-card"><div class="loading"><div class="spinner"></div></div></div>
      <div class="stat-card skeleton-card"><div class="loading"><div class="spinner"></div></div></div>
    </div>

    <div class="charts-grid">
      <div class="card">
        <div class="card-header"><span class="card-title">Ingresos mensuales</span></div>
        <div class="card-body" style="padding:16px;">
          <div class="chart-wrapper"><canvas id="bar-chart"></canvas></div>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">Evolución acumulada</span></div>
        <div class="card-body" style="padding:16px;">
          <div class="chart-wrapper"><canvas id="line-chart"></canvas></div>
        </div>
      </div>
    </div>

    <div class="card" style="margin-bottom:20px;" id="top-clients-card">
      <div class="card-header">
        <span class="card-title">Top clientes</span>
        <span id="top-clients-year-label" style="font-size:12px;color:var(--text-secondary);"></span>
      </div>
      <div class="card-body" style="padding:16px;">
        <div style="height:180px;"><canvas id="top-clients-chart"></canvas></div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 340px;gap:20px;align-items:start;">
      <div class="card">
        <div class="card-header">
          <span class="card-title">Últimas facturas</span>
          <button class="btn btn-secondary btn-sm" id="dash-view-all-btn">Ver todas</button>
        </div>
        <div class="table-wrapper">
          <table class="recent-invoices-table">
            <thead>
              <tr>
                <th>Número</th>
                <th>Fecha</th>
                <th>Cliente</th>
                <th class="text-right">Total</th>
              </tr>
            </thead>
            <tbody id="recent-invoices-body">
              <tr><td colspan="4"><div class="loading"><div class="spinner"></div>Cargando...</div></td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <span class="card-title">Actividad reciente</span>
        </div>
        <div id="activity-log-body" style="max-height:340px;overflow-y:auto;">
          <div class="loading"><div class="spinner"></div>Cargando...</div>
        </div>
      </div>
    </div>

    <div class="card" style="margin-bottom:20px;" id="year-comparison-card">
      <div class="card-header">
        <span class="card-title">Comparativa anual</span>
        <div style="display:flex;align-items:center;gap:10px;">
          <label style="font-size:12px;color:var(--text-secondary);">Comparar con:</label>
          <select class="year-select" id="dash-compare-year" style="font-size:12px;padding:4px 8px;">
            ${generateYearOptions(year - 1)}
          </select>
        </div>
      </div>
      <div class="card-body" style="padding:16px;">
        <div class="chart-wrapper"><canvas id="comparison-chart"></canvas></div>
      </div>
    </div>

    <div class="card" style="margin-top:20px;" id="fiscal-summary">
      <div class="loading" style="padding:20px;"><div class="spinner"></div>Cargando resumen fiscal...</div>
    </div>
  `;

  document.getElementById('dash-view-all-btn').addEventListener('click', () => {
    navigateTo('invoices');
  });

  await loadDashboardData(year);

  document.getElementById('dash-year-select').addEventListener('change', async (e) => {
    await loadDashboardData(parseInt(e.target.value));
  });
}

function generateYearOptions(currentYear) {
  const years = [];
  for (let y = currentYear; y >= currentYear - 5; y--) {
    years.push(`<option value="${y}" ${y === currentYear ? 'selected' : ''}>${y}</option>`);
  }
  return years.join('');
}

let barChart = null;
let lineChart = null;
let topClientsChart = null;
let comparisonChart = null;

async function loadDashboardData(year) {
  const compareYear = parseInt(document.getElementById('dash-compare-year')?.value || year - 1);
  const [stats, monthly, fiscal, topClients, docStats, comparison] = await Promise.all([
    window.api.dashboard.getStats(),
    window.api.dashboard.getMonthlyData(year),
    window.api.dashboard.getFiscalSummary(year),
    window.api.dashboard.getTopClients(year),
    window.api.dashboard.getDocumentStats(),
    window.api.dashboard.getYearComparison(year, compareYear)
  ]);

  renderStats(stats, docStats);
  renderUnpaidWarning(stats);
  renderCharts(monthly, year);
  renderTopClients(topClients, year);
  renderComparisonChart(comparison);
  renderFiscalSummary(fiscal, year);
  await Promise.all([loadRecentInvoices(), loadActivityLog()]);

  // Wire compare-year select after rendering
  document.getElementById('dash-compare-year')?.addEventListener('change', async (e) => {
    const selectedYear = parseInt(document.getElementById('dash-year-select')?.value || new Date().getFullYear());
    const cmp = await window.api.dashboard.getYearComparison(selectedYear, parseInt(e.target.value));
    renderComparisonChart(cmp);
  });
}

function renderComparisonChart(data) {
  const canvas = document.getElementById('comparison-chart');
  if (!canvas) return;
  if (comparisonChart) comparisonChart.destroy();

  const labels = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  comparisonChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: String(data.year1.year),
          data: data.year1.data,
          backgroundColor: 'rgba(37,99,235,0.8)',
          borderRadius: 4,
          borderSkipped: false
        },
        {
          label: String(data.year2.year),
          data: data.year2.data,
          backgroundColor: 'rgba(16,185,129,0.5)',
          borderRadius: 4,
          borderSkipped: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true, position: 'top', labels: { font: { size: 12 }, boxWidth: 12 } },
        tooltip: { callbacks: { label: (ctx) => ` ${ctx.dataset.label}: ${formatCurrency(ctx.parsed.y)}` } }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 11 } } },
        y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { font: { size: 11 }, callback: (v) => formatCurrency(v) } }
      }
    }
  });
}

function renderUnpaidWarning(stats) {
  const el = document.getElementById('unpaid-warning');
  if (!el) return;
  if (!stats.unpaidCount || stats.unpaidCount === 0) {
    el.style.display = 'none';
    return;
  }
  el.style.display = '';
  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0;color:#b45309;">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
      </svg>
      <div style="flex:1;">
        <strong>${stats.unpaidCount} factura${stats.unpaidCount > 1 ? 's' : ''} pendiente${stats.unpaidCount > 1 ? 's' : ''} de cobro</strong>
        <span style="margin-left:8px;color:#92400e;">· ${formatCurrency(stats.unpaidTotal)} por cobrar</span>
      </div>
      <button class="btn btn-sm" style="background:#b45309;color:#fff;border:none;" onclick="navigateTo('invoices')">Ver facturas</button>
    </div>
  `;
}

function renderFiscalSummary(quarters, year) {
  const el = document.getElementById('fiscal-summary');
  if (!el) return;
  const totalBase = quarters.reduce((s, q) => s + q.base, 0);
  const totalIva = quarters.reduce((s, q) => s + q.iva, 0);
  const totalIrpf = quarters.reduce((s, q) => s + q.irpf, 0);
  const hasData = totalBase > 0;

  el.innerHTML = `
    <div class="card-header">
      <span class="card-title">Resumen fiscal ${year}</span>
      <div style="display:flex;align-items:center;gap:10px;">
        <span style="font-size:12px;color:var(--text-secondary);">Modelo 130 / IVA trimestral</span>
        <div style="position:relative;" id="fiscal-export-wrapper">
          <button class="btn btn-secondary btn-sm" id="fiscal-export-toggle" style="display:flex;align-items:center;gap:5px;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Exportar
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <div id="fiscal-export-menu" style="display:none;position:absolute;right:0;top:calc(100% + 4px);background:var(--card-bg);border:1px solid var(--border);border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,.15);z-index:200;min-width:140px;overflow:hidden;">
            <button onclick="exportFiscalCSV(${year});document.getElementById('fiscal-export-menu').style.display='none';" style="display:flex;align-items:center;gap:8px;width:100%;padding:9px 14px;background:none;border:none;cursor:pointer;font-size:13px;color:var(--text-primary);text-align:left;" onmouseover="this.style.background='var(--content-bg)'" onmouseout="this.style.background='none'">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              CSV
            </button>
            <button onclick="exportFiscalExcel(${year});document.getElementById('fiscal-export-menu').style.display='none';" style="display:flex;align-items:center;gap:8px;width:100%;padding:9px 14px;background:none;border:none;cursor:pointer;font-size:13px;color:var(--text-primary);text-align:left;" onmouseover="this.style.background='var(--content-bg)'" onmouseout="this.style.background='none'">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/></svg>
              Excel
            </button>
            <button onclick="exportFiscalPDF(${year});document.getElementById('fiscal-export-menu').style.display='none';" style="display:flex;align-items:center;gap:8px;width:100%;padding:9px 14px;background:none;border:none;cursor:pointer;font-size:13px;color:var(--text-primary);text-align:left;" onmouseover="this.style.background='var(--content-bg)'" onmouseout="this.style.background='none'">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              PDF
            </button>
          </div>
        </div>
      </div>
    </div>
    <div class="card-body" style="padding:0;">
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="background:var(--bg-secondary);">
            <th style="padding:8px 16px;text-align:left;font-weight:600;color:var(--text-secondary);font-size:11px;text-transform:uppercase;letter-spacing:.5px;">Trimestre</th>
            <th style="padding:8px 12px;text-align:right;font-weight:600;color:var(--text-secondary);font-size:11px;">Facturas</th>
            <th style="padding:8px 12px;text-align:right;font-weight:600;color:var(--text-secondary);font-size:11px;">Base imponible</th>
            <th style="padding:8px 12px;text-align:right;font-weight:600;color:var(--text-secondary);font-size:11px;">IVA repercutido</th>
            <th style="padding:8px 16px;text-align:right;font-weight:600;color:var(--text-secondary);font-size:11px;">IRPF retenido</th>
          </tr>
        </thead>
        <tbody>
          ${quarters.map(q => `
            <tr style="border-top:1px solid var(--border);">
              <td style="padding:10px 16px;font-weight:600;">${q.label}</td>
              <td style="padding:10px 12px;text-align:right;color:var(--text-secondary);">${q.count}</td>
              <td style="padding:10px 12px;text-align:right;">${formatCurrency(q.base)}</td>
              <td style="padding:10px 12px;text-align:right;color:#2563eb;">${formatCurrency(q.iva)}</td>
              <td style="padding:10px 16px;text-align:right;color:#dc2626;">${q.irpf > 0 ? formatCurrency(q.irpf) : '<span style="color:var(--text-secondary)">-</span>'}</td>
            </tr>
          `).join('')}
        </tbody>
        <tfoot>
          <tr style="border-top:2px solid var(--border);background:var(--bg-secondary);">
            <td style="padding:10px 16px;font-weight:700;">Total ${year}</td>
            <td style="padding:10px 12px;text-align:right;font-weight:600;">${quarters.reduce((s,q)=>s+q.count,0)}</td>
            <td style="padding:10px 12px;text-align:right;font-weight:700;">${formatCurrency(totalBase)}</td>
            <td style="padding:10px 12px;text-align:right;font-weight:700;color:#2563eb;">${formatCurrency(totalIva)}</td>
            <td style="padding:10px 16px;text-align:right;font-weight:700;color:#dc2626;">${totalIrpf > 0 ? formatCurrency(totalIrpf) : '<span style="color:var(--text-secondary)">-</span>'}</td>
          </tr>
        </tfoot>
      </table>
      ${!hasData ? `<p style="text-align:center;color:var(--text-secondary);font-size:13px;padding:16px;">Sin facturas en ${year}</p>` : ''}
    </div>
  `;

  // Dropdown toggle
  const toggle = document.getElementById('fiscal-export-toggle');
  const menu   = document.getElementById('fiscal-export-menu');
  if (toggle && menu) {
    toggle.addEventListener('click', (e) => {
      e.stopPropagation();
      menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
    });
    document.addEventListener('click', () => { menu.style.display = 'none'; }, { capture: true, passive: true });
  }
}

async function exportFiscalExcel(year) {
  const result = await window.api.dashboard.exportFiscalExcel(year);
  if (result.success) showToast('Excel exportado correctamente', 'success');
}

async function exportFiscalPDF(year) {
  const result = await window.api.dashboard.exportFiscalPDF(year);
  if (result && result.success) showToast('PDF exportado correctamente', 'success');
  else if (result && result.reason !== 'cancelled') showToast('Error al exportar PDF', 'error');
}

const ACTION_META = {
  factura_creada:    { label: 'Factura creada',    color: '#2563eb', icon: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>' },
  email_enviado:     { label: 'Email enviado',      color: '#059669', icon: '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>' },
  pdf_exportado:     { label: 'PDF exportado',      color: '#7c3aed', icon: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>' },
  factura_eliminada: { label: 'Factura eliminada',  color: '#dc2626', icon: '<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>' },
  documento_enviado: { label: 'Documento enviado',  color: '#0891b2', icon: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/>' },
};

async function exportFiscalCSV(year) {
  const quarters = await window.api.dashboard.getFiscalSummary(year);
  const bom = '\uFEFF';
  const header = 'Trimestre,Facturas,Base imponible,IVA repercutido,IRPF retenido';
  const rows = quarters.map(q =>
    `${q.label},${q.count},${q.base.toFixed(2)},${q.iva.toFixed(2)},${q.irpf.toFixed(2)}`
  );
  const totalBase = quarters.reduce((s,q) => s+q.base, 0);
  const totalIva  = quarters.reduce((s,q) => s+q.iva,  0);
  const totalIrpf = quarters.reduce((s,q) => s+q.irpf, 0);
  const totalCount= quarters.reduce((s,q) => s+q.count,0);
  rows.push(`Total ${year},${totalCount},${totalBase.toFixed(2)},${totalIva.toFixed(2)},${totalIrpf.toFixed(2)}`);
  const csv = bom + [header, ...rows].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = `resumen-fiscal-${year}.csv`;
  a.click(); URL.revokeObjectURL(url);
  showToast('CSV exportado correctamente', 'success');
}

async function loadActivityLog() {
  const el = document.getElementById('activity-log-body');
  if (!el) return;
  try {
    const entries = await window.api.activityLog.getRecent(25);
    if (!entries || entries.length === 0) {
      el.innerHTML = `<p style="text-align:center;color:var(--text-secondary);font-size:13px;padding:20px;">Sin actividad aún</p>`;
      return;
    }
    el.innerHTML = entries.map(e => {
      const meta = ACTION_META[e.action_type] || { label: e.action_type, color: '#6b7280', icon: '<circle cx="12" cy="12" r="10"/>' };
      return `
        <div class="activity-entry">
          <div class="activity-icon" style="background:${meta.color}15;color:${meta.color};">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${meta.icon}</svg>
          </div>
          <div class="activity-content">
            <div class="activity-main">
              <span class="activity-action">${meta.label}</span>
              ${e.invoice_number ? `<span class="activity-invoice">${escapeHtml(e.invoice_number)}</span>` : ''}
            </div>
            ${e.client_name ? `<div class="activity-client">${escapeHtml(e.client_name)}</div>` : ''}
            ${e.details ? `<div class="activity-details">${escapeHtml(e.details)}</div>` : ''}
            <div class="activity-time">${timeAgo(e.created_at)}</div>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    el.innerHTML = `<p style="text-align:center;color:var(--text-secondary);font-size:13px;padding:20px;">Error al cargar actividad</p>`;
  }
}

function renderStats(stats, docStats) {
  const grid = document.getElementById('stats-grid');
  grid.innerHTML = `
    <div class="stat-card" style="cursor:pointer;" onclick="navigateTo('invoices')">
      <div class="stat-icon blue">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
        </svg>
      </div>
      <div class="stat-info">
        <div class="stat-value">${formatCurrency(stats.totalThisYear)}</div>
        <div class="stat-label">Facturado este año</div>
      </div>
    </div>
    <div class="stat-card" style="cursor:pointer;" onclick="navigateTo('invoices')">
      <div class="stat-icon green">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
        </svg>
      </div>
      <div class="stat-info">
        <div class="stat-value">${stats.totalInvoices}</div>
        <div class="stat-label">Total facturas</div>
      </div>
    </div>
    <div class="stat-card" style="cursor:pointer;" onclick="navigateTo('clients')">
      <div class="stat-icon purple">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
        </svg>
      </div>
      <div class="stat-info">
        <div class="stat-value">${stats.totalClients}</div>
        <div class="stat-label">Clientes</div>
      </div>
    </div>
    <div class="stat-card" style="cursor:pointer;" onclick="navigateTo('services')">
      <div class="stat-icon orange">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
          <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
        </svg>
      </div>
      <div class="stat-info">
        <div class="stat-value">${stats.totalServices}</div>
        <div class="stat-label">Servicios</div>
      </div>
    </div>
    <div class="stat-card" style="cursor:pointer;" onclick="navigateTo('documents')">
      <div class="stat-icon" style="background:#f0fdf4;color:#059669;">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/><line x1="12" y1="17" x2="8" y2="17"/>
        </svg>
      </div>
      <div class="stat-info">
        <div class="stat-value">${docStats ? docStats.total : 0}</div>
        <div class="stat-label">Documentos totales</div>
      </div>
    </div>
  `;
}

function renderTopClients(clients, year) {
  const el = document.getElementById('top-clients-year-label');
  if (el) el.textContent = year;
  const canvas = document.getElementById('top-clients-chart');
  if (!canvas) return;

  if (topClientsChart) topClientsChart.destroy();

  if (!clients || clients.length === 0) {
    canvas.parentElement.innerHTML = `<p style="text-align:center;color:var(--text-secondary);font-size:13px;padding:40px 0;">Sin datos para ${year}</p>`;
    return;
  }

  topClientsChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: clients.map(c => c.client_name || 'Sin nombre'),
      datasets: [{
        data: clients.map(c => c.total),
        backgroundColor: ['rgba(37,99,235,0.8)','rgba(16,185,129,0.8)','rgba(124,58,237,0.8)','rgba(245,158,11,0.8)','rgba(239,68,68,0.8)'],
        borderRadius: 5,
        borderSkipped: false
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx) => ` ${formatCurrency(ctx.parsed.x)} · ${clients[ctx.dataIndex].count} facturas` } }
      },
      scales: {
        x: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.04)' }, ticks: { font: { size: 11 }, callback: (v) => formatCurrency(v) } },
        y: { grid: { display: false }, ticks: { font: { size: 12 } } }
      }
    }
  });
}

function renderCharts(monthly, year) {
  const labels = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const data = monthly.map(m => m.total);

  // Accumulated data
  const accumulated = data.reduce((acc, val, i) => {
    acc.push((acc[i - 1] || 0) + val);
    return acc;
  }, []);

  // Bar chart
  const barCanvas = document.getElementById('bar-chart');
  if (barChart) barChart.destroy();

  barChart = new Chart(barCanvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: `Ingresos ${year}`,
        data,
        backgroundColor: 'rgba(37, 99, 235, 0.8)',
        borderRadius: 5,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${formatCurrency(ctx.parsed.y)}`
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { size: 11 } }
        },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(0,0,0,0.05)' },
          ticks: {
            font: { size: 11 },
            callback: (val) => formatCurrency(val)
          }
        }
      }
    }
  });

  // Line chart
  const lineCanvas = document.getElementById('line-chart');
  if (lineChart) lineChart.destroy();

  lineChart = new Chart(lineCanvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: `Acumulado ${year}`,
        data: accumulated,
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.08)',
        borderWidth: 2.5,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: '#10b981',
        pointRadius: 3,
        pointHoverRadius: 5
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${formatCurrency(ctx.parsed.y)}`
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { size: 11 } }
        },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(0,0,0,0.05)' },
          ticks: {
            font: { size: 11 },
            callback: (val) => formatCurrency(val)
          }
        }
      }
    }
  });
}

async function loadRecentInvoices() {
  const tbody = document.getElementById('recent-invoices-body');
  if (!tbody) return;

  try {
    const invoices = await window.api.invoices.getAll();
    const recent = invoices.slice(0, 8);

    if (recent.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="4" class="text-center text-muted" style="padding:24px;">
            No hay facturas aún. ¡Crea tu primera factura!
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = recent.map(inv => `
      <tr>
        <td><span class="badge badge-blue">${escapeHtml(inv.invoice_number)}</span></td>
        <td>${formatDate(inv.date)}</td>
        <td>${escapeHtml(inv.client_name || 'Sin cliente')}</td>
        <td class="text-right fw-bold">${formatCurrency(inv.total)}</td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-muted text-center" style="padding:20px;">Error al cargar facturas</td></tr>`;
  }
}
