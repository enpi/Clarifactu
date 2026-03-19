// ─── App Router ───────────────────────────────────────────────────────────────
const pages = {
  dashboard: renderDashboard,
  clients: renderClients,
  services: renderServices,
  'new-invoice': renderNewInvoice,
  invoices: renderInvoices,
  documents: renderDocuments,
  settings: renderSettings
};

let currentPage = 'dashboard';

function navigateTo(page, params = null) {
  if (!pages[page]) return;

  // Update sidebar active state
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.page === page);
  });

  currentPage = page;

  // Clear and render the page
  const container = document.getElementById('page-container');
  container.innerHTML = '';
  pages[page](container, params);
}

// ─── Sidebar Navigation ───────────────────────────────────────────────────────
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => {
    navigateTo(item.dataset.page);
  });
});

// ─── Modal System ─────────────────────────────────────────────────────────────
const modalOverlay = document.getElementById('modal-overlay');
const modalContainer = document.getElementById('modal-container');
const modalTitle = document.getElementById('modal-title');
const modalBody = document.getElementById('modal-body');
const modalCloseBtn = document.getElementById('modal-close-btn');

function openModal(title, bodyHtml, options = {}) {
  modalTitle.textContent = title;
  modalBody.innerHTML = bodyHtml;

  // Reset size classes
  modalContainer.classList.remove('modal-lg', 'modal-xl');
  if (options.size === 'lg') modalContainer.classList.add('modal-lg');
  if (options.size === 'xl') modalContainer.classList.add('modal-xl');

  modalOverlay.classList.remove('hidden');

  return {
    body: modalBody,
    close: closeModal
  };
}

function closeModal() {
  modalOverlay.classList.add('hidden');
  modalBody.innerHTML = '';
}

modalCloseBtn.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) closeModal();
});

// ─── Confirm Dialog ───────────────────────────────────────────────────────────
const confirmOverlay = document.getElementById('confirm-overlay');
const confirmTitle = document.getElementById('confirm-title');
const confirmMessage = document.getElementById('confirm-message');
const confirmOkBtn = document.getElementById('confirm-ok');
const confirmCancelBtn = document.getElementById('confirm-cancel');

function showConfirm(title, message, okLabel = 'Eliminar') {
  return new Promise((resolve) => {
    confirmTitle.textContent = title;
    confirmMessage.textContent = message;
    confirmOkBtn.textContent = okLabel;
    confirmOverlay.classList.remove('hidden');

    const onOk = () => {
      cleanup();
      resolve(true);
    };

    const onCancel = () => {
      cleanup();
      resolve(false);
    };

    const cleanup = () => {
      confirmOverlay.classList.add('hidden');
      confirmOkBtn.removeEventListener('click', onOk);
      confirmCancelBtn.removeEventListener('click', onCancel);
    };

    confirmOkBtn.addEventListener('click', onOk);
    confirmCancelBtn.addEventListener('click', onCancel);
  });
}

confirmOverlay.addEventListener('click', (e) => {
  if (e.target === confirmOverlay) {
    confirmOverlay.classList.add('hidden');
  }
});

