// ─── Expenses Page ─────────────────────────────────────────────────────────────

const EXPENSE_CATEGORIES = {
  SEG_SOCIAL:        { label: 'Seguridad Social',        desc: 'Cuotas autónomo',                               color: '#dc2626', bg: '#fee2e2', rentaLabel: 'Seguridad Social a cargo del empresario' },
  ARRENDAMIENTOS:    { label: 'Arrendamientos',          desc: 'Local, despacho, alquiler de espacio',          color: '#7c3aed', bg: '#ede9fe', rentaLabel: 'Arrendamientos y cánones' },
  SUMINISTROS:       { label: 'Suministros',             desc: 'Luz, agua, internet, teléfono',                 color: '#2563eb', bg: '#dbeafe', rentaLabel: 'Suministros' },
  SERVICIOS_PROF:    { label: 'Servicios profesionales', desc: 'Gestoría, abogados, consultores',               color: '#0891b2', bg: '#e0f2fe', rentaLabel: 'Servicios de profesionales independientes' },
  MATERIAL_OFICINA:  { label: 'Material de oficina',     desc: 'Papelería, material de trabajo',                color: '#059669', bg: '#dcfce7', rentaLabel: 'Consumos de explotación' },
  FORMACION:         { label: 'Formación',               desc: 'Cursos, libros, revistas profesionales',        color: '#65a30d', bg: '#f0fdf4', rentaLabel: 'Otros gastos deducibles (Formación)' },
  SEGUROS:           { label: 'Seguros',                 desc: 'RC, local, equipos profesionales',              color: '#d97706', bg: '#fef3c7', rentaLabel: 'Otros servicios exteriores (Seguros)' },
  PUBLICIDAD:        { label: 'Publicidad',              desc: 'Web, redes sociales, publicidad',               color: '#db2777', bg: '#fce7f3', rentaLabel: 'Publicidad y relaciones públicas' },
  REPARACIONES:      { label: 'Reparaciones',            desc: 'Mantenimiento y reparaciones',                  color: '#64748b', bg: '#f1f5f9', rentaLabel: 'Reparaciones y conservación' },
  GASTOS_FINANCIEROS:{ label: 'Gastos financieros',      desc: 'Intereses, comisiones bancarias',               color: '#9333ea', bg: '#f3e8ff', rentaLabel: 'Gastos financieros' },
  AMORTIZACIONES:    { label: 'Amortizaciones',          desc: 'Equipos, mobiliario, inmovilizado',             color: '#6b7280', bg: '#f3f4f6', rentaLabel: 'Amortizaciones' },
  TRIBUTOS:          { label: 'Tributos',                desc: 'Tasas, licencias, impuestos deducibles',        color: '#b45309', bg: '#fef9c3', rentaLabel: 'Tributos fiscalmente deducibles' },
  OTROS:             { label: 'Otros gastos',            desc: 'Otros gastos deducibles no clasificados',       color: '#475569', bg: '#f8fafc', rentaLabel: 'Otros gastos deducibles' },
};

let expensesData = [];
let expensesYear = new Date().getFullYear();
let expenseFilterCat = '';
let expenseFilterQ = '';
let expenseEditingId = null;
let expensePendingDoc = null;   // newly selected doc filename (not yet saved)
let expenseOriginalDoc = null;  // doc that was already saved (edit mode)

function categoryBadge(catKey) {
  const cat = EXPENSE_CATEGORIES[catKey] || { label: catKey, color: '#475569', bg: '#f8fafc' };
  return `<span class="expense-category-badge" style="background:${cat.bg};color:${cat.color};">${escapeHtml(cat.label)}</span>`;
}

function expenseQuarter(dateStr) {
  const m = parseInt((dateStr || '').slice(5, 7));
  if (m <= 3) return 'T1';
  if (m <= 6) return 'T2';
  if (m <= 9) return 'T3';
  return 'T4';
}

function getFilteredExpenses() {
  return expensesData.filter(e => {
    if (expenseFilterCat && e.category !== expenseFilterCat) return false;
    if (expenseFilterQ && expenseQuarter(e.date) !== expenseFilterQ) return false;
    return true;
  });
}

