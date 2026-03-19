// ─── Clients Page ──────────────────────────────────────────────────────────────

let clientsAllData = [];
let clientsFilteredData = [];
let clientsPage = 1;
const CLIENTS_PER_PAGE = 20;
let activeTagFilter = '';

const TAG_COLORS = [
  { bg: '#dbeafe', text: '#1d4ed8' },
  { bg: '#dcfce7', text: '#166534' },
  { bg: '#fce7f3', text: '#9d174d' },
  { bg: '#fef3c7', text: '#92400e' },
  { bg: '#ede9fe', text: '#5b21b6' },
  { bg: '#fee2e2', text: '#991b1b' },
  { bg: '#e0f2fe', text: '#0369a1' },
  { bg: '#f3f4f6', text: '#374151' },
];

function getTagColor(tag) {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) hash = tag.charCodeAt(i) + ((hash << 5) - hash);
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
}

function renderTagBadge(tag, removable = false) {
  const c = getTagColor(tag);
  if (removable) {
    return `<span class="client-tag" style="background:${c.bg};color:${c.text};" data-tag="${escapeHtml(tag)}">${escapeHtml(tag)}<button type="button" class="tag-remove-btn" data-tag="${escapeHtml(tag)}" style="background:none;border:none;cursor:pointer;color:${c.text};margin-left:3px;padding:0;font-size:11px;line-height:1;">×</button></span>`;
  }
  return `<span class="client-tag" style="background:${c.bg};color:${c.text};">${escapeHtml(tag)}</span>`;
}

function parseTags(tagsStr) {
  return (tagsStr || '').split(',').map(t => t.trim()).filter(Boolean);
}

async function renderClients(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Clientes</h1>
        <p class="page-subtitle">Gestiona tus clientes</p>
      </div>
      <button class="btn btn-primary" id="new-client-btn">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        Nuevo cliente
      </button>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="toolbar" style="margin-bottom:0;flex:1;">
          <div class="search-wrapper">
            <span class="search-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </span>
            <input type="text" class="search-input" id="client-search" placeholder="Buscar por nombre, NIF, email...">
          </div>
          <select class="sort-select" id="tag-filter-select" style="min-width:160px;">
            <option value="">Todas las etiquetas</option>
          </select>
          <span id="client-count" class="text-muted" style="font-size:13px;"></span>
        </div>
      </div>
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>NIF</th>
              <th>Email</th>
              <th>Teléfono</th>
              <th>Etiquetas</th>
              <th style="width:150px;"></th>
            </tr>
          </thead>
          <tbody id="clients-tbody">
            <tr><td colspan="6"><div class="loading"><div class="spinner"></div>Cargando...</div></td></tr>
          </tbody>
        </table>
      </div>
      <div id="clients-pagination"></div>
    </div>
  `;

  document.getElementById('new-client-btn').addEventListener('click', () => openClientModal());

  const searchInput = document.getElementById('client-search');
  searchInput.addEventListener('input', debounce((e) => {
    clientsPage = 1;
    filterAndRenderClients(e.target.value.trim());
  }, 200));

  await loadClients();
}

async function loadClients() {
  clientsAllData = await window.api.clients.getAll();
  clientsPage = 1;
  await populateTagSelect();
  filterAndRenderClients(document.getElementById('client-search')?.value.trim() || '');
}

async function populateTagSelect() {
  const sel = document.getElementById('tag-filter-select');
  if (!sel) return;
  const tags = await window.api.clients.getAllTags();
  const current = sel.value;
  sel.innerHTML = `<option value="">Todas las etiquetas</option>` +
    tags.map(t => `<option value="${escapeHtml(t)}" ${current === t ? 'selected' : ''}>${escapeHtml(t)}</option>`).join('');
  sel.addEventListener('change', (e) => {
    activeTagFilter = e.target.value;
    clientsPage = 1;
    filterAndRenderClients(document.getElementById('client-search')?.value.trim() || '');
  });
}

function filterAndRenderClients(query = '') {
  const q = query.toLowerCase();
  clientsFilteredData = q
    ? clientsAllData.filter(c =>
        c.name.toLowerCase().includes(q) ||
        (c.nif || '').toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q)
      )
    : [...clientsAllData];

  if (activeTagFilter) {
    clientsFilteredData = clientsFilteredData.filter(c =>
      parseTags(c.tags).includes(activeTagFilter)
    );
  }

  const countEl = document.getElementById('client-count');
  if (countEl) countEl.textContent = `${clientsFilteredData.length} cliente${clientsFilteredData.length !== 1 ? 's' : ''}`;

  const total = Math.ceil(clientsFilteredData.length / CLIENTS_PER_PAGE) || 1;
  const page = Math.min(clientsPage, total);
  const start = (page - 1) * CLIENTS_PER_PAGE;
  renderClientsTable(clientsFilteredData.slice(start, start + CLIENTS_PER_PAGE));
  renderPagination('clients-pagination', page, total, (p) => { clientsPage = p; filterAndRenderClients(document.getElementById('client-search')?.value.trim() || ''); });
}

function renderClientsTable(clients) {
  const tbody = document.getElementById('clients-tbody');
  if (!tbody) return;

  if (clients.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6">
          <div class="empty-state">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
            <p>No hay clientes. Crea el primero.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = clients.map(c => `
    <tr>
      <td class="fw-bold">${escapeHtml(c.name)}</td>
      <td>${escapeHtml(c.nif) || '<span class="text-muted">-</span>'}</td>
      <td>${escapeHtml(c.email) || '<span class="text-muted">-</span>'}</td>
      <td>${escapeHtml(c.phone) || '<span class="text-muted">-</span>'}</td>
      <td style="max-width:200px;">${parseTags(c.tags).map(t => renderTagBadge(t)).join(' ') || '<span class="text-muted">-</span>'}</td>
      <td>
        <div class="table-actions">
          <button class="btn btn-ghost btn-sm btn-icon" title="Ver historial" onclick="viewClientInvoices(${c.id}, '${escapeHtml(c.name).replace(/'/g, "\\'")}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          </button>
          <button class="btn btn-ghost btn-sm btn-icon" title="Editar" onclick="openClientModal(${c.id})">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button class="btn btn-ghost btn-sm btn-icon danger" title="Eliminar" onclick="deleteClient(${c.id}, '${escapeHtml(c.name).replace(/'/g, "\\'")}')">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              <path d="M10 11v6M14 11v6"/>
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
            </svg>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

