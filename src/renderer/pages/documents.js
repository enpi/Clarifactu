// ─── Documents Page ───────────────────────────────────────────────────────────

let documentsAllData = [];
let documentsFilteredData = [];
let documentsPage = 1;
const DOCS_PER_PAGE = 20;
let documentsSortCol = 'created_at';
let documentsSortDir = 'desc';

async function renderDocuments(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Documentos</h1>
        <p class="page-subtitle">Informes y documentos para tus clientes</p>
      </div>
      <div style="display:flex;gap:8px;">
        <button class="btn btn-ghost" id="doc-templates-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
            <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
          </svg>
          Plantillas
        </button>
        <button class="btn btn-primary" id="doc-new-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Nuevo documento
        </button>
      </div>
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
            <input type="text" class="search-input" id="doc-search" placeholder="Buscar por título, cliente o contenido...">
          </div>
          <span id="doc-count" class="text-muted" style="font-size:13px;"></span>
        </div>
      </div>
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th class="sortable-header" data-col="title" style="cursor:pointer;user-select:none;">
                Título <span id="sort-title" class="sort-arrow"></span>
              </th>
              <th class="sortable-header" data-col="client_name" style="cursor:pointer;user-select:none;">
                Dirigido a <span id="sort-client_name" class="sort-arrow"></span>
              </th>
              <th class="sortable-header" data-col="created_at" style="cursor:pointer;user-select:none;">
                Fecha <span id="sort-created_at" class="sort-arrow">↓</span>
              </th>
              <th style="width:220px;"></th>
            </tr>
          </thead>
          <tbody id="docs-tbody">
            <tr><td colspan="4"><div class="loading"><div class="spinner"></div>Cargando...</div></td></tr>
          </tbody>
        </table>
      </div>
      <div id="docs-pagination"></div>
    </div>
  `;

  document.getElementById('doc-new-btn').addEventListener('click', () => openDocumentModal());
  document.getElementById('doc-templates-btn').addEventListener('click', () => openTemplatesModal());

  document.getElementById('doc-search').addEventListener('input', debounce((e) => {
    documentsPage = 1;
    filterAndRenderDocuments(e.target.value.trim());
  }, 200));

  container.querySelectorAll('.sortable-header').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.col;
      if (documentsSortCol === col) {
        documentsSortDir = documentsSortDir === 'asc' ? 'desc' : 'asc';
      } else {
        documentsSortCol = col;
        documentsSortDir = col === 'created_at' ? 'desc' : 'asc';
      }
      updateSortArrows();
      documentsPage = 1;
      filterAndRenderDocuments(document.getElementById('doc-search')?.value.trim() || '');
    });
  });

  await loadDocuments();
}

function updateSortArrows() {
  ['title', 'client_name', 'created_at'].forEach(col => {
    const el = document.getElementById('sort-' + col);
    if (!el) return;
    if (col === documentsSortCol) {
      el.textContent = documentsSortDir === 'asc' ? '↑' : '↓';
    } else {
      el.textContent = '';
    }
  });
}

async function loadDocuments() {
  documentsAllData = await window.api.documents.getAll();
  documentsPage = 1;
  filterAndRenderDocuments(document.getElementById('doc-search')?.value.trim() || '');
}

function filterAndRenderDocuments(query = '') {
  const q = query.toLowerCase();
  let filtered = q
    ? documentsAllData.filter(d =>
        d.title.toLowerCase().includes(q) ||
        (d.body || '').toLowerCase().includes(q) ||
        (d.client_name || '').toLowerCase().includes(q)
      )
    : documentsAllData.slice();

  // Sort
  filtered.sort((a, b) => {
    let va = (a[documentsSortCol] || '').toLowerCase();
    let vb = (b[documentsSortCol] || '').toLowerCase();
    if (va < vb) return documentsSortDir === 'asc' ? -1 : 1;
    if (va > vb) return documentsSortDir === 'asc' ? 1 : -1;
    return 0;
  });

  documentsFilteredData = filtered;

  const countEl = document.getElementById('doc-count');
  if (countEl) countEl.textContent = `${documentsFilteredData.length} documento${documentsFilteredData.length !== 1 ? 's' : ''}`;

  const total = Math.ceil(documentsFilteredData.length / DOCS_PER_PAGE) || 1;
  const page = Math.min(documentsPage, total);
  const start = (page - 1) * DOCS_PER_PAGE;
  renderDocumentsTable(documentsFilteredData.slice(start, start + DOCS_PER_PAGE));
  renderPagination('docs-pagination', page, total, (p) => {
    documentsPage = p;
    filterAndRenderDocuments(document.getElementById('doc-search')?.value.trim() || '');
  });
}

function renderDocumentsTable(docs) {
  const tbody = document.getElementById('docs-tbody');
  if (!tbody) return;

  if (docs.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4">
          <div class="empty-state">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="12" y1="17" x2="8" y2="17"/>
            </svg>
            <p>No hay documentos. Crea el primero.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = docs.map(doc => {
    const hasEmail = !!(doc.client_email);
    const wasSent  = !!(doc.email_sent_at);

    const clientCell = doc.client_name
      ? `<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
           <span class="badge badge-blue">${escapeHtml(doc.client_name)}</span>
           ${wasSent ? `<span class="badge badge-green" title="Enviado el ${formatDate((doc.email_sent_at || '').split(' ')[0])}">Enviado</span>` : ''}
         </div>`
      : '<span class="text-muted">—</span>';

    return `
      <tr>
        <td class="fw-bold">${escapeHtml(doc.title)}</td>
        <td>${clientCell}</td>
        <td class="text-muted" style="font-size:13px;">${formatDate((doc.created_at || '').split(' ')[0])}</td>
        <td>
          <div class="table-actions">
            <button class="btn btn-ghost btn-sm" title="Vista previa" onclick="openDocumentPreview(${doc.id})">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
              Ver
            </button>
            ${hasEmail ? `
            <button class="btn btn-ghost btn-sm btn-icon" title="${wasSent ? 'Reenviar por email' : 'Enviar por email'}" onclick="openDocumentEmailModal(${doc.id})">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                <polyline points="22,6 12,13 2,6"/>
              </svg>
            </button>
            ` : ''}
            <button class="btn btn-ghost btn-sm btn-icon" title="Exportar PDF" onclick="exportDocumentPDF(${doc.id})">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
            </button>
            <button class="btn btn-ghost btn-sm btn-icon" title="Duplicar" onclick="duplicateDocument(${doc.id})">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
              </svg>
            </button>
            <button class="btn btn-ghost btn-sm btn-icon" title="Editar" onclick="openDocumentModal(${doc.id})">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
            <button class="btn btn-ghost btn-sm btn-icon danger" title="Eliminar" onclick="deleteDocument(${doc.id}, '${escapeHtml(doc.title).replace(/'/g, "\\'")}')">
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
    `;
  }).join('');
}

// ─── Modal: Crear / Editar ─────────────────────────────────────────────────────

async function openDocumentModal(id = null) {
  const isEdit = id !== null;
  let doc = { title: '', body: '', client_id: '' };

  if (isEdit) {
    doc = await window.api.documents.getById(id);
  }

  const [clients, templates] = await Promise.all([
    window.api.clients.getAll(),
    window.api.documentTemplates.getAll()
  ]);
  const clientOptions = clients.map(c =>
    `<option value="${c.id}" ${doc.client_id == c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`
  ).join('');

  const templateOptions = templates.length > 0
    ? `<div class="form-group" style="margin-bottom:8px;">
         <label class="form-label">Usar plantilla</label>
         <div style="display:flex;gap:8px;">
           <select class="form-control" id="doc-template-select" style="flex:1;">
             <option value="">— Selecciona una plantilla —</option>
             ${templates.map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('')}
           </select>
           <button type="button" class="btn btn-ghost" id="doc-apply-tpl-btn">Aplicar</button>
         </div>
       </div>`
    : '';

  openModal(isEdit ? 'Editar documento' : 'Nuevo documento', `
    <form id="doc-form">
      ${templateOptions}
      <div class="form-group">
        <label class="form-label">Título <span class="required">*</span></label>
        <input type="text" class="form-control" id="doc-title" value="${escapeHtml(doc.title || '')}"
          placeholder="Ej: Informe de evolución, Certificado de asistencia…" ${!templates.length || isEdit ? 'autofocus' : ''}>
      </div>
      <div class="form-group">
        <label class="form-label">Dirigido a (cliente)</label>
        <select class="form-control" id="doc-client">
          <option value="">— Sin destinatario específico —</option>
          ${clientOptions}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Contenido</label>
        <p class="text-muted" style="font-size:12px;margin-bottom:6px;">
          Usa <code style="background:var(--content-bg);padding:1px 4px;border-radius:3px;">{nombre}</code> (cliente),
          <code style="background:var(--content-bg);padding:1px 4px;border-radius:3px;">{fecha}</code> o
          <code style="background:var(--content-bg);padding:1px 4px;border-radius:3px;">{hoy}</code> para insertar datos automáticamente.
        </p>
        ${buildRichEditorHtml('doc-body')}
      </div>
      <div class="modal-footer" style="padding:0;margin-top:8px;border-top:none;">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
        <button type="submit" class="btn btn-primary">${isEdit ? 'Guardar cambios' : 'Crear documento'}</button>
      </div>
    </form>
  `, { size: 'lg' });

  // Init rich editor
  initRichEditor('doc-body', doc.body || '');

  // Apply template button
  const applyBtn = document.getElementById('doc-apply-tpl-btn');
  if (applyBtn) {
    applyBtn.addEventListener('click', () => {
      const sel = document.getElementById('doc-template-select');
      const tplId = parseInt(sel.value);
      const tpl = templates.find(t => t.id === tplId);
      if (!tpl) return;
      const titleEl = document.getElementById('doc-title');
      if (!titleEl.value) titleEl.value = tpl.name;
      editor.innerHTML = renderBodyHtml(tpl.body || '');
      editor.focus();
    });
  }

  document.getElementById('doc-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('doc-title').value.trim();
    const body  = document.getElementById('doc-body').innerHTML;
    const client_id = document.getElementById('doc-client').value || null;

    if (!title) {
      showToast('El título es obligatorio', 'error');
      document.getElementById('doc-title').focus();
      return;
    }

    try {
      if (isEdit) {
        await window.api.documents.update(id, { title, body, client_id });
        showToast('Documento actualizado correctamente', 'success');
      } else {
        await window.api.documents.create({ title, body, client_id });
        showToast('Documento creado correctamente', 'success');
      }
      closeModal();
      await loadDocuments();
    } catch (err) {
      showToast('Error al guardar: ' + err.message, 'error');
    }
  });
}

// ─── Modal: Enviar por email ───────────────────────────────────────────────────

async function openDocumentEmailModal(id) {
  const doc     = await window.api.documents.getById(id);
  const emailCfg = await window.api.email.getSettings();

  if (!emailCfg.gmail_user || !emailCfg.gmail_app_password) {
    showToast('Configura Gmail en Configuración → Email antes de enviar', 'error');
    return;
  }

  const toEmail = doc.client_email || '';
  const toName  = doc.client_name  || '';
  const wasSent = !!(doc.email_sent_at);

  openModal('Enviar documento por email', `
    <form id="doc-email-form">
      ${wasSent ? `
        <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:6px;padding:10px 14px;
                    font-size:13px;color:#92400e;margin-bottom:16px;">
          Este documento ya fue enviado el ${formatDate((doc.email_sent_at || '').split(' ')[0])}. Puedes reenviarlo.
        </div>
      ` : ''}
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Para (email) <span class="required">*</span></label>
          <input type="email" class="form-control" id="doc-email-to" value="${escapeHtml(toEmail)}"
            placeholder="destinatario@email.com">
        </div>
        <div class="form-group">
          <label class="form-label">Nombre del destinatario</label>
          <input type="text" class="form-control" id="doc-email-name" value="${escapeHtml(toName)}"
            placeholder="Nombre">
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Asunto</label>
        <input type="text" class="form-control" id="doc-email-subject"
          value="${escapeHtml(doc.title)}">
      </div>
      <div class="form-group">
        <label class="form-label">Mensaje</label>
        <textarea class="form-control" id="doc-email-body" rows="5">${toName ? `Hola ${escapeHtml(toName)},\n\nAdjunto encontrarás el documento "${escapeHtml(doc.title)}".\n\nQuedo a tu disposición para cualquier consulta.\n\nUn saludo.` : `Adjunto encontrarás el documento "${escapeHtml(doc.title)}".\n\nUn saludo.`}</textarea>
      </div>
      <div class="modal-footer" style="padding:0;margin-top:8px;border-top:none;">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
        <button type="submit" class="btn btn-primary" id="doc-email-send-btn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
          Enviar
        </button>
      </div>
    </form>
  `);

  document.getElementById('doc-email-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const toEmailVal  = document.getElementById('doc-email-to').value.trim();
    const toNameVal   = document.getElementById('doc-email-name').value.trim();
    const subject     = document.getElementById('doc-email-subject').value.trim();
    const body        = document.getElementById('doc-email-body').value;

    if (!toEmailVal) {
      showToast('El email de destino es obligatorio', 'error');
      return;
    }

    const sendBtn = document.getElementById('doc-email-send-btn');
    sendBtn.disabled = true;
    sendBtn.textContent = 'Enviando…';

    try {
      const business   = await window.api.settings.getBusiness();
      const htmlContent = buildDocumentPDFHtml(doc, business);

      const result = await window.api.documents.sendEmail({
        htmlContent,
        title:   doc.title,
        toEmail: toEmailVal,
        toName:  toNameVal,
        subject,
        body
      });

      if (result.success) {
        await window.api.documents.markEmailSent(id);
        await window.api.activityLog.add({
          action_type:    'documento_enviado',
          invoice_number: null,
          client_name:    toNameVal || toEmailVal,
          details:        `Documento "${doc.title}" enviado a ${toEmailVal}`
        });
        showToast('Documento enviado correctamente', 'success');
        closeModal();
        await loadDocuments();
      } else {
        showToast('Error al enviar: ' + (result.error || 'Error desconocido'), 'error');
        sendBtn.disabled = false;
        sendBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Enviar`;
      }
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
      sendBtn.disabled = false;
      sendBtn.textContent = 'Enviar';
    }
  });
}

