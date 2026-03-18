// ─── Documents Page ───────────────────────────────────────────────────────────

let documentsAllData = [];
let documentsFilteredData = [];
let documentsPage = 1;
const DOCS_PER_PAGE = 20;

async function renderDocuments(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Documentos</h1>
        <p class="page-subtitle">Informes y documentos para tus clientes</p>
      </div>
      <button class="btn btn-primary" id="doc-new-btn">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        Nuevo documento
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
            <input type="text" class="search-input" id="doc-search" placeholder="Buscar por título, cliente o contenido...">
          </div>
          <span id="doc-count" class="text-muted" style="font-size:13px;"></span>
        </div>
      </div>
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Título</th>
              <th>Dirigido a</th>
              <th>Fecha</th>
              <th style="width:200px;"></th>
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

  document.getElementById('doc-search').addEventListener('input', debounce((e) => {
    documentsPage = 1;
    filterAndRenderDocuments(e.target.value.trim());
  }, 200));

  await loadDocuments();
}

async function loadDocuments() {
  documentsAllData = await window.api.documents.getAll();
  documentsPage = 1;
  filterAndRenderDocuments(document.getElementById('doc-search')?.value.trim() || '');
}

function filterAndRenderDocuments(query = '') {
  const q = query.toLowerCase();
  documentsFilteredData = q
    ? documentsAllData.filter(d =>
        d.title.toLowerCase().includes(q) ||
        (d.body || '').toLowerCase().includes(q) ||
        (d.client_name || '').toLowerCase().includes(q)
      )
    : documentsAllData;

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
        <td>
          <span class="fw-bold">${escapeHtml(doc.title)}</span>
          ${doc.body ? `<br><span class="text-muted" style="font-size:12px;">${escapeHtml(doc.body.slice(0, 70))}${doc.body.length > 70 ? '…' : ''}</span>` : ''}
        </td>
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

  const clients = await window.api.clients.getAll();
  const clientOptions = clients.map(c =>
    `<option value="${c.id}" ${doc.client_id == c.id ? 'selected' : ''}>${escapeHtml(c.name)}</option>`
  ).join('');

  openModal(isEdit ? 'Editar documento' : 'Nuevo documento', `
    <form id="doc-form">
      <div class="form-group">
        <label class="form-label">Título <span class="required">*</span></label>
        <input type="text" class="form-control" id="doc-title" value="${escapeHtml(doc.title || '')}"
          placeholder="Ej: Informe de evolución, Certificado de asistencia…" autofocus>
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
        <textarea class="form-control" id="doc-body" rows="10"
          placeholder="Escribe aquí el cuerpo del documento…">${escapeHtml(doc.body || '')}</textarea>
      </div>
      <div class="modal-footer" style="padding:0;margin-top:8px;border-top:none;">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
        <button type="submit" class="btn btn-primary">${isEdit ? 'Guardar cambios' : 'Crear documento'}</button>
      </div>
    </form>
  `, { size: 'lg' });

  document.getElementById('doc-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = document.getElementById('doc-title').value.trim();
    const body  = document.getElementById('doc-body').value;
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

// ─── Plantilla compartida (preview y PDF) ─────────────────────────────────────

function buildDocumentTemplateInner(doc, business) {
  const dateStr      = new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
  const logoHtml     = business && business.logo
    ? `<img src="${business.logo}" style="max-height:60px;max-width:150px;object-fit:contain;" alt="Logo">`
    : '';
  const businessName = (business && business.name)  ? escapeHtml(business.name)  : '';
  const businessNif  = (business && business.nif)   ? escapeHtml(business.nif)   : '';
  const businessEmail= (business && business.email) ? escapeHtml(business.email) : '';
  const clientName   = doc.client_name ? escapeHtml(doc.client_name) : null;
  const bodyLines    = (doc.body || '').split('\n')
    .map(l => `<p style="margin:0 0 10px 0;min-height:1em;">${escapeHtml(l) || '&nbsp;'}</p>`)
    .join('');
  const sigHtml = business && business.signature
    ? `<img src="${business.signature}" style="max-height:56px;max-width:160px;object-fit:contain;display:block;margin-bottom:8px;" alt="Firma">`
    : '';

  return `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;">
      <div>${logoHtml || `<span style="font-size:20px;font-weight:700;color:var(--text-primary);">${businessName}</span>`}</div>
      <div style="text-align:right;font-size:12px;color:var(--text-secondary);line-height:1.8;">
        ${businessName && logoHtml ? `<div style="font-weight:600;color:var(--text-primary);font-size:13px;">${businessName}</div>` : ''}
        ${businessNif   ? `<div>${businessNif}</div>`   : ''}
        ${businessEmail ? `<div>${businessEmail}</div>` : ''}
      </div>
    </div>

    <div style="border-top:2px solid var(--text-primary);margin-bottom:24px;"></div>

    ${clientName ? `
      <div style="margin-bottom:20px;">
        <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;
                    color:var(--text-secondary);margin-bottom:3px;">Dirigido a</div>
        <div style="font-size:15px;font-weight:600;color:var(--text-primary);">${clientName}</div>
      </div>
    ` : ''}

    <h2 style="font-size:22px;font-weight:700;color:var(--text-primary);margin:0 0 28px 0;line-height:1.3;">
      ${escapeHtml(doc.title)}
    </h2>

    <div style="font-size:13.5px;color:var(--text-primary);line-height:1.75;margin-bottom:48px;">
      ${bodyLines}
    </div>

    <div style="border-top:1px solid var(--border);padding-top:24px;
                display:flex;justify-content:space-between;align-items:flex-end;">
      <div style="font-size:12px;color:var(--text-secondary);">
        <div style="font-weight:600;color:var(--text-primary);margin-bottom:2px;">${dateStr}</div>
        <div>Fecha del documento</div>
      </div>
      <div style="text-align:center;">
        ${sigHtml}
        <div style="width:180px;border-top:1px solid var(--text-muted);padding-top:8px;font-size:12px;color:var(--text-secondary);">
          <div style="font-weight:600;color:var(--text-primary);">${businessName}</div>
          <div>Firma</div>
        </div>
      </div>
    </div>
  `;
}

function buildDocumentPDFHtml(doc, business) {
  const dateStr      = new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
  const logoHtml     = business && business.logo
    ? `<img src="${business.logo}" style="max-height:60px;max-width:150px;object-fit:contain;" alt="Logo">`
    : '';
  const businessName = (business && business.name)  ? escapeHtml(business.name)  : '';
  const businessNif  = (business && business.nif)   ? escapeHtml(business.nif)   : '';
  const businessEmail= (business && business.email) ? escapeHtml(business.email) : '';
  const clientName   = doc.client_name ? escapeHtml(doc.client_name) : null;
  const bodyLines    = (doc.body || '').split('\n')
    .map(l => `<p>${escapeHtml(l) || '&nbsp;'}</p>`)
    .join('');
  const sigHtml = business && business.signature
    ? `<img src="${business.signature}" style="max-height:56px;max-width:160px;object-fit:contain;display:block;margin-bottom:8px;" alt="Firma">`
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
      ${businessNif   ? `<div>${businessNif}</div>`   : ''}
      ${businessEmail ? `<div>${businessEmail}</div>` : ''}
    </div>
  </div>

  <div style="border-top:2px solid #1e293b;margin-bottom:24px;"></div>

  ${clientName ? `
    <div style="margin-bottom:20px;">
      <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:#64748b;margin-bottom:3px;">Dirigido a</div>
      <div style="font-size:15px;font-weight:600;color:#1e293b;">${clientName}</div>
    </div>
  ` : ''}

  <h2 style="font-size:22px;font-weight:700;color:#1e293b;margin:0 0 28px 0;line-height:1.3;">
    ${escapeHtml(doc.title)}
  </h2>

  <div style="font-size:13.5px;color:#1e293b;line-height:1.75;margin-bottom:56px;">
    ${bodyLines}
  </div>

  <div style="border-top:1px solid #e2e8f0;padding-top:24px;display:flex;justify-content:space-between;align-items:flex-end;">
    <div style="font-size:12px;color:#64748b;">
      <div style="font-weight:600;color:#1e293b;margin-bottom:2px;">${dateStr}</div>
      <div>Fecha del documento</div>
    </div>
    <div style="text-align:center;">
      ${sigHtml}
      <div style="width:180px;border-top:1px solid #94a3b8;padding-top:8px;font-size:12px;color:#64748b;">
        <div style="font-weight:600;color:#1e293b;">${businessName}</div>
        <div>Firma</div>
      </div>
    </div>
  </div>
</body>
</html>`;
}