// ─── Toast System ─────────────────────────────────────────────────────────────
function showToast(message, type = 'success', duration = 3000) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const icons = {
    success: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>',
    error: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
    info: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
    warning: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>'
  };

  toast.innerHTML = `${icons[type] || icons.info}<span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'fadeOut 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatCurrency(amount) {
  if (amount == null || isNaN(amount)) return '0,00 €';
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR'
  }).format(amount);
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDateTime(dtStr) {
  if (!dtStr) return '-';
  const d = new Date(dtStr);
  return d.toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function timeAgo(dtStr) {
  if (!dtStr) return '';
  const diff = Math.floor((Date.now() - new Date(dtStr)) / 1000);
  if (diff < 60) return 'hace un momento';
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  if (diff < 172800) return 'ayer';
  return formatDateTime(dtStr);
}

function today() {
  return new Date().toISOString().split('T')[0];
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function debounce(fn, delay = 250) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// ─── Global Search ────────────────────────────────────────────────────────────
const searchOverlay = document.getElementById('search-overlay');
const globalSearchInput = document.getElementById('global-search-input');
const searchResults = document.getElementById('search-results');
let searchSelectedIndex = -1;

function openSearch() {
  searchOverlay.classList.remove('hidden');
  globalSearchInput.value = '';
  searchResults.innerHTML = '';
  searchSelectedIndex = -1;
  setTimeout(() => globalSearchInput.focus(), 50);
}

function closeSearch() {
  searchOverlay.classList.add('hidden');
  searchResults.innerHTML = '';
}

document.getElementById('search-trigger-btn').addEventListener('click', openSearch);

searchOverlay.addEventListener('click', (e) => {
  if (e.target === searchOverlay) closeSearch();
});

document.addEventListener('keydown', (e) => {
  const inInput = ['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)
    || document.activeElement?.isContentEditable;

  // ── Ctrl+K — búsqueda global ───────────────────────────────────────────────
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
    e.preventDefault();
    searchOverlay.classList.contains('hidden') ? openSearch() : closeSearch();
    return;
  }

  // ── Escape — cerrar búsqueda o modal ──────────────────────────────────────
  if (e.key === 'Escape') {
    if (!searchOverlay.classList.contains('hidden')) { closeSearch(); return; }
    if (!modalOverlay.classList.contains('hidden')) { closeModal(); return; }
  }

  // ── Navegación búsqueda con flechas ───────────────────────────────────────
  if (!searchOverlay.classList.contains('hidden')) {
    const items = searchResults.querySelectorAll('.search-result-item');
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      searchSelectedIndex = Math.min(searchSelectedIndex + 1, items.length - 1);
      items.forEach((el, i) => el.classList.toggle('selected', i === searchSelectedIndex));
      items[searchSelectedIndex]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      searchSelectedIndex = Math.max(searchSelectedIndex - 1, 0);
      items.forEach((el, i) => el.classList.toggle('selected', i === searchSelectedIndex));
      items[searchSelectedIndex]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter' && searchSelectedIndex >= 0) {
      items[searchSelectedIndex]?.click();
    }
    return;
  }

  // No disparar atajos de navegación mientras se escribe
  if (inInput) return;

  // ── Alt+1-6 — navegación rápida ───────────────────────────────────────────
  if (e.altKey && !e.ctrlKey && !e.shiftKey) {
    const navMap = { '1': 'dashboard', '2': 'clients', '3': 'services', '4': 'invoices', '5': 'documents', '6': 'settings' };
    if (navMap[e.key]) { e.preventDefault(); navigateTo(navMap[e.key]); return; }
  }

  // ── F — nueva factura ─────────────────────────────────────────────────────
  if (e.key === 'f' && !e.ctrlKey && !e.altKey && !e.metaKey) {
    e.preventDefault();
    navigateTo('new-invoice');
    return;
  }

  // ── C — nuevo cliente ─────────────────────────────────────────────────────
  if (e.key === 'c' && !e.ctrlKey && !e.altKey && !e.metaKey) {
    e.preventDefault();
    navigateTo('clients');
    setTimeout(() => document.getElementById('new-client-btn')?.click(), 0);
    return;
  }

  // ── S — nuevo servicio ────────────────────────────────────────────────────
  if (e.key === 's' && !e.ctrlKey && !e.altKey && !e.metaKey) {
    e.preventDefault();
    navigateTo('services');
    setTimeout(() => document.getElementById('new-service-btn')?.click(), 0);
    return;
  }

  // ── D — ir a documentos ───────────────────────────────────────────────────
  if (e.key === 'd' && !e.ctrlKey && !e.altKey && !e.metaKey) {
    e.preventDefault();
    navigateTo('documents');
    return;
  }

  // ── N — nuevo documento ───────────────────────────────────────────────────
  if (e.key === 'n' && !e.ctrlKey && !e.altKey && !e.metaKey) {
    e.preventDefault();
    navigateTo('documents');
    setTimeout(() => document.getElementById('doc-new-btn')?.click(), 50);
    return;
  }

  // ── Ctrl+, — configuración ────────────────────────────────────────────────
  if ((e.ctrlKey || e.metaKey) && e.key === ',') {
    e.preventDefault();
    navigateTo('settings');
    return;
  }

  // ── ? — ayuda de atajos ───────────────────────────────────────────────────
  if (e.key === '?' || (e.shiftKey && e.key === '/')) {
    e.preventDefault();
    openModal('Atajos de teclado', `
      <div style="display:grid;grid-template-columns:auto 1fr;gap:10px 20px;align-items:center;font-size:13.5px;">
        <kbd style="${kbdStyle}">Ctrl K</kbd><span>Búsqueda global</span>
        <kbd style="${kbdStyle}">Esc</kbd><span>Cerrar modal / búsqueda</span>
        <div style="grid-column:1/-1;border-top:1px solid var(--border);margin:4px 0;"></div>
        <kbd style="${kbdStyle}">F</kbd><span>Nueva factura</span>
        <kbd style="${kbdStyle}">C</kbd><span>Nuevo cliente</span>
        <kbd style="${kbdStyle}">S</kbd><span>Nuevo servicio</span>
        <kbd style="${kbdStyle}">D</kbd><span>Ir a Documentos</span>
        <kbd style="${kbdStyle}">N</kbd><span>Nuevo documento</span>
        <div style="grid-column:1/-1;border-top:1px solid var(--border);margin:4px 0;"></div>
        <kbd style="${kbdStyle}">Alt 1</kbd><span>Dashboard</span>
        <kbd style="${kbdStyle}">Alt 2</kbd><span>Clientes</span>
        <kbd style="${kbdStyle}">Alt 3</kbd><span>Servicios</span>
        <kbd style="${kbdStyle}">Alt 4</kbd><span>Facturas</span>
        <kbd style="${kbdStyle}">Alt 5</kbd><span>Documentos</span>
        <kbd style="${kbdStyle}">Alt 6</kbd><span>Configuración</span>
        <div style="grid-column:1/-1;border-top:1px solid var(--border);margin:4px 0;"></div>
        <kbd style="${kbdStyle}">Ctrl ,</kbd><span>Configuración</span>
        <kbd style="${kbdStyle}">?</kbd><span>Mostrar esta ayuda</span>
      </div>
    `);
    return;
  }
});

const kbdStyle = `
  display:inline-flex;align-items:center;justify-content:center;
  background:var(--content-bg);border:1px solid var(--border);
  border-radius:5px;padding:3px 8px;font-family:'SF Mono','Fira Code','Consolas',monospace;
  font-size:11.5px;font-weight:600;color:var(--text-primary);
  box-shadow:0 1px 2px rgba(0,0,0,0.08);white-space:nowrap;
