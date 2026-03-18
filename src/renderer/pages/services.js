// ─── Services Page ─────────────────────────────────────────────────────────────

let servicesAllData = [];
let servicesFilteredData = [];
let servicesPage = 1;
const SERVICES_PER_PAGE = 20;

async function renderServices(container) {
  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Servicios</h1>
        <p class="page-subtitle">Gestiona los servicios que ofreces</p>
      </div>
      <button class="btn btn-primary" id="new-service-btn">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        Nuevo servicio
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
            <input type="text" class="search-input" id="service-search" placeholder="Buscar servicios...">
          </div>
          <span id="service-count" class="text-muted" style="font-size:13px;"></span>
        </div>
      </div>
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Descripción</th>
              <th>Duración</th>
              <th class="text-right">Precio</th>
              <th style="width:100px;"></th>
            </tr>
          </thead>
          <tbody id="services-tbody">
            <tr><td colspan="5"><div class="loading"><div class="spinner"></div>Cargando...</div></td></tr>
          </tbody>
        </table>
      </div>
      <div id="services-pagination"></div>
    </div>
  `;

  document.getElementById('new-service-btn').addEventListener('click', () => openServiceModal());

  const searchInput = document.getElementById('service-search');
  searchInput.addEventListener('input', debounce((e) => {
    servicesPage = 1;
    filterAndRenderServices(e.target.value.trim());
  }, 200));

  await loadServices();
}

async function loadServices() {
  servicesAllData = await window.api.services.getAll();
  servicesPage = 1;
  filterAndRenderServices(document.getElementById('service-search')?.value.trim() || '');
}

function filterAndRenderServices(query = '') {
  const q = query.toLowerCase();
  servicesFilteredData = q
    ? servicesAllData.filter(s =>
        s.name.toLowerCase().includes(q) ||
        (s.description || '').toLowerCase().includes(q)
      )
    : servicesAllData;

  const countEl = document.getElementById('service-count');
  if (countEl) countEl.textContent = `${servicesFilteredData.length} servicio${servicesFilteredData.length !== 1 ? 's' : ''}`;

  const total = Math.ceil(servicesFilteredData.length / SERVICES_PER_PAGE) || 1;
  const page = Math.min(servicesPage, total);
  const start = (page - 1) * SERVICES_PER_PAGE;
  renderServicesTable(servicesFilteredData.slice(start, start + SERVICES_PER_PAGE));
  renderPagination('services-pagination', page, total, (p) => { servicesPage = p; filterAndRenderServices(document.getElementById('service-search')?.value.trim() || ''); });
}

function renderServicesTable(services) {
  const tbody = document.getElementById('services-tbody');
  if (!tbody) return;

  if (services.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5">
          <div class="empty-state">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2"/>
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>
            </svg>
            <p>No hay servicios. Crea el primero.</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = services.map(s => `
    <tr>
      <td class="fw-bold">${escapeHtml(s.name)}</td>
      <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
        ${escapeHtml(s.description) || '<span class="text-muted">-</span>'}
      </td>
      <td>${escapeHtml(s.duration) || '<span class="text-muted">-</span>'}</td>
      <td class="text-right fw-bold" style="color:var(--primary);">${formatCurrency(s.price)}</td>
      <td>
        <div class="table-actions">
          <button class="btn btn-ghost btn-sm btn-icon" title="Editar" onclick="openServiceModal(${s.id})">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button class="btn btn-ghost btn-sm btn-icon danger" title="Eliminar" onclick="deleteService(${s.id}, '${escapeHtml(s.name).replace(/'/g, "\\'")}')">
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

async function openServiceModal(id = null) {
  const isEdit = id !== null;
  let service = { name: '', description: '', price: '', duration: '' };

  if (isEdit) {
    service = await window.api.services.getById(id);
  }

  openModal(isEdit ? 'Editar servicio' : 'Nuevo servicio', `
    <form id="service-form">
      <div class="form-group">
        <label class="form-label">Nombre <span class="required">*</span></label>
        <input type="text" class="form-control" id="service-name" value="${escapeHtml(service.name)}" placeholder="Ej: Sesión de terapia individual" required autofocus>
      </div>
      <div class="form-group">
        <label class="form-label">Descripción</label>
        <textarea class="form-control" id="service-description" placeholder="Descripción del servicio...">${escapeHtml(service.description || '')}</textarea>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Precio <span class="required">*</span></label>
          <input type="number" class="form-control" id="service-price" value="${service.price || ''}" placeholder="0.00" step="0.01" min="0" required>
        </div>
        <div class="form-group">
          <label class="form-label">Duración</label>
          <input type="text" class="form-control" id="service-duration" value="${escapeHtml(service.duration || '')}" placeholder="Ej: 60 min">
        </div>
      </div>
      <div class="modal-footer" style="padding:0;margin-top:8px;border-top:none;">
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
        <button type="submit" class="btn btn-primary">${isEdit ? 'Guardar cambios' : 'Crear servicio'}</button>
      </div>
    </form>
  `);

  document.getElementById('service-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const data = {
      name: document.getElementById('service-name').value.trim(),
      description: document.getElementById('service-description').value.trim(),
      price: parseFloat(document.getElementById('service-price').value) || 0,
      duration: document.getElementById('service-duration').value.trim()
    };

    if (!data.name) {
      showToast('El nombre es obligatorio', 'error');
      return;
    }

    if (isNaN(data.price) || data.price < 0) {
      showToast('El precio debe ser un número válido', 'error');
      return;
    }

    try {
      if (isEdit) {
        await window.api.services.update(id, data);
        showToast('Servicio actualizado correctamente', 'success');
      } else {
        await window.api.services.create(data);
        showToast('Servicio creado correctamente', 'success');
      }
      closeModal();
      await loadServices();
    } catch (err) {
      showToast('Error al guardar el servicio: ' + err.message, 'error');
    }
  });
}

async function deleteService(id, name) {
  const confirmed = await showConfirm(
    '¿Eliminar servicio?',
    `¿Estás seguro de que quieres eliminar "${name}"? Esta acción no se puede deshacer.`
  );

  if (!confirmed) return;

  try {
    await window.api.services.delete(id);
    showToast('Servicio eliminado', 'success');
    await loadServices();
  } catch (err) {
    showToast('Error al eliminar el servicio: ' + err.message, 'error');
  }
}