// ─── Vista previa ──────────────────────────────────────────────────────────────

async function openDocumentPreview(id) {
  const doc      = await window.api.documents.getById(id);
  const business = await window.api.settings.getBusiness();

  openModal('Vista previa', `
    <div style="background:var(--content-bg);border-radius:8px;padding:24px;">
      <div style="max-width:620px;margin:0 auto;background:var(--card-bg);border-radius:8px;
                  box-shadow:var(--shadow);padding:48px;border:1px solid var(--border);">
        ${buildDocumentTemplateInner(doc, business)}
      </div>
    </div>
    <div class="modal-footer" style="margin-top:16px;">
      <button class="btn btn-secondary" onclick="closeModal()">Cerrar</button>
      <button class="btn btn-primary" onclick="closeModal();exportDocumentPDF(${id})">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        Exportar PDF
      </button>
    </div>
  `, { size: 'xl' });
}

// ─── Exportar PDF ──────────────────────────────────────────────────────────────

async function exportDocumentPDF(id) {
  const doc      = await window.api.documents.getById(id);
  const business = await window.api.settings.getBusiness();
  const htmlContent = buildDocumentPDFHtml(doc, business);
  const result = await window.api.documents.exportPDF({ htmlContent, title: doc.title });
  if (result && result.success) {
    showToast('PDF exportado correctamente', 'success');
  } else if (result && result.reason !== 'cancelled') {
    showToast('Error al exportar el PDF', 'error');
  }
}