async function openClientModal(id = null) {
  const isEdit = id !== null;
  let client = { name: '', nif: '', address: '', email: '', phone: '', notes: '', tags: '' };
  let modalTags = [];

  if (isEdit) {
    client = await window.api.clients.getById(id);
    modalTags = parseTags(client.tags);
  }

  const existingTagSuggestions = await window.api.clients.getAllTags();

  openModal(isEdit ? 'Editar cliente' : 'Nuevo cliente', `
    <form id="client-form">
      <div class="form-group">
        <label class="form-label">Nombre <span class="required">*</span></label>
        <input type="text" class="form-control" id="client-name" value="${escapeHtml(client.name)}" placeholder="Nombre completo" required autofocus>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">NIF / DNI</label>
          <input type="text" class="form-control" id="client-nif" value="${escapeHtml(client.nif || '')}" placeholder="12345678A">
        </div>
        <div class="form-group">
          <label class="form-label">Teléfono</label>
          <input type="text" class="form-control" id="client-phone" value="${escapeHtml(client.phone || '')}" placeholder="+34 600 000 000">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Email</label>
        <input type="email" class="form-control" id="client-email" value="${escapeHtml(client.email || '')}" placeholder="correo@ejemplo.com">
      </div>
      <div class="form-group">
        <label class="form-label">Dirección</label>
        <input type="text" class="form-control" id="client-address" value="${escapeHtml(client.address || '')}" placeholder="Calle, número, ciudad">
      </div>
      <div class="form-group">
        <label class="form-label">Notas</label>
        <textarea class="form-control" id="client-notes" placeholder="Notas adicionales...">${escapeHtml(client.notes || '')}</textarea>
      </div>
      <div class="form-group">
        <label class="form-label">Etiquetas</label>
        <div id="tags-input-area" style="border:1px solid var(--border);border-radius:8px;padding:6px 8px;display:flex;flex-wrap:wrap;gap:4px;min-height:38px;cursor:text;background:var(--card-bg);" onclick="document.getElementById('tag-text-input').focus()">
          <span id="tags-badges-container" style="display:contents;"></span>
          <input type="text" id="tag-text-input" placeholder="Añadir etiqueta y pulsar Enter..." style="border:none;outline:none;background:transparent;font-size:13px;flex:1;min-width:120px;color:var(--text-primary);">
        </div>
        ${existingTagSuggestions.length > 0 ? `<div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:6px;" id="tag-suggestions">
          ${existingTagSuggestions.map(tag => `<button type="button" class="tag-suggestion" data-tag="${escapeHtml(tag)}" style="background:var(--content-bg);border:1px solid var(--border);border-radius:10px;padding:2px 8px;font-size:11px;cursor:pointer;color:var(--text-secondary);">${escapeHtml(tag)}</button>`).join('')}
        </div>` : ''}
      </div>
      <div class="modal-footer" style="padding:0;margin-top:8px;border-top:none;">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
        <button type="submit" class="btn btn-primary">${isEdit ? 'Guardar cambios' : 'Crear cliente'}</button>
      </div>
    </form>
  `);

  // Tags input logic
  function renderModalTags() {
    const container = document.getElementById('tags-badges-container');
    if (!container) return;
    container.innerHTML = modalTags.map(tag => renderTagBadge(tag, true)).join('');
    container.querySelectorAll('.tag-remove-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        modalTags = modalTags.filter(t => t !== btn.dataset.tag);
        renderModalTags();
      });
    });
  }

  function addTag(tag) {
    const trimmed = tag.trim().replace(/,/g, '').substring(0, 30);
    if (trimmed && !modalTags.includes(trimmed)) {
      modalTags.push(trimmed);
      renderModalTags();
    }
  }

  renderModalTags();

  document.getElementById('tag-text-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = e.target.value.trim();
      if (val) { addTag(val); e.target.value = ''; }
    } else if (e.key === 'Backspace' && !e.target.value && modalTags.length > 0) {
      modalTags.pop();
      renderModalTags();
    }
  });

  document.querySelectorAll('.tag-suggestion').forEach(btn => {
    btn.addEventListener('click', () => {
      addTag(btn.dataset.tag);
      document.getElementById('tag-text-input')?.focus();
    });
  });

  document.getElementById('client-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    // Flush any typed tag not yet confirmed
    const tagInput = document.getElementById('tag-text-input');
    if (tagInput?.value.trim()) addTag(tagInput.value.trim());

    const data = {
      name: document.getElementById('client-name').value.trim(),
      nif: document.getElementById('client-nif').value.trim(),
      email: document.getElementById('client-email').value.trim(),
      phone: document.getElementById('client-phone').value.trim(),
      address: document.getElementById('client-address').value.trim(),
      notes: document.getElementById('client-notes').value.trim(),
      tags: modalTags.join(',')
    };

    if (!data.name) {
      showToast('El nombre es obligatorio', 'error');
      return;
    }

    try {
      if (isEdit) {
        await window.api.clients.update(id, data);
        showToast('Cliente actualizado correctamente', 'success');
      } else {
        await window.api.clients.create(data);
        showToast('Cliente creado correctamente', 'success');
      }
      closeModal();
      await loadClients();
    } catch (err) {
      showToast('Error al guardar el cliente: ' + err.message, 'error');
    }
  });
}