async function renderExpenses(container) {
  expensesYear = new Date().getFullYear();
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Gastos</h1>
        <p class="page-subtitle">Gastos deducibles para Modelo 130 y Declaración de la Renta</p>
      </div>
      <div style="display:flex;align-items:center;gap:10px;">
        <label style="font-size:13px;color:var(--text-secondary);">Año:</label>
        <select class="year-select" id="expenses-year-select">${generateYearOptions(expensesYear)}</select>
        <button class="btn btn-primary" id="new-expense-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Nuevo gasto
        </button>
      </div>
    </div>

    <div class="card">
      <div class="card-header" style="flex-wrap:wrap;gap:8px;">
        <div class="toolbar" style="margin-bottom:0;flex:1;flex-wrap:wrap;">
          <select class="sort-select" id="expense-filter-cat" style="min-width:180px;">
            <option value="">Todas las categorías</option>
            ${Object.entries(EXPENSE_CATEGORIES).map(([k,v]) => `<option value="${k}">${escapeHtml(v.label)}</option>`).join('')}
          </select>
          <select class="sort-select" id="expense-filter-q">
            <option value="">Todos los trimestres</option>
            <option value="T1">T1 (Ene-Mar)</option>
            <option value="T2">T2 (Abr-Jun)</option>
            <option value="T3">T3 (Jul-Sep)</option>
            <option value="T4">T4 (Oct-Dic)</option>
          </select>
          <span id="expense-count" style="font-size:13px;color:var(--text-secondary);"></span>
        </div>
      </div>
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Categoría</th>
              <th>Descripción</th>
              <th>Proveedor</th>
              <th class="text-right">Base</th>
              <th class="text-right">IVA</th>
              <th class="text-right">Deducible</th>
              <th style="width:60px;text-align:center;">Doc.</th>
              <th style="width:100px;"></th>
            </tr>
          </thead>
          <tbody id="expenses-tbody">
            <tr><td colspan="9"><div class="loading"><div class="spinner"></div>Cargando...</div></td></tr>
          </tbody>
        </table>
      </div>
      <div id="expenses-totals" style="display:flex;gap:24px;padding:12px 16px;border-top:1px solid var(--border);font-size:13px;flex-wrap:wrap;"></div>
    </div>
  `;

  document.getElementById('new-expense-btn').addEventListener('click', () => openExpenseModal());
  document.getElementById('expenses-year-select').addEventListener('change', async e => {
    expensesYear = parseInt(e.target.value);
    await loadExpenses();
  });
  document.getElementById('expense-filter-cat').addEventListener('change', e => {
    expenseFilterCat = e.target.value;
    renderExpensesTable();
  });
  document.getElementById('expense-filter-q').addEventListener('change', e => {
    expenseFilterQ = e.target.value;
    renderExpensesTable();
  });

  await loadExpenses();
}

async function loadExpenses() {
  expensesData = await window.api.expenses.getByYear(expensesYear);
  renderExpensesTable();
}

function renderExpensesTable() {
  const tbody = document.getElementById('expenses-tbody');
  const totalsEl = document.getElementById('expenses-totals');
  const countEl = document.getElementById('expense-count');
  if (!tbody) return;

  const filtered = getFilteredExpenses();

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:32px;color:var(--text-secondary);font-size:13px;">
      Sin gastos en ${expensesYear}${expenseFilterCat || expenseFilterQ ? ' para el filtro seleccionado' : ''}
    </td></tr>`;
    if (totalsEl) totalsEl.innerHTML = '';
    if (countEl) countEl.textContent = '';
    return;
  }

  if (countEl) countEl.textContent = `${filtered.length} gasto${filtered.length !== 1 ? 's' : ''}`;

  tbody.innerHTML = filtered.map(e => {
    const docBtn = e.pdf_file
      ? `<button class="expense-doc-btn" onclick="openExpenseDoc('${escapeHtml(e.pdf_file)}')" title="Abrir documento">
           <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
         </button>`
      : `<span style="color:var(--text-secondary);font-size:11px;">—</span>`;
    return `<tr>
      <td style="white-space:nowrap;">${formatDate(e.date)}</td>
      <td>${categoryBadge(e.category)}</td>
      <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtml(e.description)}">${escapeHtml(e.description)}</td>
      <td style="color:var(--text-secondary);font-size:12px;">${escapeHtml(e.provider || '—')}</td>
      <td class="text-right">${formatCurrency(e.amount)}</td>
      <td class="text-right" style="color:var(--text-secondary);">${e.iva_rate > 0 ? formatCurrency(e.iva_amount) : '—'}</td>
      <td class="text-right" style="font-weight:500;">${e.deductible_pct < 100 ? `<span style="color:#7c3aed;">${formatCurrency(e.deductible_amount)}</span><span style="font-size:10.5px;color:var(--text-secondary);margin-left:3px;">(${e.deductible_pct}%)</span>` : formatCurrency(e.deductible_amount)}</td>
      <td style="text-align:center;">${docBtn}</td>
      <td>
        <div class="table-actions">
          <button class="btn btn-ghost btn-sm btn-icon" title="Editar" onclick="openExpenseModal(${e.id})">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="btn btn-ghost btn-sm btn-icon danger" title="Eliminar" onclick="deleteExpense(${e.id})">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          </button>
        </div>
      </td>
    </tr>`;
  }).join('');

  // Totals footer
  const totalBase = filtered.reduce((s, e) => s + (e.amount || 0), 0);
  const totalIva  = filtered.reduce((s, e) => s + (e.iva_amount || 0), 0);
  const totalDed  = filtered.reduce((s, e) => s + (e.deductible_amount || 0), 0);
  if (totalsEl) {
    totalsEl.innerHTML = `
      <span style="color:var(--text-secondary);">Base total: <strong style="color:var(--text-primary);">${formatCurrency(totalBase)}</strong></span>
      <span style="color:var(--text-secondary);">IVA soportado: <strong style="color:#2563eb;">${formatCurrency(totalIva)}</strong></span>
      <span style="color:var(--text-secondary);">Importe deducible: <strong style="color:#059669;">${formatCurrency(totalDed)}</strong></span>
    `;
  }
}