// ─── Eliminar ──────────────────────────────────────────────────────────────────

async function deleteDocument(id, title) {
  const confirmed = await showConfirm(
    '¿Eliminar documento?',
    `¿Estás seguro de que quieres eliminar "${title}"? Esta acción no se puede deshacer.`
  );
  if (!confirmed) return;

  try {
    await window.api.documents.delete(id);
    showToast('Documento eliminado', 'success');
    await loadDocuments();
  } catch (err) {
    showToast('Error al eliminar: ' + err.message, 'error');
  }
}

// ─── Duplicar ──────────────────────────────────────────────────────────────────

async function duplicateDocument(id) {
  try {
    const doc = await window.api.documents.getById(id);
    await window.api.documents.create({
      title:     'Copia de ' + doc.title,
      body:      doc.body,
      client_id: doc.client_id || null
    });
    showToast('Documento duplicado correctamente', 'success');
    await loadDocuments();
  } catch (err) {
    showToast('Error al duplicar: ' + err.message, 'error');
  }
}

// ─── Plantillas ────────────────────────────────────────────────────────────────

async function openTemplatesModal() {
  const templates = await window.api.documentTemplates.getAll();

  const renderList = () => templates.map((t, i) => `
    <div style="display:flex;align-items:center;gap:8px;padding:10px 0;
                border-bottom:1px solid var(--border);" id="tpl-row-${t.id}">
      <div style="flex:1;min-width:0;">
        <div class="fw-bold" style="font-size:14px;">${escapeHtml(t.name)}</div>
        <div class="text-muted" style="font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
          ${escapeHtml((t.body || '').substring(0, 80))}${(t.body || '').length > 80 ? '…' : ''}
        </div>
      </div>
      <button class="btn btn-ghost btn-sm btn-icon" title="Editar" onclick="editTemplate(${t.id})">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      </button>
      <button class="btn btn-ghost btn-sm btn-icon danger" title="Eliminar" onclick="deleteTemplate(${t.id}, '${escapeHtml(t.name).replace(/'/g, "\\'")}')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
          <path d="M10 11v6M14 11v6"/>
          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
        </svg>
      </button>
    </div>
  `).join('');

  openModal('Plantillas de documento', `
    <div style="margin-bottom:16px;">
      <p class="text-muted" style="font-size:13px;margin-bottom:12px;">
        Las plantillas te permiten reutilizar estructuras de documentos. Usa <code style="background:var(--content-bg);padding:1px 5px;border-radius:4px;">{nombre}</code>,
        <code style="background:var(--content-bg);padding:1px 5px;border-radius:4px;">{fecha}</code> o
        <code style="background:var(--content-bg);padding:1px 5px;border-radius:4px;">{hoy}</code> en el cuerpo.
      </p>
    </div>
    <div id="templates-list">
      ${templates.length === 0
        ? `<div class="empty-state" style="padding:24px 0;">
             <p>No hay plantillas. Crea la primera.</p>
           </div>`
        : renderList()
      }
    </div>
    <div class="modal-footer" style="margin-top:16px;">
      <button class="btn btn-secondary" onclick="closeModal()">Cerrar</button>
      <button class="btn btn-primary" onclick="openNewTemplateForm()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        Nueva plantilla
      </button>
    </div>
  `, { size: 'lg' });
}