`.replace(/\n\s*/g, '');

globalSearchInput.addEventListener('input', debounce(async (e) => {
  const q = e.target.value.trim();
  searchSelectedIndex = -1;

  if (q.length < 2) {
    searchResults.innerHTML = q.length === 0
      ? `<div class="search-empty">Escribe para buscar en facturas, clientes, servicios y documentos</div>`
      : '';
    return;
  }

  searchResults.innerHTML = `<div class="search-empty"><div class="spinner" style="width:16px;height:16px;margin:0 auto;"></div></div>`;

  const [invoices, clients, services, documents] = await Promise.all([
    window.api.invoices.search(q),
    window.api.clients.search(q),
    window.api.services.search(q),
    window.api.documents.search(q)
  ]);

  const total = invoices.length + clients.length + services.length + documents.length;

  if (total === 0) {
    searchResults.innerHTML = `<div class="search-empty">Sin resultados para "<strong>${escapeHtml(q)}</strong>"</div>`;
    return;
  }

  const sections = [];

  if (invoices.length > 0) {
    sections.push(`
      <div class="search-section-label">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        Facturas
      </div>
      ${invoices.slice(0, 5).map(inv => `
        <div class="search-result-item" data-action="invoice" data-id="${inv.id}">
          <div class="search-result-icon invoice-icon">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          </div>
          <div class="search-result-info">
            <div class="search-result-title">${escapeHtml(inv.invoice_number)}</div>
            <div class="search-result-sub">${escapeHtml(inv.client_name || 'Sin cliente')} · ${formatDate(inv.date)} · ${formatCurrency(inv.total)}</div>
          </div>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--text-secondary);flex-shrink:0;"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
      `).join('')}
    `);
  }

  if (clients.length > 0) {
    sections.push(`
      <div class="search-section-label">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
        Clientes
      </div>
      ${clients.slice(0, 5).map(c => `
        <div class="search-result-item" data-action="client" data-id="${c.id}">
          <div class="search-result-icon client-icon">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
          </div>
          <div class="search-result-info">
            <div class="search-result-title">${escapeHtml(c.name)}</div>
            <div class="search-result-sub">${[c.nif, c.email, c.phone].filter(Boolean).map(escapeHtml).join(' · ') || 'Sin datos adicionales'}</div>
          </div>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--text-secondary);flex-shrink:0;"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
      `).join('')}
    `);
  }

  if (services.length > 0) {
    sections.push(`
      <div class="search-section-label">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
        Servicios
      </div>
      ${services.slice(0, 5).map(s => `
        <div class="search-result-item" data-action="service" data-id="${s.id}">
          <div class="search-result-icon service-icon">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
          </div>
          <div class="search-result-info">
            <div class="search-result-title">${escapeHtml(s.name)}</div>
            <div class="search-result-sub">${formatCurrency(s.price)}${s.duration ? ' · ' + escapeHtml(s.duration) : ''}</div>
          </div>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--text-secondary);flex-shrink:0;"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
      `).join('')}
    `);
  }

  if (documents.length > 0) {
    sections.push(`
      <div class="search-section-label">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="12" y1="17" x2="8" y2="17"/></svg>
        Documentos
      </div>
      ${documents.slice(0, 5).map(d => `
        <div class="search-result-item" data-action="document" data-id="${d.id}">
          <div class="search-result-icon" style="background:#f0fdf4;color:#059669;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="12" y1="17" x2="8" y2="17"/></svg>
          </div>
          <div class="search-result-info">
            <div class="search-result-title">${escapeHtml(d.title)}</div>
            <div class="search-result-sub">${d.client_name ? escapeHtml(d.client_name) + ' · ' : ''}${formatDate((d.created_at || '').split(' ')[0])}</div>
          </div>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:var(--text-secondary);flex-shrink:0;"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
      `).join('')}
    `);
  }

  searchResults.innerHTML = sections.join('');

  searchResults.querySelectorAll('.search-result-item').forEach(item => {
    item.addEventListener('click', () => {
      const { action, id } = item.dataset;
      closeSearch();
      if (action === 'invoice') {
        navigateTo('invoices');
        setTimeout(() => viewInvoice(parseInt(id)), 300);
      } else if (action === 'client') {
        navigateTo('clients');
      } else if (action === 'service') {
        navigateTo('services');
      } else if (action === 'document') {
        navigateTo('documents');
        setTimeout(() => openDocumentPreview(parseInt(id)), 300);
      }
    });
    item.addEventListener('mouseenter', () => {
      const items = searchResults.querySelectorAll('.search-result-item');
      searchSelectedIndex = Array.from(items).indexOf(item);
      items.forEach((el, i) => el.classList.toggle('selected', i === searchSelectedIndex));
    });
  });
}, 180));

// ─── Pagination Helper ────────────────────────────────────────────────────────
function renderPagination(containerId, current, total, onPageChange) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (total <= 1) { el.innerHTML = ''; return; }

  const wrap = document.createElement('div');
  wrap.className = 'pagination';

  const btn = (label, page, disabled, active) => {
    const b = document.createElement('button');
    b.className = 'page-btn' + (active ? ' active' : '');
    b.innerHTML = label;
    b.disabled = disabled;
    if (!disabled) b.addEventListener('click', () => onPageChange(page));
    return b;
  };

  wrap.appendChild(btn('&#8249;', current - 1, current === 1, false));

  const show = [...new Set([1, total, current, current - 1, current + 1].filter(p => p >= 1 && p <= total))].sort((a, b) => a - b);
  let prev = null;
  for (const p of show) {
    if (prev !== null && p > prev + 1) {
      const gap = document.createElement('span');
      gap.className = 'page-gap';
      gap.textContent = '…';
      wrap.appendChild(gap);
    }
    wrap.appendChild(btn(String(p), p, false, p === current));
    prev = p;
  }

  wrap.appendChild(btn('&#8250;', current + 1, current === total, false));

  el.innerHTML = '';
  el.appendChild(wrap);
}

// ─── Init ─────────────────────────────────────────────────────────────────────
(async function initAppearance() {
  const biz = await window.api.settings.getBusiness();
  if (biz?.dark_mode) document.body.classList.add('dark');
})();

(async function initSidebarIcon() {
  const url = await window.api.getIconDataUrl();
  if (url) {
    const img = document.getElementById('app-sidebar-icon');
    if (img) img.src = url;
  }
})();

navigateTo('dashboard');

// ─── Onboarding ───────────────────────────────────────────────────────────────
(async function checkOnboarding() {
  try {
    const done = await window.api.settings.isOnboardingDone();
    if (!done) setTimeout(() => showOnboardingWizard(), 500);
  } catch (_) {}
})();

// ─── Auto-update notifications ────────────────────────────────────────────────
(function initUpdateListeners() {
  if (!window.api.update) return;

  window.api.update.onAvailable((data) => {
    showUpdateBar(`Descargando actualización ${data.version}...`);
  });
  window.api.update.onProgress((data) => {
    const fill = document.getElementById('update-progress-fill');
    if (fill) fill.style.width = data.percent + '%';
    const msg = document.getElementById('update-bar-msg');
    if (msg) msg.textContent = `Descargando v${data.version || ''}... ${data.percent}%`;
  });
  window.api.update.onDownloaded((data) => {
    showUpdateReadyBanner(data.version);
  });
})();

function showUpdateBar(message) {
  let bar = document.getElementById('update-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'update-bar';
    bar.style.cssText = 'position:fixed;bottom:0;left:0;right:0;background:#2563eb;color:#fff;padding:10px 20px;font-size:13px;display:flex;align-items:center;gap:12px;z-index:9999;';
    document.body.appendChild(bar);
  }
  bar.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0;">
      <polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
    </svg>
    <span id="update-bar-msg">${message}</span>
    <div id="update-progress-wrap" style="flex:1;max-width:200px;height:4px;background:rgba(255,255,255,0.3);border-radius:2px;overflow:hidden;">
      <div id="update-progress-fill" style="height:100%;background:#fff;width:0%;transition:width 0.3s;"></div>
    </div>
  `;
}

function showUpdateReadyBanner(version) {
  let bar = document.getElementById('update-bar');
  if (!bar) { showUpdateBar(''); bar = document.getElementById('update-bar'); }
  bar.style.background = '#059669';
  bar.innerHTML = `
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0;">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
    <span>Versión ${escapeHtml(version)} lista para instalar.</span>
    <div style="flex:1;"></div>
    <button onclick="window.api.update.installNow()" style="background:#fff;color:#059669;border:none;padding:5px 14px;border-radius:5px;cursor:pointer;font-size:12px;font-weight:600;">
      Instalar y reiniciar
    </button>
    <button onclick="document.getElementById('update-bar').remove()" style="background:none;border:none;color:#fff;cursor:pointer;padding:4px;font-size:16px;">×</button>
  `;
}