function openExpenseDoc(fileName) {
  window.api.expenses.openDoc(fileName);
}

async function openExpenseModal(id = null) {
  expenseEditingId = id;
  expensePendingDoc = null;
  expenseOriginalDoc = null;

  let expense = null;
  if (id) {
    expense = await window.api.expenses.getById(id);
    expenseOriginalDoc = expense.pdf_file || null;
  }

  const title = id ? 'Editar gasto' : 'Nuevo gasto';
  const v = expense || {};

  const categoryOptions = Object.entries(EXPENSE_CATEGORIES).map(([k, cat]) =>
    `<option value="${k}" ${v.category === k ? 'selected' : ''}>${escapeHtml(cat.label)} — ${escapeHtml(cat.desc)}</option>`
  ).join('');

  const ivaOptions = [0, 4, 10, 21].map(r =>
    `<option value="${r}" ${(v.iva_rate || 0) == r ? 'selected' : ''}>${r}%</option>`
  ).join('');

  const docHtml = expenseOriginalDoc
    ? `<div id="expense-doc-preview" style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--radius);margin-bottom:8px;">
         <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:#2563eb;flex-shrink:0;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
         <span style="font-size:13px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(expenseOriginalDoc)}</span>
         <button type="button" class="btn btn-ghost btn-sm" onclick="expenseOpenCurrentDoc()">Abrir</button>
         <button type="button" class="btn btn-ghost btn-sm" style="color:var(--danger);" onclick="expenseRemoveDoc()">Quitar</button>
       </div>`
    : `<div id="expense-doc-preview" style="display:none;margin-bottom:8px;"></div>`;

  const html = `
    <form id="expense-form">
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Fecha <span class="required">*</span></label>
          <input type="date" class="form-control" id="exp-date" value="${v.date || new Date().toISOString().slice(0,10)}" required>
        </div>
        <div class="form-group">
          <label class="form-label">Categoría fiscal <span class="required">*</span></label>
          <select class="form-control" id="exp-category">${categoryOptions}</select>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Descripción <span class="required">*</span></label>
        <input type="text" class="form-control" id="exp-description" value="${escapeHtml(v.description || '')}" placeholder="Ej: Cuota autónomo enero" autofocus>
      </div>
      <div class="form-row-3">
        <div class="form-group">
          <label class="form-label">Proveedor</label>
          <input type="text" class="form-control" id="exp-provider" value="${escapeHtml(v.provider || '')}" placeholder="Nombre del proveedor">
        </div>
        <div class="form-group">
          <label class="form-label">NIF proveedor</label>
          <input type="text" class="form-control" id="exp-provider-nif" value="${escapeHtml(v.provider_nif || '')}" placeholder="A12345678">
        </div>
        <div class="form-group">
          <label class="form-label">Nº factura proveedor</label>
          <input type="text" class="form-control" id="exp-invoice-number" value="${escapeHtml(v.invoice_number || '')}" placeholder="Nº de la factura recibida">
        </div>
      </div>
      <div class="form-row-3">
        <div class="form-group">
          <label class="form-label">Base imponible (€) <span class="required">*</span></label>
          <input type="number" class="form-control" id="exp-amount" value="${v.amount || ''}" placeholder="0.00" step="0.01" min="0">
        </div>
        <div class="form-group">
          <label class="form-label">IVA</label>
          <select class="form-control" id="exp-iva-rate">${ivaOptions}</select>
        </div>
        <div class="form-group">
          <label class="form-label" style="display:flex;align-items:center;gap:6px;">
            % Deducible
            <button type="button" onclick="showDeductibleInfo()" style="display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:50%;border:1.5px solid var(--text-secondary);background:none;cursor:pointer;color:var(--text-secondary);font-size:10px;font-weight:700;line-height:1;padding:0;flex-shrink:0;" title="Ver guía de porcentajes deducibles">?</button>
          </label>
          <input type="number" class="form-control" id="exp-deductible-pct" value="${v.deductible_pct !== undefined ? v.deductible_pct : 100}" min="0" max="100" step="1">
        </div>
      </div>
      <div id="exp-calc-preview" style="display:flex;gap:20px;padding:10px 14px;background:var(--bg-secondary);border-radius:var(--radius);border:1px solid var(--border);font-size:13px;margin-bottom:16px;">
        <span style="color:var(--text-secondary);">IVA: <strong id="exp-preview-iva" style="color:var(--text-primary);">—</strong></span>
        <span style="color:var(--text-secondary);">Total: <strong id="exp-preview-total" style="color:var(--text-primary);">—</strong></span>
        <span style="color:var(--text-secondary);">Deducible: <strong id="exp-preview-ded" style="color:#059669;">—</strong></span>
      </div>
      <div class="form-group">
        <label class="form-label">Factura del proveedor (PDF / imagen)</label>
        ${docHtml}
        <button type="button" class="btn btn-secondary btn-sm" id="exp-attach-btn" onclick="expenseSelectDoc()">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
          Adjuntar factura
        </button>
      </div>
      <div class="form-group">
        <label class="form-label">Notas</label>
        <textarea class="form-control" id="exp-notes" rows="2" placeholder="Observaciones opcionales">${escapeHtml(v.notes || '')}</textarea>
      </div>
    </form>
    <div class="modal-footer">
      <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
      <button type="button" class="btn btn-primary" id="exp-save-btn" onclick="saveExpense()">
        ${id ? 'Guardar cambios' : 'Crear gasto'}
      </button>
    </div>
  `;

  openModal(title, html, { size: 'lg' });

  // Live preview calculations
  ['exp-amount', 'exp-iva-rate', 'exp-deductible-pct'].forEach(inputId => {
    const el = document.getElementById(inputId);
    if (el) el.addEventListener('input', updateExpensePreview);
  });
  updateExpensePreview();

  // Show/hide attach button when doc is already set
  updateExpenseDocUI();
}