function buildRichEditorHtml(editorId) {
  return `
    <div class="rich-toolbar" id="rich-toolbar-${editorId}">
      <button type="button" data-cmd="bold"          title="Negrita (Ctrl+B)"   style="font-weight:700;">B</button>
      <button type="button" data-cmd="italic"        title="Cursiva (Ctrl+I)"   style="font-style:italic;">I</button>
      <button type="button" data-cmd="underline"     title="Subrayado (Ctrl+U)" style="text-decoration:underline;">S</button>
      <button type="button" data-cmd="strikeThrough" title="Tachado"             style="text-decoration:line-through;">T</button>
      <span class="tb-sep"></span>
      <button type="button" data-cmd="justifyLeft"   title="Alinear izquierda">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="17" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="17" y1="18" x2="3" y2="18"/></svg>
      </button>
      <button type="button" data-cmd="justifyCenter" title="Centrar">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="21" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="21" y1="18" x2="3" y2="18"/></svg>
      </button>
      <button type="button" data-cmd="justifyRight"  title="Alinear derecha">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="21" y1="10" x2="7" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="7" y2="14"/><line x1="21" y1="18" x2="3" y2="18"/></svg>
      </button>
      <span class="tb-sep"></span>
      <button type="button" data-cmd="insertUnorderedList" title="Lista con viñetas">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><circle cx="4" cy="6" r="1" fill="currentColor"/><circle cx="4" cy="12" r="1" fill="currentColor"/><circle cx="4" cy="18" r="1" fill="currentColor"/></svg>
      </button>
      <button type="button" data-cmd="insertOrderedList" title="Lista numerada">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6h1v4"/><path d="M4 10H5"/><path d="M3 14h2v1l-2 2h2"/></svg>
      </button>
      <span class="tb-sep"></span>
      <button type="button" data-cmd="formatBlock" data-val="h1" title="Título grande" style="font-size:11px;font-weight:700;">H1</button>
      <button type="button" data-cmd="formatBlock" data-val="h2" title="Título medio"  style="font-size:11px;font-weight:700;">H2</button>
      <button type="button" data-cmd="formatBlock" data-val="p"  title="Párrafo normal" style="font-size:11px;">¶</button>
      <span class="tb-sep"></span>
      <button type="button" id="rich-clear-${editorId}" title="Quitar formato">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7V4h16v3"/><path d="M5 20h6"/><path d="M13 4l-7 16"/><line x1="18" y1="12" x2="22" y2="16"/><line x1="22" y1="12" x2="18" y2="16"/></svg>
      </button>
    </div>
    <div class="rich-editor" id="${editorId}" contenteditable="true" spellcheck="true"></div>
  `;
}