async function viewClientInvoices(clientId, clientName) {
  const [invoices, documents] = await Promise.all([
    window.api.invoices.getByClient(clientId),
    window.api.documents.getAll()
  ]);
  const clientDocs = documents.filter(d => d.client_id == clientId);

  const totalBilled  = invoices.reduce((s, i) => s + (i.total || 0), 0);
  const totalPaid    = invoices.filter(i => i.payment_status === 'pagada').reduce((s, i) => s + (i.total || 0), 0);
  const totalPending = totalBilled - totalPaid;

  const invoiceRows = invoices.length === 0
    ? `<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--text-secondary);">Sin facturas aún</td></tr>`
    : invoices.map(inv => {
        const paid = inv.payment_status === 'pagada';
        const overdue = !paid && inv.date && inv.date <= (() => { const d = new Date(); d.setDate(d.getDate()-30); return d.toISOString().split('T')[0]; })();
        const badgeCls = paid ? 'badge-paid' : overdue ? 'badge-overdue' : 'badge-pending';
        const badgeLabel = paid ? 'Cobrada' : overdue ? 'Vencida' : 'Pendiente';
        return `<tr>
          <td><span class="badge badge-blue" style="font-size:11px;">${escapeHtml(inv.invoice_number)}</span></td>
          <td style="font-size:12px;">${formatDate(inv.date)}</td>
          <td class="text-right" style="font-size:12px;">${formatCurrency(inv.total)}</td>
          <td style="text-align:center;"><span class="badge ${badgeCls}" style="font-size:10px;">${badgeLabel}</span></td>
          <td style="font-size:11px;color:var(--text-secondary);">${inv.payment_date ? formatDate(inv.payment_date) : '-'}</td>
        </tr>`;
      }).join('');

  const docRows = clientDocs.length === 0
    ? `<tr><td colspan="3" style="text-align:center;padding:20px;color:var(--text-secondary);">Sin documentos aún</td></tr>`
    : clientDocs.map(doc => `
        <tr>
          <td class="fw-bold" style="font-size:13px;">${escapeHtml(doc.title)}</td>
          <td style="font-size:12px;color:var(--text-secondary);">${formatDate((doc.created_at||'').split(' ')[0])}</td>
          <td>${doc.email_sent_at ? `<span class="badge badge-green" style="font-size:10px;">Enviado</span>` : '<span class="text-muted" style="font-size:12px;">—</span>'}</td>
        </tr>`).join('');

  openModal(`Historial — ${clientName}`, `
    <div style="display:flex;gap:16px;margin-bottom:16px;flex-wrap:wrap;">
      <div style="flex:1;min-width:100px;background:#eff6ff;border-radius:8px;padding:10px 14px;">
        <div style="font-size:11px;color:#1e40af;font-weight:600;margin-bottom:2px;">Total facturado</div>
        <div style="font-size:16px;font-weight:700;color:#1e40af;">${formatCurrency(totalBilled)}</div>
      </div>
      <div style="flex:1;min-width:100px;background:#f0fdf4;border-radius:8px;padding:10px 14px;">
        <div style="font-size:11px;color:#166534;font-weight:600;margin-bottom:2px;">Cobrado</div>
        <div style="font-size:16px;font-weight:700;color:#166534;">${formatCurrency(totalPaid)}</div>
      </div>
      <div style="flex:1;min-width:100px;background:${totalPending > 0 ? '#fff7ed' : '#f9fafb'};border-radius:8px;padding:10px 14px;">
        <div style="font-size:11px;color:${totalPending > 0 ? '#92400e' : 'var(--text-secondary)'};font-weight:600;margin-bottom:2px;">Pendiente</div>
        <div style="font-size:16px;font-weight:700;color:${totalPending > 0 ? '#b45309' : 'var(--text-secondary)'};">${formatCurrency(totalPending)}</div>
      </div>
    </div>

    <div style="display:flex;gap:4px;border-bottom:1px solid var(--border);margin-bottom:12px;">
      <button class="btn btn-ghost btn-sm client-hist-tab active" data-tab="facturas" style="border-radius:6px 6px 0 0;">
        Facturas (${invoices.length})
      </button>
      <button class="btn btn-ghost btn-sm client-hist-tab" data-tab="documentos" style="border-radius:6px 6px 0 0;">
        Documentos (${clientDocs.length})
      </button>
    </div>

    <div id="client-hist-facturas" class="client-hist-panel">
      <div class="table-wrapper" style="max-height:280px;overflow-y:auto;">
        <table>
          <thead><tr>
            <th>Número</th><th>Fecha</th><th class="text-right">Total</th><th style="text-align:center;">Estado</th><th>F. cobro</th>
          </tr></thead>
          <tbody>${invoiceRows}</tbody>
        </table>
      </div>
      ${invoices.length > 0 ? `
        <div style="margin-top:10px;">
          <button class="btn btn-secondary btn-sm" id="client-zip-btn">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Exportar todas como ZIP
          </button>
        </div>` : ''}
    </div>

    <div id="client-hist-documentos" class="client-hist-panel" style="display:none;">
      <div class="table-wrapper" style="max-height:300px;overflow-y:auto;">
        <table>
          <thead><tr><th>Título</th><th>Fecha</th><th>Email</th></tr></thead>
          <tbody>${docRows}</tbody>
        </table>
      </div>
    </div>

    <div style="margin-top:12px;text-align:right;">
      <button class="btn btn-secondary btn-sm" onclick="closeModal()">Cerrar</button>
    </div>
  `);

  // Tab switching
  document.querySelectorAll('.client-hist-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.client-hist-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const target = tab.dataset.tab;
      document.getElementById('client-hist-facturas').style.display  = target === 'facturas'   ? '' : 'none';
      document.getElementById('client-hist-documentos').style.display = target === 'documentos' ? '' : 'none';
    });
  });

  // ZIP export
  document.getElementById('client-zip-btn')?.addEventListener('click', async () => {
    const business = await window.api.settings.getBusiness();
    showToast(`Generando ${invoices.length} PDF${invoices.length !== 1 ? 's' : ''}...`, 'info');
    const payloads = [];
    for (const inv of invoices) {
      const items = await window.api.invoiceItems.getByInvoice(inv.id);
      payloads.push({ htmlContent: generatePDFDocument(inv, items, business), invoiceNumber: inv.invoice_number });
    }
    const result = await window.api.exportPDFZip(payloads);
    if (result.success) showToast(`ZIP guardado con ${payloads.length} facturas`, 'success');
    else if (result.reason !== 'cancelled') showToast('Error al crear el ZIP', 'error');
  });
}

async function deleteClient(id, name) {
  const confirmed = await showConfirm(
    '¿Eliminar cliente?',
    `¿Estás seguro de que quieres eliminar a "${name}"? Esta acción no se puede deshacer.`
  );

  if (!confirmed) return;

  try {
    await window.api.clients.delete(id);
    showToast('Cliente eliminado', 'success');
    await loadClients();
  } catch (err) {
    showToast('Error al eliminar el cliente: ' + err.message, 'error');
  }
}