function updateExpensePreview() {
  const amount = parseFloat(document.getElementById('exp-amount')?.value || 0) || 0;
  const ivaRate = parseFloat(document.getElementById('exp-iva-rate')?.value || 0) || 0;
  const dedPct = parseFloat(document.getElementById('exp-deductible-pct')?.value || 100) || 0;
  const ivaAmt = amount * ivaRate / 100;
  const total = amount + ivaAmt;
  const ded = amount * dedPct / 100;
  const p = document.getElementById('exp-preview-iva');
  const pt = document.getElementById('exp-preview-total');
  const pd = document.getElementById('exp-preview-ded');
  if (p) p.textContent = formatCurrency(ivaAmt);
  if (pt) pt.textContent = formatCurrency(total);
  if (pd) pd.textContent = formatCurrency(ded);
}

function updateExpenseDocUI() {
  const preview = document.getElementById('expense-doc-preview');
  const attachBtn = document.getElementById('exp-attach-btn');
  const hasDoc = expensePendingDoc || expenseOriginalDoc;
  if (attachBtn) attachBtn.style.display = hasDoc ? 'none' : '';
  if (preview) preview.style.display = hasDoc ? '' : 'none';
}

async function expenseSelectDoc() {
  const fileName = await window.api.expenses.selectDoc();
  if (!fileName) return;
  expensePendingDoc = fileName;
  const preview = document.getElementById('expense-doc-preview');
  if (preview) {
    preview.style.display = '';
    preview.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;padding:8px 12px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--radius);">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:#2563eb;flex-shrink:0;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        <span style="font-size:13px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(fileName)}</span>
        <button type="button" class="btn btn-ghost btn-sm" style="color:var(--danger);" onclick="expenseRemoveDoc()">Quitar</button>
      </div>
    `;
  }
  const attachBtn = document.getElementById('exp-attach-btn');
  if (attachBtn) attachBtn.style.display = 'none';
}

function expenseOpenCurrentDoc() {
  const doc = expensePendingDoc || expenseOriginalDoc;
  if (doc) window.api.expenses.openDoc(doc);
}

function expenseRemoveDoc() {
  // If there's a pending (new) doc that hasn't been saved yet, delete it from disk
  if (expensePendingDoc) {
    window.api.expenses.deleteDoc(expensePendingDoc);
    expensePendingDoc = null;
  } else {
    // Mark original doc for removal on save
    expenseOriginalDoc = '__remove__';
  }
  const preview = document.getElementById('expense-doc-preview');
  if (preview) { preview.innerHTML = ''; preview.style.display = 'none'; }
  const attachBtn = document.getElementById('exp-attach-btn');
  if (attachBtn) attachBtn.style.display = '';
}

async function saveExpense() {
  const date = document.getElementById('exp-date')?.value;
  const description = document.getElementById('exp-description')?.value?.trim();
  const category = document.getElementById('exp-category')?.value;
  const amount = parseFloat(document.getElementById('exp-amount')?.value || 0);

  if (!date || !description || !category || !amount) {
    showToast('Completa los campos obligatorios (fecha, categoría, descripción, importe)', 'error');
    return;
  }

  const iva_rate = parseFloat(document.getElementById('exp-iva-rate')?.value || 0);
  const deductible_pct = parseFloat(document.getElementById('exp-deductible-pct')?.value || 100);
  const provider = document.getElementById('exp-provider')?.value?.trim() || '';
  const provider_nif = document.getElementById('exp-provider-nif')?.value?.trim() || '';
  const invoice_number = document.getElementById('exp-invoice-number')?.value?.trim() || '';
  const notes = document.getElementById('exp-notes')?.value?.trim() || '';

  // Resolve pdf_file
  let pdf_file = '';
  if (expensePendingDoc) {
    pdf_file = expensePendingDoc;
    // If editing and original doc exists, delete the old one
    if (expenseEditingId && expenseOriginalDoc && expenseOriginalDoc !== '__remove__') {
      await window.api.expenses.deleteDoc(expenseOriginalDoc);
    }
  } else if (expenseOriginalDoc === '__remove__') {
    // User removed the doc; delete from disk
    const orig = (await window.api.expenses.getById(expenseEditingId))?.pdf_file;
    if (orig) await window.api.expenses.deleteDoc(orig);
    pdf_file = '';
  } else if (expenseEditingId && expenseOriginalDoc) {
    pdf_file = expenseOriginalDoc;
  }

  const data = { date, description, category, provider, provider_nif, invoice_number, amount, iva_rate, deductible_pct, pdf_file, notes };

  const btn = document.getElementById('exp-save-btn');
  if (btn) btn.disabled = true;

  try {
    if (expenseEditingId) {
      await window.api.expenses.update(expenseEditingId, data);
      showToast('Gasto actualizado correctamente', 'success');
    } else {
      await window.api.expenses.create(data);
      showToast('Gasto creado correctamente', 'success');
    }
    closeModal();
    await loadExpenses();
  } catch (err) {
    showToast('Error al guardar el gasto: ' + err.message, 'error');
    if (btn) btn.disabled = false;
  }
}

async function deleteExpense(id) {
  const confirmed = await showConfirm('Eliminar gasto', '¿Eliminar este gasto? Esta acción no se puede deshacer.', 'Eliminar');
  if (!confirmed) return;
  // Also delete associated document if any
  const expense = expensesData.find(e => e.id === id);
  if (expense && expense.pdf_file) {
    await window.api.expenses.deleteDoc(expense.pdf_file);
  }
  await window.api.expenses.delete(id);
  showToast('Gasto eliminado', 'success');
  await loadExpenses();
}

// ─── Guía de porcentajes deducibles ────────────────────────────────────────────

function showDeductibleInfo() {
  // Remove existing panel if any
  document.getElementById('deductible-info-panel')?.remove();

  const rows = [
    { tipo: 'Cuotas autónomo (Seguridad Social)', pct: '100%', nota: 'Totalmente deducibles. Art. 30.2.1ª LIRPF.' },
    { tipo: 'Alquiler de local <em>exclusivamente</em> profesional', pct: '100%', nota: 'El local no puede tener ningún uso personal.' },
    { tipo: 'Suministros en local profesional (luz, agua…)', pct: '100%', nota: 'Si el local es de uso exclusivo profesional.' },
    { tipo: 'Seguro de responsabilidad civil profesional', pct: '100%', nota: 'Directamente vinculado a la actividad.' },
    { tipo: 'Formación relacionada con la actividad', pct: '100%', nota: 'Cursos, libros, congresos del sector.' },
    { tipo: 'Publicidad, marketing, web', pct: '100%', nota: 'Si es para la actividad profesional.' },
    { tipo: 'Gestoría, asesoría, servicios profesionales', pct: '100%', nota: 'Siempre que sean para la actividad.' },
    { tipo: 'Reparaciones de equipos / local profesional', pct: '100%', nota: 'Solo sobre el espacio o equipo profesional.' },
    { tipo: 'Material de oficina de uso exclusivo', pct: '100%', nota: 'Papelería, cartuchos, etc.' },
    { tipo: '─────────── USO MIXTO ───────────', pct: '', nota: '', separator: true },
    { tipo: 'Alquiler/hipoteca del domicilio (despacho en casa)', pct: 'Proporcional', nota: '% de m² profesionales / m² totales. Ej: 10m² de 80m² = 12,5%.' },
    { tipo: 'Suministros del domicilio (luz, agua, gas, internet)', pct: '30% × m²%', nota: 'Fórmula legal: 30% × (m² profesionales / m² totales). Art. 30.2.5ª LIRPF. Ej: 10m² de 80m² → 30% × 12,5% = 3,75%.' },
    { tipo: 'Teléfono / internet (línea mixta)', pct: '50%', nota: 'Hacienda acepta 50% sin necesidad de justificar. Si la línea es exclusivamente profesional → 100%.' },
    { tipo: 'Ordenador / tablet (uso mixto)', pct: '50–100%', nota: 'Proporcional al uso profesional real. Hacienda acepta 50% como criterio general.' },
    { tipo: 'Seguro de salud (autónomo)', pct: 'Hasta 500€/año', nota: 'Deducción especial: 500€ por el autónomo + 500€ por cónyuge + 500€ por cada hijo <25 años. Art. 30.2.5ª LIRPF.' },
    { tipo: 'Comidas de trabajo', pct: 'Límite diario', nota: 'Deben ser necesarias, pagadas con tarjeta y fuera del domicilio. Límite orientativo: 26,67€/día en España · 48,08€/día en el extranjero.' },
    { tipo: 'Vehículo turismo (uso mixto)', pct: '0% (IRPF)', nota: 'Hacienda no admite deducción parcial de turismos en IRPF salvo actividades específicas (transporte, viajantes…). Para IVA sí acepta 50%.' },
    { tipo: 'Ropa', pct: '0%', nota: 'La ropa de calle NO es deducible aunque se use en el trabajo. Solo deducible la ropa específicamente profesional (uniformes, EPI).' },
    { tipo: 'Gastos financieros (intereses, comisiones)', pct: '100%', nota: 'Si el préstamo o cuenta es para la actividad profesional.' },
    { tipo: '─────────── TRANSPORTE Y DESPLAZAMIENTOS ───────────', pct: '', nota: '', separator: true },
    { tipo: 'Transporte público (AVE, tren, autobús, metro, avión)', pct: '100%', nota: 'Si el desplazamiento es por motivo profesional (visita a cliente, formación, congreso…). Necesitas billete/factura. Los trayectos habituales casa-trabajo NO son deducibles.' },
    { tipo: 'Taxi / VTC (Uber, Cabify…)', pct: '100%', nota: 'Solo si el trayecto es por actividad profesional. Exige factura (no vale el recibo del datáfono).' },
    { tipo: 'Kilometraje en vehículo propio', pct: '0% (IRPF)', nota: 'Hacienda no admite deducir el coste por km del coche particular. Si el vehículo no es deducible en IRPF, tampoco lo son los desplazamientos en él.' },
    { tipo: 'Alojamiento (hotel) por viaje profesional', pct: '100%', nota: 'El coste real del alojamiento, con factura a nombre del autónomo. Sin límite fijo, debe ser razonable y proporcional a la actividad.' },
    { tipo: 'Dieta de manutención en viaje profesional', pct: 'Límite diario', nota: 'Criterio orientativo de Hacienda: 26,67€/día en España · 48,08€/día en el extranjero. Debe pagarse con tarjeta, fuera del municipio de la actividad habitual.' },
  ];

  const html = `
    <div id="deductible-info-panel" style="position:fixed;inset:0;z-index:2000;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(0,0,0,0.5);backdrop-filter:blur(2px);">
      <div style="background:var(--card-bg);border-radius:var(--radius-lg);box-shadow:var(--shadow-lg);width:100%;max-width:640px;max-height:82vh;display:flex;flex-direction:column;overflow:hidden;">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:18px 22px 14px;border-bottom:1px solid var(--border);">
          <div>
            <h2 style="font-size:15px;font-weight:700;margin:0;">Guía de porcentajes deducibles</h2>
            <p style="font-size:12px;color:var(--text-secondary);margin:3px 0 0;">Estimación Directa (Normal y Simplificada) · IRPF autónomos</p>
          </div>
          <button onclick="document.getElementById('deductible-info-panel').remove()" style="background:none;border:none;cursor:pointer;color:var(--text-secondary);padding:4px;border-radius:4px;display:flex;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div style="overflow-y:auto;padding:16px 22px;">
          <table style="width:100%;border-collapse:collapse;font-size:12.5px;">
            <thead>
              <tr style="background:var(--bg-secondary);">
                <th style="padding:7px 10px;text-align:left;font-weight:600;color:var(--text-secondary);font-size:11px;text-transform:uppercase;letter-spacing:.4px;width:40%;">Tipo de gasto</th>
                <th style="padding:7px 10px;text-align:center;font-weight:600;color:var(--text-secondary);font-size:11px;text-transform:uppercase;letter-spacing:.4px;width:16%;">% Deducible</th>
                <th style="padding:7px 10px;text-align:left;font-weight:600;color:var(--text-secondary);font-size:11px;text-transform:uppercase;letter-spacing:.4px;">Condiciones / Notas</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map(r => r.separator ? `
                <tr><td colspan="3" style="padding:10px 10px 4px;font-size:11px;font-weight:700;color:var(--text-secondary);letter-spacing:.5px;text-align:center;">${r.tipo}</td></tr>
              ` : `
                <tr style="border-top:1px solid var(--border);">
                  <td style="padding:8px 10px;font-weight:500;">${r.tipo}</td>
                  <td style="padding:8px 10px;text-align:center;">
                    <span style="font-weight:700;color:${r.pct === '0%' ? '#dc2626' : r.pct === '100%' ? '#059669' : '#d97706'};">${r.pct}</span>
                  </td>
                  <td style="padding:8px 10px;color:var(--text-secondary);font-size:12px;">${r.nota}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div style="margin-top:14px;padding:10px 14px;background:var(--bg-secondary);border-radius:var(--radius);border-left:3px solid #2563eb;font-size:12px;color:var(--text-secondary);line-height:1.6;">
            <strong style="color:var(--text-primary);">Consejo:</strong> En caso de duda, consulta con tu gestor/a. Los criterios de Hacienda pueden variar según la actividad y la documentación disponible. Guarda siempre las facturas originales.
          </div>
        </div>
        <div style="padding:12px 22px;border-top:1px solid var(--border);text-align:right;">
          <button class="btn btn-primary btn-sm" onclick="document.getElementById('deductible-info-panel').remove()">Cerrar</button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', html);

  // Close on backdrop click
  document.getElementById('deductible-info-panel').addEventListener('click', function(e) {
    if (e.target === this) this.remove();
  });
}