function initRichEditor(editorId, initialBody) {
  const editor = document.getElementById(editorId);
  document.execCommand('defaultParagraphSeparator', false, 'p');
  if (initialBody) editor.innerHTML = renderBodyHtml(initialBody);

  document.querySelectorAll(`#rich-toolbar-${editorId} [data-cmd]`).forEach(btn => {
    btn.addEventListener('mousedown', (e) => {
      e.preventDefault();
      document.execCommand(btn.dataset.cmd, false, btn.dataset.val || null);
      editor.focus();
    });
  });

  document.getElementById(`rich-clear-${editorId}`)?.addEventListener('mousedown', (e) => {
    e.preventDefault();
    document.execCommand('removeFormat', false, null);
    editor.focus();
  });

  editor.addEventListener('keyup', () => updateRichToolbarState(editorId));
  editor.addEventListener('mouseup', () => updateRichToolbarState(editorId));
}

function updateRichToolbarState(editorId) {
  ['bold','italic','underline','strikeThrough'].forEach(cmd => {
    const btn = document.querySelector(`#rich-toolbar-${editorId} [data-cmd="${cmd}"]`);
    if (btn) btn.classList.toggle('active', document.queryCommandState(cmd));
  });
}

function openNewTemplateForm() {
  openModal('Nueva plantilla', `
    <form id="tpl-form">
      <div class="form-group">
        <label class="form-label">Nombre <span class="required">*</span></label>
        <input type="text" class="form-control" id="tpl-name" placeholder="Ej: Informe de evolución" autofocus>
      </div>
      <div class="form-group">
        <label class="form-label">Cuerpo</label>
        <p class="text-muted" style="font-size:12px;margin-bottom:6px;">
          Puedes usar <code style="background:var(--content-bg);padding:1px 4px;border-radius:3px;">{nombre}</code> (cliente),
          <code style="background:var(--content-bg);padding:1px 4px;border-radius:3px;">{fecha}</code> y
          <code style="background:var(--content-bg);padding:1px 4px;border-radius:3px;">{hoy}</code> (fecha de hoy).
        </p>
        ${buildRichEditorHtml('tpl-body')}
      </div>
      <div class="modal-footer" style="padding:0;margin-top:8px;border-top:none;">
        <button type="button" class="btn btn-secondary" onclick="openTemplatesModal()">Cancelar</button>
        <button type="submit" class="btn btn-primary">Guardar plantilla</button>
      </div>
    </form>
  `, { size: 'lg' });

  initRichEditor('tpl-body', '');

  document.getElementById('tpl-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('tpl-name').value.trim();
    const body = document.getElementById('tpl-body').innerHTML;
    if (!name) { showToast('El nombre es obligatorio', 'error'); return; }
    try {
      await window.api.documentTemplates.create({ name, body });
      showToast('Plantilla creada correctamente', 'success');
      openTemplatesModal();
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    }
  });
}

async function editTemplate(id) {
  const templates = await window.api.documentTemplates.getAll();
  const t = templates.find(x => x.id === id);
  if (!t) return;

  openModal('Editar plantilla', `
    <form id="tpl-edit-form">
      <div class="form-group">
        <label class="form-label">Nombre <span class="required">*</span></label>
        <input type="text" class="form-control" id="tpl-name" value="${escapeHtml(t.name)}" autofocus>
      </div>
      <div class="form-group">
        <label class="form-label">Cuerpo</label>
        <p class="text-muted" style="font-size:12px;margin-bottom:6px;">
          Puedes usar <code style="background:var(--content-bg);padding:1px 4px;border-radius:3px;">{nombre}</code> (cliente),
          <code style="background:var(--content-bg);padding:1px 4px;border-radius:3px;">{fecha}</code> y
          <code style="background:var(--content-bg);padding:1px 4px;border-radius:3px;">{hoy}</code> (fecha de hoy).
        </p>
        ${buildRichEditorHtml('tpl-body')}
      </div>
      <div class="modal-footer" style="padding:0;margin-top:8px;border-top:none;">
        <button type="button" class="btn btn-secondary" onclick="openTemplatesModal()">Cancelar</button>
        <button type="submit" class="btn btn-primary">Guardar cambios</button>
      </div>
    </form>
  `, { size: 'lg' });

  initRichEditor('tpl-body', t.body || '');

  document.getElementById('tpl-edit-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('tpl-name').value.trim();
    const body = document.getElementById('tpl-body').innerHTML;
    if (!name) { showToast('El nombre es obligatorio', 'error'); return; }
    try {
      await window.api.documentTemplates.update(id, { name, body });
      showToast('Plantilla actualizada correctamente', 'success');
      openTemplatesModal();
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    }
  });
}

async function deleteTemplate(id, name) {
  const confirmed = await showConfirm('¿Eliminar plantilla?', `¿Eliminar la plantilla "${name}"? Esta acción no se puede deshacer.`);
  if (!confirmed) return;
  try {
    await window.api.documentTemplates.delete(id);
    showToast('Plantilla eliminada', 'success');
    openTemplatesModal();
  } catch (err) {
    showToast('Error: ' + err.message, 'error');
  }
}

// ─── Variable substitution ────────────────────────────────────────────────────

function resolveDocVariables(body, doc) {
  const today = new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
  const clientName = doc.client_name || '';
  return (body || '')
    .replace(/\{nombre\}/gi, clientName)
    .replace(/\{fecha\}/gi,  today)
    .replace(/\{hoy\}/gi,    today);
}

// ─── Body render helper (HTML o texto plano legacy) ───────────────────────────

function renderBodyHtml(body) {
  if (!body) return '';
  if (/<[a-z][\s\S]*>/i.test(body)) return body; // ya es HTML
  return body.split('\n').map(l => `<p>${escapeHtml(l) || '&nbsp;'}</p>`).join('');
}

// ─── Plantilla compartida (preview y PDF) ─────────────────────────────────────

function buildDocumentTemplateInner(doc, business) {
  const dateStr      = new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
  const logoHtml     = business && business.logo
    ? `<img src="${business.logo}" style="max-height:60px;max-width:150px;object-fit:contain;" alt="Logo">`
    : '';
  const businessName = (business && business.name)       ? escapeHtml(business.name)       : '';
  const extraInfo    = (business && business.extra_info) ? escapeHtml(business.extra_info) : '';
  const clientName   = doc.client_name ? escapeHtml(doc.client_name) : null;
  const clientNif    = doc.client_nif  ? escapeHtml(doc.client_nif)  : null;
  const clientBirth  = doc.client_birth_date
    ? new Date(doc.client_birth_date + 'T00:00:00').toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })
    : null;
  const bodyHtml     = renderBodyHtml(resolveDocVariables(doc.body, doc));
  const sigHtml = business && business.signature
    ? `<img src="${business.signature}" style="max-height:56px;max-width:160px;object-fit:contain;display:block;margin:0 auto 8px auto;" alt="Firma">`
    : '';

  return `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;">
      <div>${logoHtml || `<span style="font-size:20px;font-weight:700;color:var(--text-primary);">${businessName}</span>`}</div>
      <div style="text-align:right;font-size:12px;color:var(--text-secondary);line-height:1.8;">
        ${businessName && logoHtml ? `<div style="font-weight:600;color:var(--text-primary);font-size:13px;">${businessName}</div>` : ''}
        ${extraInfo ? `<div style="white-space:pre-line;">${extraInfo}</div>` : ''}
      </div>
    </div>

    <div style="border-top:2px solid var(--text-primary);margin-bottom:24px;"></div>

    ${clientName ? `
      <div style="margin-bottom:20px;">
        <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;
                    color:var(--text-secondary);margin-bottom:3px;">Dirigido a</div>
        <div style="font-size:15px;font-weight:600;color:var(--text-primary);">${clientName}</div>
        ${clientNif   ? `<div style="font-size:12px;color:var(--text-secondary);margin-top:2px;">DNI/NIF: ${clientNif}</div>` : ''}
        ${clientBirth ? `<div style="font-size:12px;color:var(--text-secondary);margin-top:1px;">Fecha de nacimiento: ${clientBirth}</div>` : ''}
      </div>
    ` : ''}

    <h2 style="font-size:22px;font-weight:700;color:var(--text-primary);margin:0 0 28px 0;line-height:1.3;">
      ${escapeHtml(doc.title)}
    </h2>

    <div style="font-size:13.5px;color:var(--text-primary);line-height:1.75;margin-bottom:48px;">
      ${bodyHtml}
    </div>

    <div style="border-top:1px solid var(--border);padding-top:24px;
                display:flex;justify-content:space-between;align-items:flex-end;">
      <div style="text-align:center;">
        ${sigHtml}
        <div style="width:180px;border-top:1px solid var(--text-muted);padding-top:8px;font-size:12px;color:var(--text-secondary);">
          <div style="font-weight:600;color:var(--text-primary);">${businessName}</div>
          <div>Firma</div>
        </div>
      </div>
      <div style="text-align:right;font-size:12px;color:var(--text-secondary);">
        <div style="font-weight:600;color:var(--text-primary);margin-bottom:2px;">${dateStr}</div>
        <div>Fecha del documento</div>
      </div>
    </div>
  `;
}

function buildDocumentPDFHtml(doc, business) {
  const dateStr      = new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
  const logoHtml     = business && business.logo
    ? `<img src="${business.logo}" style="max-height:60px;max-width:150px;object-fit:contain;" alt="Logo">`
    : '';
  const businessName = (business && business.name)       ? escapeHtml(business.name)       : '';
  const extraInfo    = (business && business.extra_info) ? escapeHtml(business.extra_info) : '';
  const clientName   = doc.client_name ? escapeHtml(doc.client_name) : null;
  const clientNif    = doc.client_nif  ? escapeHtml(doc.client_nif)  : null;
  const clientBirth  = doc.client_birth_date
    ? new Date(doc.client_birth_date + 'T00:00:00').toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })
    : null;
  const bodyHtml2    = renderBodyHtml(resolveDocVariables(doc.body, doc));
  const sigHtml = business && business.signature
    ? `<img src="${business.signature}" style="max-height:56px;max-width:160px;object-fit:contain;display:block;margin:0 auto 8px auto;" alt="Firma">`
    : '';

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, 'Segoe UI', Arial, sans-serif;
      color: #1e293b;
      background: #fff;
      padding: 56px 64px;
      font-size: 14px;
    }
    p { margin: 0 0 10px 0; min-height: 1em; line-height: 1.75; }
  </style>
</head>
<body>
  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;">
    <div>${logoHtml || `<span style="font-size:20px;font-weight:700;">${businessName}</span>`}</div>
    <div style="text-align:right;font-size:12px;color:#64748b;line-height:1.8;">
      ${businessName && logoHtml ? `<div style="font-weight:600;color:#1e293b;font-size:13px;">${businessName}</div>` : ''}
      ${extraInfo ? `<div style="white-space:pre-line;">${extraInfo}</div>` : ''}
    </div>
  </div>

  <div style="border-top:2px solid #1e293b;margin-bottom:24px;"></div>

  ${clientName ? `
    <div style="margin-bottom:20px;">
      <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:#64748b;margin-bottom:3px;">Dirigido a</div>
      <div style="font-size:15px;font-weight:600;color:#1e293b;">${clientName}</div>
      ${clientNif   ? `<div style="font-size:12px;color:#64748b;margin-top:2px;">DNI/NIF: ${clientNif}</div>` : ''}
      ${clientBirth ? `<div style="font-size:12px;color:#64748b;margin-top:1px;">Fecha de nacimiento: ${clientBirth}</div>` : ''}
    </div>
  ` : ''}

  <h2 style="font-size:22px;font-weight:700;color:#1e293b;margin:0 0 28px 0;line-height:1.3;">
    ${escapeHtml(doc.title)}
  </h2>

  <div style="font-size:13.5px;color:#1e293b;line-height:1.75;margin-bottom:56px;">
    ${bodyHtml2}
  </div>

  <div style="border-top:1px solid #e2e8f0;padding-top:24px;display:flex;justify-content:space-between;align-items:flex-end;">
    <div style="text-align:center;width:180px;">
      ${sigHtml}
      <div style="border-top:1px solid #94a3b8;padding-top:8px;font-size:12px;color:#64748b;">
        <div style="font-weight:600;color:#1e293b;">${businessName}</div>
        <div>Firma</div>
      </div>
    </div>
    <div style="text-align:right;font-size:12px;color:#64748b;">
      <div style="font-weight:600;color:#1e293b;margin-bottom:2px;">${dateStr}</div>
      <div>Fecha del documento</div>
    </div>
  </div>
</body>
</html>`;
}
