// ─── Settings Page ─────────────────────────────────────────────────────────────

async function renderSettings(container) {
  const [business, numberSettings, emailCfg, vfCfg, appInfo] = await Promise.all([
    window.api.settings.getBusiness(),
    window.api.settings.getNumberSettings(),
    window.api.email.getSettings(),
    window.api.verifactu.getSettings(),
    window.api.getInfo(),
  ]);

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">Configuración</h1>
        <p class="page-subtitle">Datos de tu empresa y configuración de facturas</p>
      </div>
    </div>

    <!-- Tab bar -->
    <div class="settings-tabs">
      <button class="settings-tab active" data-tab="empresa">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        Empresa
      </button>
      <button class="settings-tab" data-tab="apariencia">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
        Apariencia
      </button>
      <button class="settings-tab" data-tab="facturas">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        Facturas
      </button>
      <button class="settings-tab" data-tab="email">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
        Email
      </button>
      <button class="settings-tab" data-tab="backup">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
        Backup
      </button>
      <button class="settings-tab" data-tab="info">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        Info
      </button>
      <button class="settings-tab" data-tab="avanzado">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
        Avanzado
      </button>
    </div>

    <!-- ── Pestaña: Empresa ── -->
    <div class="settings-panel active" data-panel="empresa">
      <div class="card">
        <div class="card-header"><span class="card-title">Datos de la empresa</span></div>
        <div class="card-body">
          <form id="business-form">
            <div class="form-group">
              <label class="form-label">Nombre / Razón social</label>
              <input type="text" class="form-control" id="biz-name" value="${escapeHtml(business.name || '')}" placeholder="Tu nombre o empresa">
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">NIF / CIF</label>
                <input type="text" class="form-control" id="biz-nif" value="${escapeHtml(business.nif || '')}" placeholder="12345678A">
              </div>
              <div class="form-group">
                <label class="form-label">Teléfono</label>
                <input type="text" class="form-control" id="biz-phone" value="${escapeHtml(business.phone || '')}" placeholder="+34 600 000 000">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Email</label>
                <input type="email" class="form-control" id="biz-email" value="${escapeHtml(business.email || '')}" placeholder="tu@email.com">
              </div>
              <div class="form-group">
                <label class="form-label">IBAN</label>
                <input type="text" class="form-control" id="biz-iban" value="${escapeHtml(business.iban || '')}" placeholder="ES00 0000 0000 0000 0000 0000">
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Dirección</label>
              <input type="text" class="form-control" id="biz-address" value="${escapeHtml(business.address || '')}" placeholder="Calle, número, ciudad, CP">
            </div>
            <div class="form-group">
              <label class="form-label">Información adicional</label>
              <textarea class="form-control" id="biz-extra" placeholder="Notas legales, condiciones...">${escapeHtml(business.extra_info || '')}</textarea>
            </div>
            <div class="form-group">
              <label class="form-label">Logo</label>
              <div class="logo-preview-wrapper">
                ${business.logo
                  ? `<img src="${business.logo}" class="logo-preview" id="logo-preview-img" alt="Logo">`
                  : `<div class="logo-placeholder" id="logo-preview-img">Sin logo</div>`
                }
                <div style="display:flex;flex-direction:column;gap:8px;">
                  <button type="button" class="btn btn-secondary btn-sm" id="select-logo-btn">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                    Seleccionar imagen
                  </button>
                  <button type="button" class="btn btn-ghost btn-sm" id="remove-logo-btn" style="${business.logo ? '' : 'display:none;'}">Eliminar logo</button>
                </div>
              </div>
              <input type="hidden" id="biz-logo" value="${business.logo ? 'has-logo' : ''}">
            </div>
            <div class="form-group">
              <label class="form-label">Firma</label>
              <p style="font-size:12px;color:var(--text-secondary);margin-bottom:10px;">
                Se incrustará automáticamente en los documentos exportados como PDF.
              </p>
              <div class="logo-preview-wrapper">
                ${business.signature
                  ? `<img src="${business.signature}" class="logo-preview" id="sig-preview-img" alt="Firma" style="max-height:80px;background:repeating-linear-gradient(45deg,#f1f5f9 0,#f1f5f9 5px,#fff 5px,#fff 10px);border-radius:6px;padding:4px;">`
                  : `<div class="logo-placeholder" id="sig-preview-img">Sin firma</div>`
                }
                <div style="display:flex;flex-direction:column;gap:8px;">
                  <button type="button" class="btn btn-secondary btn-sm" id="draw-sig-btn">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                    Dibujar firma
                  </button>
                  <button type="button" class="btn btn-secondary btn-sm" id="select-sig-btn">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                    Subir imagen
                  </button>
                  <button type="button" class="btn btn-ghost btn-sm" id="remove-sig-btn" style="${business.signature ? '' : 'display:none;'}">Eliminar firma</button>
                </div>
              </div>
              <input type="hidden" id="biz-signature" value="${business.signature ? 'has-sig' : ''}">
            </div>
            <div style="margin-top:8px;">
              <button type="submit" class="btn btn-primary">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                Guardar datos
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <!-- ── Pestaña: Facturas ── -->
    <div class="settings-panel" data-panel="facturas">
      <div class="card">
        <div class="card-header"><span class="card-title">Numeración de facturas</span></div>
        <div class="card-body">
          <form id="number-form">
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Prefijo</label>
                <input type="text" class="form-control" id="num-prefix" value="${escapeHtml(numberSettings.prefix || 'F')}" placeholder="F" maxlength="10">
              </div>
              <div class="form-group">
                <label class="form-label">Separador</label>
                <input type="text" class="form-control" id="num-separator" value="${escapeHtml(numberSettings.separator || '-')}" placeholder="-" maxlength="5">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Dígitos del contador</label>
                <input type="number" class="form-control" id="num-digits" value="${numberSettings.digits || 4}" min="1" max="10">
              </div>
              <div class="form-group">
                <label class="form-label">Número inicial</label>
                <input type="number" class="form-control" id="num-start" value="${numberSettings.start_number || 1}" min="1">
              </div>
            </div>
            <div class="form-group">
              <label class="form-label" style="display:flex;align-items:center;gap:10px;cursor:pointer;">
                <input type="checkbox" id="num-show-year" ${numberSettings.show_year ? 'checked' : ''} style="width:16px;height:16px;cursor:pointer;accent-color:var(--primary);">
                Incluir año en el número
              </label>
            </div>
            <div class="form-group">
              <label class="form-label">Vista previa</label>
              <div class="invoice-number-preview" id="number-preview">${generatePreviewNumber(numberSettings)}</div>
            </div>
            <div style="margin-top:8px;">
              <button type="submit" class="btn btn-primary">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                Guardar configuración
              </button>
            </div>
          </form>
        </div>
      </div>

      <div class="card" style="margin-top:20px;">
        <div class="card-header"><span class="card-title">Estado de cobro</span></div>
        <div class="card-body">
          <p style="font-size:13px;color:var(--text-secondary);margin-bottom:14px;">
            Define cuántos días deben pasar desde la fecha de la factura para que una factura pendiente pase automáticamente a estado <span class="badge badge-overdue" style="vertical-align:middle;">Vencida</span>.
          </p>
          <div style="display:flex;align-items:center;gap:12px;">
            <input type="number" class="form-control" id="num-overdue-days" value="${numberSettings.overdue_days ?? 30}" min="1" max="365" style="width:90px;">
            <span style="font-size:13.5px;color:var(--text-primary);">días sin cobrar</span>
          </div>
        </div>
      </div>

      <div class="card" style="margin-top:20px;border-color:#fee2e2;">
        <div class="card-header" style="background:#fff5f5;">
          <span class="card-title" style="color:#dc2626;">Zona de riesgo</span>
        </div>
        <div class="card-body">
          <p style="font-size:13px;color:var(--text-secondary);margin-bottom:12px;">
            Reiniciar el contador hará que el próximo número de factura comience desde el inicio. Las facturas existentes no se verán afectadas.
          </p>
          <button class="btn btn-danger btn-sm" id="reset-counter-btn">Reiniciar contador de facturas</button>
        </div>
      </div>
    </div>

    <!-- ── Pestaña: Email ── -->
    <div class="settings-panel" data-panel="email">
      <div class="card">
        <div class="card-header"><span class="card-title">Envío de facturas por Gmail</span></div>
        <div class="card-body">
          <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:12px 14px;margin-bottom:16px;font-size:12.5px;color:#1e40af;line-height:1.6;">
            <strong>¿Cómo configurar?</strong><br>
            1. Ve a tu cuenta Google → Seguridad → Verificación en dos pasos (actívala si no está)<br>
            2. En Seguridad → Contraseñas de aplicaciones → genera una para "Clarifactu"<br>
            3. Pega aquí tu email de Gmail y esa contraseña de 16 caracteres
          </div>
          <form id="email-form">
            <div class="form-group">
              <label class="form-label">Cuenta Gmail</label>
              <input type="email" class="form-control" id="email-user" value="${escapeHtml(emailCfg.gmail_user || '')}" placeholder="tucuenta@gmail.com">
            </div>
            <div class="form-group">
              <label class="form-label">Contraseña de aplicación</label>
              <input type="password" class="form-control" id="email-pass" value="${escapeHtml(emailCfg.gmail_app_password || '')}" placeholder="xxxx xxxx xxxx xxxx">
            </div>
            <div class="form-group">
              <label class="form-label">Asunto por defecto</label>
              <input type="text" class="form-control" id="email-subject" value="${escapeHtml(emailCfg.default_subject || 'Factura {numero}')}" placeholder="Factura {numero}">
              <small style="color:var(--text-secondary);font-size:11.5px;">Variables: {numero}, {cliente}, {total}, {fecha}</small>
            </div>
            <div class="form-group" style="margin-bottom:0;">
              <label class="form-label">Cuerpo por defecto</label>
              <textarea class="form-control" id="email-body" rows="5" placeholder="Mensaje del email...">${escapeHtml(emailCfg.default_body || '')}</textarea>
              <small style="color:var(--text-secondary);font-size:11.5px;">Variables: {numero}, {cliente}, {total}, {fecha}</small>
            </div>
            <div style="display:flex;gap:8px;margin-top:16px;">
              <button type="submit" class="btn btn-primary btn-sm">Guardar</button>
              <button type="button" class="btn btn-secondary btn-sm" id="test-email-btn">Probar conexión</button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <!-- ── Pestaña: Backup ── -->
    <div class="settings-panel" data-panel="backup">
      <div class="card">
        <div class="card-header">
          <span class="card-title">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:inline;vertical-align:middle;margin-right:6px;"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
            Copia de seguridad
          </span>
          <button class="btn btn-primary btn-sm" id="create-backup-btn">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
            Crear backup ahora
          </button>
        </div>
        <div class="card-body">
          <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:12px 14px;margin-bottom:16px;font-size:12.5px;color:#1e40af;line-height:1.6;">
            <strong>¿Qué incluye el backup?</strong> Una copia completa de tu base de datos: clientes, servicios, facturas y configuración.
            Se guardan automáticamente los <strong>5 backups más recientes</strong>; los anteriores se eliminan.
          </div>
          <div id="backup-list-container">
            <div style="color:var(--text-secondary);font-size:13px;text-align:center;padding:20px 0;">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom:8px;opacity:.4;display:block;margin-left:auto;margin-right:auto;"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
              Aún no hay backups creados
            </div>
          </div>
        </div>
      </div>

      <div class="card" style="margin-top:20px;border-color:#fee2e2;">
        <div class="card-header" style="background:#fff5f5;">
          <span class="card-title" style="color:#dc2626;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:inline;vertical-align:middle;margin-right:6px;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            Importar backup externo
          </span>
        </div>
        <div class="card-body">
          <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:12px 14px;margin-bottom:16px;font-size:12.5px;color:#92400e;line-height:1.6;">
            <strong>Atención:</strong> Importar un backup <strong>reemplazará completamente</strong> todos los datos actuales de la aplicación.
            Esta acción no se puede deshacer. La aplicación se reiniciará automáticamente tras la restauración.
          </div>
          <button class="btn btn-secondary btn-sm" id="import-backup-btn">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            Seleccionar archivo .db para importar
          </button>
        </div>
      </div>
    </div>

    <!-- ── Pestaña: Apariencia ── -->
    <div class="settings-panel" data-panel="apariencia">
      <!-- Dark mode -->
      <div class="card">
        <div class="card-header"><span class="card-title">Modo oscuro</span></div>
        <div class="card-body">
          <label style="display:flex;align-items:center;gap:14px;cursor:pointer;">
            <div class="toggle-switch" id="dark-mode-toggle" style="position:relative;width:44px;height:24px;flex-shrink:0;">
              <input type="checkbox" id="dark-mode-checkbox" ${business.dark_mode ? 'checked' : ''} style="opacity:0;width:0;height:0;position:absolute;">
              <span class="toggle-slider" style="
                position:absolute;inset:0;border-radius:24px;cursor:pointer;
                background:${business.dark_mode ? 'var(--primary)' : '#cbd5e1'};
                transition:background 0.2s;
              ">
                <span style="
                  position:absolute;top:3px;left:${business.dark_mode ? '23px' : '3px'};
                  width:18px;height:18px;border-radius:50%;background:white;
                  transition:left 0.2s;box-shadow:0 1px 3px rgba(0,0,0,0.2);
                "></span>
              </span>
            </div>
            <div>
              <div style="font-weight:500;font-size:14px;">Activar modo oscuro</div>
              <div style="font-size:12px;color:var(--text-secondary);margin-top:2px;">Aplica un tema oscuro a toda la aplicación</div>
            </div>
          </label>
        </div>
      </div>

      <!-- Invoice templates -->
      <div class="card" style="margin-top:20px;">
        <div class="card-header"><span class="card-title">Plantilla de factura</span></div>
        <div class="card-body">
          <p style="font-size:13px;color:var(--text-secondary);margin-bottom:16px;">
            Elige el diseño visual que se aplicará al PDF y la vista previa de tus facturas.
          </p>
          <div class="template-grid" id="template-grid">
            ${[
              { id: 'clasica', label: 'Clásica', desc: 'Azul corporativo', accent: '#2563EB' },
              { id: 'minimal', label: 'Minimal', desc: 'Sobrio y limpio', accent: '#1e293b' },
              { id: 'moderna', label: 'Moderna', desc: 'Negro con acento morado', accent: '#0f172a' }
            ].map(t => {
              const isSelected = (business.invoice_template || 'clasica') === t.id;
              return `
              <div class="template-card${isSelected ? ' selected' : ''}" data-tpl="${t.id}" style="position:relative;">
                ${isSelected ? `<div style="position:absolute;top:8px;right:8px;width:18px;height:18px;border-radius:50%;background:var(--primary);display:flex;align-items:center;justify-content:center;" id="tpl-check-${t.id}">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
                </div>` : `<div style="position:absolute;top:8px;right:8px;width:18px;height:18px;border-radius:50%;background:transparent;" id="tpl-check-${t.id}"></div>`}
                <div class="template-preview-box" style="border-top:4px solid ${t.accent};pointer-events:none;">
                  <div style="height:8px;background:${t.accent};border-radius:0 0 2px 2px;width:40%;margin-bottom:6px;"></div>
                  <div style="height:4px;background:#e2e8f0;border-radius:2px;width:80%;margin-bottom:3px;"></div>
                  <div style="height:4px;background:#e2e8f0;border-radius:2px;width:60%;margin-bottom:6px;"></div>
                  <div style="height:3px;background:${t.accent};opacity:0.3;border-radius:2px;width:100%;margin-bottom:3px;"></div>
                  <div style="height:3px;background:#e2e8f0;border-radius:2px;width:100%;margin-bottom:3px;"></div>
                  <div style="height:3px;background:#e2e8f0;border-radius:2px;width:100%;margin-bottom:8px;"></div>
                  <div style="height:6px;background:${t.accent};border-radius:2px;width:50%;margin-left:auto;"></div>
                </div>
                <div class="template-card-label" style="pointer-events:none;">${t.label}</div>
                <div class="template-card-desc" style="pointer-events:none;">${t.desc}</div>
              </div>`;
            }).join('')}
          </div>
          <div style="margin-top:16px;">
            <button class="btn btn-primary btn-sm" id="save-appearance-btn">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
              Guardar apariencia
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Pestaña: Info ── -->
    <div class="settings-panel" data-panel="info">
      <!-- App info card -->
      <div class="card">
        <div class="card-header"><span class="card-title">Acerca de Clarifactu</span></div>
        <div class="card-body">
          <div style="display:flex;align-items:center;gap:20px;padding:8px 0 20px;">
            <div style="width:64px;height:64px;flex-shrink:0;">
              <img id="info-app-icon" width="64" height="64" style="display:block;border-radius:12px;">
            </div>
            <div>
              <div style="font-size:20px;font-weight:700;color:var(--text-primary);letter-spacing:-0.3px;">Clarifactu</div>
              <div style="font-size:13px;color:var(--text-secondary);margin-top:2px;">Facturación para terapeutas y profesionales</div>
              <div style="margin-top:8px;">
                <span style="background:#eff6ff;color:#2563EB;font-size:11.5px;font-weight:600;padding:3px 10px;border-radius:20px;border:1px solid #bfdbfe;">
                  v${appInfo.version}
                </span>
              </div>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;padding-top:16px;border-top:1px solid var(--border);">
            <div style="background:var(--content-bg);border-radius:8px;padding:12px 14px;">
              <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-secondary);margin-bottom:4px;">Motor</div>
              <div style="font-size:13px;font-weight:500;color:var(--text-primary);">Electron ${appInfo.electron}</div>
            </div>
            <div style="background:var(--content-bg);border-radius:8px;padding:12px 14px;">
              <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-secondary);margin-bottom:4px;">Base de datos</div>
              <div style="font-size:13px;font-weight:500;color:var(--text-primary);">SQLite (better-sqlite3)</div>
            </div>
            <div style="background:var(--content-bg);border-radius:8px;padding:12px 14px;">
              <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-secondary);margin-bottom:4px;">Interfaz</div>
              <div style="font-size:13px;font-weight:500;color:var(--text-primary);">Vanilla JS + HTML/CSS</div>
            </div>
            <div style="background:var(--content-bg);border-radius:8px;padding:12px 14px;">
              <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-secondary);margin-bottom:4px;">Plataforma</div>
              <div style="font-size:13px;font-weight:500;color:var(--text-primary);">Windows</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Update card -->
      <div class="card" style="margin-top:20px;">
        <div class="card-header"><span class="card-title">Actualizaciones</span></div>
        <div class="card-body" style="display:flex;align-items:center;justify-content:space-between;gap:16px;">
          <div style="font-size:13px;color:var(--text-secondary);" id="update-check-msg">
            La aplicación busca actualizaciones automáticamente al arrancar.
          </div>
          <button class="btn btn-secondary" id="check-update-btn" style="flex-shrink:0;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
            Buscar ahora
          </button>
        </div>
      </div>

      <!-- License card -->
      <div class="card" style="margin-top:20px;">
        <div class="card-header">
          <span class="card-title">Licencia</span>
        </div>
        <div class="card-body">
          ${appInfo.license ? `
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;">
              <div style="width:36px;height:36px;background:#f0fdf4;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              </div>
              <div>
                <div style="font-size:14px;font-weight:600;color:#059669;">Licencia activa</div>
                <div style="font-size:12px;color:var(--text-secondary);margin-top:1px;">Activada el ${formatDate(appInfo.license.activatedAt?.split('T')[0])}</div>
              </div>
            </div>
            <div style="background:var(--content-bg);border-radius:8px;padding:14px 16px;margin-bottom:16px;">
              <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-secondary);margin-bottom:8px;">Clave de licencia</div>
              <div style="font-family:'SF Mono','Fira Code','Consolas',monospace;font-size:16px;font-weight:700;letter-spacing:0.1em;color:var(--text-primary);">${appInfo.license.key}</div>
            </div>
            <button class="btn btn-secondary btn-sm" id="change-license-btn">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              Cambiar licencia
            </button>
          ` : `
            <div style="display:flex;align-items:center;gap:12px;">
              <div style="width:36px;height:36px;background:#fef2f2;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              </div>
              <div>
                <div style="font-size:14px;font-weight:600;color:#dc2626;">Sin licencia activa</div>
                <div style="font-size:12px;color:var(--text-secondary);margin-top:1px;">Introduce una clave válida para activar la aplicación</div>
              </div>
            </div>
            <button class="btn btn-primary btn-sm" style="margin-top:16px;" id="change-license-btn">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              Activar licencia
            </button>
          `}
        </div>
      </div>
    </div>

    <!-- ── Pestaña: Avanzado ── -->
    <div class="settings-panel" data-panel="avanzado">
      <div class="card">
        <div class="card-header">
          <span class="card-title">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:inline;vertical-align:middle;margin-right:6px;"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            Verifactu (AEAT)
          </span>
        </div>
        <div class="card-body">
          <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:12px 14px;margin-bottom:16px;font-size:12.5px;color:#92400e;line-height:1.6;">
            <strong>Verifactu</strong> (RD 1007/2023) aún no es de aplicación obligatoria. Actívalo solo cuando sea necesario.
            Al activarlo, cada factura incluirá una <strong>huella SHA-256</strong> encadenada y un <strong>código QR</strong> de verificación.
          </div>
          <div style="margin-bottom:16px;">
            <label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-weight:500;">
              <input type="checkbox" id="vf-enabled" ${vfCfg.enabled ? 'checked' : ''} style="width:16px;height:16px;cursor:pointer;accent-color:var(--primary);">
              Activar Verifactu
            </label>
          </div>
          <div id="vf-config-section" style="${vfCfg.enabled ? '' : 'display:none;'}">
            <form id="vf-form">
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Entorno</label>
                  <select class="form-control" id="vf-environment">
                    <option value="test" ${vfCfg.environment !== 'produccion' ? 'selected' : ''}>Pruebas (preproducción AEAT)</option>
                    <option value="produccion" ${vfCfg.environment === 'produccion' ? 'selected' : ''}>Producción</option>
                  </select>
                </div>
                <div class="form-group">
                  <label class="form-label">ID Sistema</label>
                  <input type="text" class="form-control" id="vf-id-sistema" value="${escapeHtml(vfCfg.id_sistema || 'CLARIFACTU')}" placeholder="CLARIFACTU">
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">Versión</label>
                  <input type="text" class="form-control" id="vf-version" value="${escapeHtml(vfCfg.version_sistema || '1.0')}" placeholder="1.0">
                </div>
                <div class="form-group">
                  <label class="form-label">Nº Instalación</label>
                  <input type="text" class="form-control" id="vf-instalacion" value="${escapeHtml(vfCfg.num_instalacion || '1')}" placeholder="1">
                </div>
              </div>
              <div class="form-group">
                <label class="form-label" style="display:flex;align-items:center;gap:10px;cursor:pointer;">
                  <input type="checkbox" id="vf-use-dnie" ${vfCfg.use_dnie ? 'checked' : ''} style="width:16px;height:16px;cursor:pointer;accent-color:var(--primary);">
                  Usar DNIe / tarjeta inteligente (almacén de Windows)
                </label>
              </div>
              <div id="vf-cert-file-section" style="${vfCfg.use_dnie ? 'display:none;' : ''}">
                <div class="form-group">
                  <label class="form-label">Certificado digital (.p12 / .pfx)</label>
                  <div style="display:flex;gap:8px;align-items:center;">
                    <input type="text" class="form-control" id="vf-cert-path" value="${escapeHtml(vfCfg.cert_path || '')}" placeholder="Ruta al certificado..." readonly style="flex:1;">
                    <button type="button" class="btn btn-secondary btn-sm" id="vf-cert-btn">Seleccionar</button>
                  </div>
                </div>
                <div class="form-group">
                  <label class="form-label">Contraseña del certificado</label>
                  <input type="password" class="form-control" id="vf-cert-pass" value="${escapeHtml(vfCfg.cert_password || '')}" placeholder="Contraseña del certificado">
                </div>
              </div>
              <div id="vf-dnie-section" style="${vfCfg.use_dnie ? '' : 'display:none;'}">
                <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px 14px;margin-bottom:12px;font-size:12.5px;color:#166534;line-height:1.6;">
                  <strong>Instrucciones DNIe:</strong><br>
                  1. Conecta el lector de tarjetas e inserta tu DNIe o tarjeta profesional<br>
                  2. Pulsa "Detectar certificados" para listar los disponibles<br>
                  3. Selecciona el certificado de firma y guarda la configuración
                </div>
                <div class="form-group">
                  <label class="form-label">Certificado seleccionado</label>
                  <div style="display:flex;gap:8px;align-items:center;">
                    <input type="text" class="form-control" id="vf-cert-thumbprint" value="${escapeHtml(vfCfg.cert_thumbprint || '')}" placeholder="Huella del certificado (thumbprint)..." readonly style="flex:1;font-family:monospace;font-size:11px;">
                    <button type="button" class="btn btn-secondary btn-sm" id="vf-detect-dnie-btn">Detectar certificados</button>
                  </div>
                </div>
                <div id="vf-dnie-cert-list" style="display:none;margin-bottom:12px;"></div>
              </div>
              <div style="display:flex;gap:8px;margin-top:4px;">
                <button type="submit" class="btn btn-primary btn-sm">Guardar configuración</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  `;

  // ── App icon in info panel ────────────────────────────────────────────────
  window.api.getIconDataUrl().then(url => {
    if (url) {
      const img = document.getElementById('info-app-icon');
      if (img) img.src = url;
    }
  });

  // ── Check for updates button ──────────────────────────────────────────────
  document.getElementById('check-update-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('check-update-btn');
    const msg = document.getElementById('update-check-msg');
    btn.disabled = true;
    btn.textContent = 'Buscando...';
    msg.textContent = 'Comprobando si hay actualizaciones disponibles...';
    try {
      await window.api.update.checkNow();
      setTimeout(() => {
        if (msg.textContent.includes('Comprobando')) {
          msg.textContent = 'No hay actualizaciones disponibles. La app está al día.';
        }
        btn.disabled = false;
        btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg> Buscar ahora`;
      }, 5000);
    } catch (err) {
      msg.textContent = 'Error al buscar actualizaciones: ' + err.message;
      btn.disabled = false;
      btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg> Buscar ahora`;
    }
  });

  // ── Tab switching ──────────────────────────────────────────────────────────
  document.querySelectorAll('.settings-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.settings-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.querySelector(`.settings-panel[data-panel="${tab.dataset.tab}"]`).classList.add('active');
    });
  });

  // Change / activate license
  const changeLicenseBtn = document.getElementById('change-license-btn');
  if (changeLicenseBtn) {
    changeLicenseBtn.addEventListener('click', () => {
      openModal('Cambiar licencia', `
        <div style="display:flex;flex-direction:column;gap:16px;">
          <p style="font-size:13.5px;color:var(--text-secondary);line-height:1.6;">Introduce tu nueva clave de licencia. La activación es permanente en este dispositivo.</p>
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label">Clave de licencia</label>
            <input type="text" class="form-control" id="modal-license-key"
              placeholder="XXXXX-XXXXX-XXXXX-XXXXX-XXXXX"
              autocomplete="off" spellcheck="false"
              style="font-family:'SF Mono','Fira Code','Consolas',monospace;font-size:15px;letter-spacing:0.08em;text-align:center;font-weight:600;">
          </div>
          <div id="modal-license-error" style="display:none;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:10px 14px;font-size:13px;color:#dc2626;text-align:center;"></div>
          <div style="display:flex;justify-content:flex-end;gap:8px;">
            <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
            <button class="btn btn-primary" id="modal-license-btn">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              Activar
            </button>
          </div>
        </div>
      `);

      const keyInput = document.getElementById('modal-license-key');
      keyInput.addEventListener('input', (e) => {
        let val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (val.length > 25) val = val.slice(0, 25);
        const parts = [];
        for (let i = 0; i < val.length; i += 5) parts.push(val.slice(i, i + 5));
        e.target.value = parts.join('-');
        document.getElementById('modal-license-error').style.display = 'none';
      });
      keyInput.focus();

      document.getElementById('modal-license-btn').addEventListener('click', async () => {
        const key = keyInput.value.trim();
        if (!key) return;
        const btn = document.getElementById('modal-license-btn');
        btn.disabled = true; btn.textContent = 'Verificando...';
        const result = await window.api.activateLicense(key);
        if (result.success) {
          showToast('Licencia activada correctamente', 'success');
          closeModal();
          await renderSettings(container);
        } else {
          const errEl = document.getElementById('modal-license-error');
          errEl.textContent = result.error;
          errEl.style.display = 'block';
          btn.disabled = false;
          btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> Activar';
        }
      });
    });
  }

  // Logo selection
  let currentLogoBase64 = business.logo || '';

  document.getElementById('select-logo-btn').addEventListener('click', async () => {
    const base64 = await window.api.selectLogo();
    if (base64) {
      currentLogoBase64 = base64;
      const previewEl = document.getElementById('logo-preview-img');
      previewEl.outerHTML = `<img src="${base64}" class="logo-preview" id="logo-preview-img" alt="Logo">`;
      document.getElementById('remove-logo-btn').style.display = '';
      document.getElementById('biz-logo').value = 'has-logo';
    }
  });

  document.getElementById('remove-logo-btn').addEventListener('click', () => {
    currentLogoBase64 = '';
    const previewEl = document.getElementById('logo-preview-img');
    previewEl.outerHTML = `<div class="logo-placeholder" id="logo-preview-img">Sin logo</div>`;
    document.getElementById('remove-logo-btn').style.display = 'none';
    document.getElementById('biz-logo').value = '';
  });

  // Signature
  let currentSignatureBase64 = business.signature || '';

  function applySignature(base64) {
    currentSignatureBase64 = base64;
    const previewEl = document.getElementById('sig-preview-img');
    previewEl.outerHTML = `<img src="${base64}" class="logo-preview" id="sig-preview-img" alt="Firma" style="max-height:80px;background:repeating-linear-gradient(45deg,#f1f5f9 0,#f1f5f9 5px,#fff 5px,#fff 10px);border-radius:6px;padding:4px;">`;
    document.getElementById('remove-sig-btn').style.display = '';
    document.getElementById('biz-signature').value = 'has-sig';
  }

  // Draw signature
  document.getElementById('draw-sig-btn').addEventListener('click', () => {
    openModal('Dibujar firma', `
      <p style="font-size:13px;color:var(--text-secondary);margin-bottom:12px;">
        Dibuja tu firma con el ratón o con el dedo. Usa fondo transparente para que encaje en cualquier documento.
      </p>
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
        <label style="font-size:12px;color:var(--text-secondary);font-weight:500;">Color:</label>
        <input type="color" id="sig-color" value="#1e293b" style="width:32px;height:28px;border:1px solid var(--border);border-radius:4px;cursor:pointer;padding:2px;">
        <label style="font-size:12px;color:var(--text-secondary);font-weight:500;">Grosor:</label>
        <input type="range" id="sig-stroke" min="1" max="8" value="2" style="width:80px;accent-color:var(--primary);">
        <button class="btn btn-ghost btn-sm" id="sig-clear-btn">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
          Limpiar
        </button>
      </div>
      <canvas id="sig-canvas" width="560" height="200"
        style="display:block;width:100%;border:1px solid var(--border);border-radius:8px;cursor:crosshair;touch-action:none;background:repeating-linear-gradient(45deg,#f1f5f9 0,#f1f5f9 4px,#fff 4px,#fff 8px);">
      </canvas>
      <div class="modal-footer" style="padding:0;margin-top:16px;border-top:none;">
        <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
        <button class="btn btn-primary" id="sig-save-btn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
          Guardar firma
        </button>
      </div>
    `);

    const canvas = document.getElementById('sig-canvas');
    const ctx    = canvas.getContext('2d');
    let drawing  = false;
    let hasDrawn = false;

    function getPos(e) {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width  / rect.width;
      const scaleY = canvas.height / rect.height;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
    }

    function startDraw(e) {
      e.preventDefault();
      drawing = true;
      const pos = getPos(e);
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
    }

    function draw(e) {
      if (!drawing) return;
      e.preventDefault();
      const pos = getPos(e);
      ctx.strokeStyle = document.getElementById('sig-color').value;
      ctx.lineWidth   = parseFloat(document.getElementById('sig-stroke').value);
      ctx.lineCap     = 'round';
      ctx.lineJoin    = 'round';
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      hasDrawn = true;
    }

    function stopDraw() { drawing = false; }

    canvas.addEventListener('mousedown',  startDraw);
    canvas.addEventListener('mousemove',  draw);
    canvas.addEventListener('mouseup',    stopDraw);
    canvas.addEventListener('mouseleave', stopDraw);
    canvas.addEventListener('touchstart', startDraw, { passive: false });
    canvas.addEventListener('touchmove',  draw,      { passive: false });
    canvas.addEventListener('touchend',   stopDraw);

    document.getElementById('sig-clear-btn').addEventListener('click', () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      hasDrawn = false;
    });

    document.getElementById('sig-save-btn').addEventListener('click', () => {
      if (!hasDrawn) {
        showToast('Dibuja tu firma antes de guardar', 'error');
        return;
      }
      // Export with transparent background
      const base64 = canvas.toDataURL('image/png');
      closeModal();
      applySignature(base64);
      showToast('Firma guardada. Recuerda guardar los datos de empresa.', 'success');
    });
  });

  // Upload signature image
  document.getElementById('select-sig-btn').addEventListener('click', async () => {
    const base64 = await window.api.selectSignature();
    if (base64) applySignature(base64);
  });

  document.getElementById('remove-sig-btn').addEventListener('click', () => {
    currentSignatureBase64 = '';
    const previewEl = document.getElementById('sig-preview-img');
    previewEl.outerHTML = `<div class="logo-placeholder" id="sig-preview-img">Sin firma</div>`;
    document.getElementById('remove-sig-btn').style.display = 'none';
    document.getElementById('biz-signature').value = '';
  });

  // Live preview for number settings
  const previewInputs = ['num-prefix', 'num-separator', 'num-digits', 'num-show-year'];
  previewInputs.forEach(id => {
    document.getElementById(id).addEventListener('input', updateNumberPreview);
    document.getElementById(id).addEventListener('change', updateNumberPreview);
  });

  // Business form submit
  document.getElementById('business-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const data = {
      name: document.getElementById('biz-name').value.trim(),
      nif: document.getElementById('biz-nif').value.trim(),
      email: document.getElementById('biz-email').value.trim(),
      phone: document.getElementById('biz-phone').value.trim(),
      address: document.getElementById('biz-address').value.trim(),
      iban: document.getElementById('biz-iban').value.trim(),
      extra_info: document.getElementById('biz-extra').value.trim(),
      logo: currentLogoBase64,
      signature: currentSignatureBase64
    };

    try {
      await window.api.settings.saveBusiness(data);
      showToast('Datos guardados correctamente', 'success');
    } catch (err) {
      showToast('Error al guardar: ' + err.message, 'error');
    }
  });

  // Number settings form submit
  document.getElementById('number-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const data = {
      prefix: document.getElementById('num-prefix').value.trim() || 'F',
      separator: document.getElementById('num-separator').value || '-',
      show_year: document.getElementById('num-show-year').checked ? 1 : 0,
      digits: parseInt(document.getElementById('num-digits').value) || 4,
      start_number: parseInt(document.getElementById('num-start').value) || 1,
      overdue_days: parseInt(document.getElementById('num-overdue-days').value) || 30
    };

    try {
      await window.api.settings.saveNumberSettings(data);
      showToast('Configuración de numeración guardada', 'success');
    } catch (err) {
      showToast('Error al guardar: ' + err.message, 'error');
    }
  });

  // Verifactu enable toggle
  document.getElementById('vf-enabled')?.addEventListener('change', async (e) => {
    const section = document.getElementById('vf-config-section');
    if (section) section.style.display = e.target.checked ? '' : 'none';
    // Save enabled state immediately
    const current = await window.api.verifactu.getSettings();
    await window.api.verifactu.saveSettings({ ...current, enabled: e.target.checked ? 1 : 0 });
    showToast(e.target.checked ? 'Verifactu activado' : 'Verifactu desactivado', 'info');
  });

  // Verifactu form
  document.getElementById('vf-cert-btn').addEventListener('click', async () => {
    const certPath = await window.api.verifactu.selectCert();
    if (certPath) document.getElementById('vf-cert-path').value = certPath;
  });

  // Toggle between file cert and DNIe sections
  document.getElementById('vf-use-dnie').addEventListener('change', (e) => {
    const useDNIe = e.target.checked;
    document.getElementById('vf-cert-file-section').style.display = useDNIe ? 'none' : '';
    document.getElementById('vf-dnie-section').style.display = useDNIe ? '' : 'none';
  });

  // Detect DNIe / smart card certificates from Windows store
  document.getElementById('vf-detect-dnie-btn').addEventListener('click', async () => {
    const btn = document.getElementById('vf-detect-dnie-btn');
    const listEl = document.getElementById('vf-dnie-cert-list');
    btn.disabled = true;
    btn.textContent = 'Detectando...';
    const result = await window.api.verifactu.listWinCerts();
    btn.disabled = false;
    btn.textContent = 'Detectar certificados';
    if (!result.success) {
      showToast('Error al leer certificados: ' + result.error, 'error');
      return;
    }
    if (!result.certs || result.certs.length === 0) {
      listEl.style.display = '';
      listEl.innerHTML = '<p style="font-size:13px;color:var(--text-secondary);">No se encontraron certificados con clave privada. Comprueba que el DNIe está insertado.</p>';
      return;
    }
    listEl.style.display = '';
    listEl.innerHTML = `
      <div style="font-size:12.5px;font-weight:600;margin-bottom:8px;color:var(--text-primary);">Certificados encontrados:</div>
      <div style="display:flex;flex-direction:column;gap:6px;">
        ${result.certs.map(cert => `
          <div class="dnie-cert-item" data-thumb="${escapeHtml(cert.Thumbprint)}"
            style="border:1px solid var(--border);border-radius:6px;padding:10px 12px;cursor:pointer;
            background:${document.getElementById('vf-cert-thumbprint').value === cert.Thumbprint ? '#eff6ff' : 'var(--bg-secondary)'};
            transition:background 0.15s;">
            <div style="font-weight:600;font-size:12.5px;">${escapeHtml(cert.FriendlyName || cert.Subject)}</div>
            <div style="font-size:11px;color:var(--text-secondary);margin-top:2px;">${escapeHtml(cert.Subject)}</div>
            <div style="font-size:11px;color:var(--text-secondary);">Emisor: ${escapeHtml(cert.Issuer)}</div>
            <div style="font-size:11px;color:var(--text-secondary);">Válido hasta: ${escapeHtml(cert.NotAfter)}</div>
            <div style="font-size:10px;font-family:monospace;color:var(--text-secondary);margin-top:4px;word-break:break-all;">${escapeHtml(cert.Thumbprint)}</div>
          </div>
        `).join('')}
      </div>
    `;
    listEl.querySelectorAll('.dnie-cert-item').forEach(item => {
      item.addEventListener('click', () => {
        listEl.querySelectorAll('.dnie-cert-item').forEach(i => i.style.background = 'var(--bg-secondary)');
        item.style.background = '#eff6ff';
        document.getElementById('vf-cert-thumbprint').value = item.dataset.thumb;
      });
    });
  });

  document.getElementById('vf-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const useDNIe = document.getElementById('vf-use-dnie').checked;
    const data = {
      enabled: document.getElementById('vf-enabled').checked ? 1 : 0,
      environment: document.getElementById('vf-environment').value,
      cert_path: document.getElementById('vf-cert-path').value.trim(),
      cert_password: document.getElementById('vf-cert-pass').value,
      id_sistema: document.getElementById('vf-id-sistema').value.trim() || 'CLARIFACTU',
      version_sistema: document.getElementById('vf-version').value.trim() || '1.0',
      num_instalacion: document.getElementById('vf-instalacion').value.trim() || '1',
      use_dnie: useDNIe ? 1 : 0,
      cert_thumbprint: document.getElementById('vf-cert-thumbprint').value.trim()
    };
    try {
      await window.api.verifactu.saveSettings(data);
      showToast('Configuración Verifactu guardada', 'success');
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    }
  });

  // Email form
  document.getElementById('email-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
      gmail_user: document.getElementById('email-user').value.trim(),
      gmail_app_password: document.getElementById('email-pass').value.trim(),
      default_subject: document.getElementById('email-subject').value.trim(),
      default_body: document.getElementById('email-body').value
    };
    try {
      await window.api.email.saveSettings(data);
      showToast('Configuración de email guardada', 'success');
    } catch (err) {
      showToast('Error: ' + err.message, 'error');
    }
  });

  document.getElementById('test-email-btn').addEventListener('click', async () => {
    const btn = document.getElementById('test-email-btn');
    btn.disabled = true;
    btn.textContent = 'Probando...';
    const result = await window.api.email.testConnection();
    btn.disabled = false;
    btn.textContent = 'Probar conexión';
    if (result.success) {
      showToast('Conexión con Gmail correcta', 'success');
    } else {
      showToast('Error de conexión: ' + result.error, 'error');
    }
  });

  // ── Backup ──────────────────────────────────────────────────────────────────

  async function renderBackupList() {
    const list = await window.api.backup.list();
    const container = document.getElementById('backup-list-container');
    if (!container) return;

    if (!list || list.length === 0) {
      container.innerHTML = `
        <div style="color:var(--text-secondary);font-size:13px;text-align:center;padding:20px 0;">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom:8px;opacity:.4;display:block;margin-left:auto;margin-right:auto;"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
          Aún no hay backups creados
        </div>`;
      return;
    }

    container.innerHTML = `
      <div style="font-size:12px;color:var(--text-secondary);margin-bottom:10px;font-weight:500;">
        ${list.length} backup${list.length > 1 ? 's' : ''} guardado${list.length > 1 ? 's' : ''} (máximo 5)
      </div>
      <div class="backup-list">
        ${list.map((entry, idx) => {
          const date = new Date(entry.createdAt);
          const dateStr = date.toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
          const sizeKB = (entry.size / 1024).toFixed(0);
          const isLatest = idx === 0;
          return `
            <div class="backup-item">
              <div class="backup-item-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
              </div>
              <div class="backup-item-info">
                <div class="backup-item-date">
                  ${dateStr}
                  ${isLatest ? '<span class="backup-badge-latest">más reciente</span>' : ''}
                </div>
                <div class="backup-item-meta">${sizeKB} KB · ${escapeHtml(entry.filename)}</div>
              </div>
              <div class="backup-item-actions">
                <button class="btn btn-ghost btn-sm backup-download-btn" data-filename="${escapeHtml(entry.filename)}" title="Descargar">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                  Descargar
                </button>
                <button class="btn btn-danger btn-sm backup-restore-btn" data-filename="${escapeHtml(entry.filename)}" data-date="${dateStr}" title="Restaurar">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 2v6h6"/><path d="M3 8C5.33 5.33 8.5 4 12 4c5.52 0 10 4.48 10 10s-4.48 10-10 10S2 19.52 2 14"/></svg>
                  Restaurar
                </button>
              </div>
            </div>`;
        }).join('')}
      </div>`;

    container.querySelectorAll('.backup-download-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        const result = await window.api.backup.download(btn.dataset.filename);
        btn.disabled = false;
        if (result.success) {
          showToast('Backup descargado correctamente', 'success');
        } else if (result.error) {
          showToast('Error: ' + result.error, 'error');
        }
      });
    });

    container.querySelectorAll('.backup-restore-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const confirmed = await showConfirm(
          '¿Restaurar este backup?',
          `Se restaurará el backup del ${btn.dataset.date}.\n\nEsta acción reemplazará TODOS los datos actuales (clientes, facturas, servicios y configuración) con los del backup seleccionado.\n\nLa aplicación se reiniciará automáticamente. Esta acción no se puede deshacer.`,
          'Restaurar y reiniciar'
        );
        if (!confirmed) return;
        btn.disabled = true;
        btn.textContent = 'Restaurando...';
        await window.api.backup.restore(btn.dataset.filename);
        // App relaunch happens on main side; if somehow we get here show a message
        showToast('Restaurando... la aplicación se reiniciará ahora.', 'info');
      });
    });
  }

  // ── Apariencia ──────────────────────────────────────────────────────────────
  let selectedTemplate = business.invoice_template || 'clasica';

  document.getElementById('template-grid')?.addEventListener('click', (e) => {
    const card = e.target.closest('.template-card');
    if (!card) return;
    selectedTemplate = card.dataset.tpl;
    document.querySelectorAll('.template-card').forEach(c => {
      const isNow = c.dataset.tpl === selectedTemplate;
      c.classList.toggle('selected', isNow);
      const check = c.querySelector('[id^="tpl-check-"]');
      if (check) {
        check.innerHTML = isNow
          ? `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>`
          : '';
        check.style.background = isNow ? 'var(--primary)' : 'transparent';
      }
    });
  });

  const darkCheckbox = document.getElementById('dark-mode-checkbox');
  darkCheckbox?.addEventListener('change', () => {
    const isDark = darkCheckbox.checked;
    document.body.classList.toggle('dark', isDark);
    const slider = darkCheckbox.nextElementSibling;
    if (slider) {
      slider.style.background = isDark ? 'var(--primary)' : '#cbd5e1';
      const knob = slider.querySelector('span');
      if (knob) knob.style.left = isDark ? '23px' : '3px';
    }
  });

  document.getElementById('save-appearance-btn')?.addEventListener('click', async () => {
    const isDark = document.getElementById('dark-mode-checkbox')?.checked ? 1 : 0;
    await window.api.settings.saveAppearance({ dark_mode: isDark, invoice_template: selectedTemplate });
    showToast('Apariencia guardada', 'success');
  });

  renderBackupList();

  document.getElementById('create-backup-btn').addEventListener('click', async () => {
    const btn = document.getElementById('create-backup-btn');
    btn.disabled = true;
    btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> Creando...`;
    const result = await window.api.backup.create();
    btn.disabled = false;
    btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Crear backup ahora`;
    if (result.success) {
      showToast('Backup creado correctamente', 'success');
      renderBackupList();
    } else {
      showToast('Error al crear backup: ' + (result.error || ''), 'error');
    }
  });

  document.getElementById('import-backup-btn').addEventListener('click', async () => {
    const confirmed = await showConfirm(
      '¿Importar backup externo?',
      'Importar un archivo de backup reemplazará completamente todos los datos actuales de la aplicación.\n\nAsegúrate de haber creado un backup previo si deseas conservar los datos actuales.\n\nLa aplicación se reiniciará automáticamente tras la importación.',
      'Seleccionar e importar'
    );
    if (!confirmed) return;
    const result = await window.api.backup.importFile();
    if (!result.success && !result.error) return; // cancelled
    if (result.error) showToast('Error al importar: ' + result.error, 'error');
    // If success, app is relaunching
  });

  // Reset counter
  document.getElementById('reset-counter-btn').addEventListener('click', async () => {
    const confirmed = await showConfirm(
      '¿Reiniciar contador?',
      'El próximo número de factura comenzará desde el número inicial configurado. Las facturas existentes no se verán afectadas.',
      'Reiniciar'
    );

    if (confirmed) {
      try {
        const result = await window.api.settings.resetCounter();
        const next = result.start_number || 1;
        showToast(`Contador reiniciado. La próxima factura será la nº ${next}.`, 'success');
        updateNumberPreview();
      } catch (err) {
        showToast('Error: ' + err.message, 'error');
      }
    }
  });
}

function generatePreviewNumber(settings) {
  const prefix = settings.prefix || 'F';
  const sep = settings.separator || '-';
  const showYear = settings.show_year;
  const digits = settings.digits || 4;
  const year = new Date().getFullYear();
  const counter = String(settings.start_number || 1).padStart(digits, '0');

  if (showYear) {
    return `${escapeHtml(prefix)}${escapeHtml(sep)}${year}${escapeHtml(sep)}${counter}`;
  } else {
    return `${escapeHtml(prefix)}${escapeHtml(sep)}${counter}`;
  }
}

function updateNumberPreview() {
  const prefix = document.getElementById('num-prefix').value.trim() || 'F';
  const sep = document.getElementById('num-separator').value || '-';
  const showYear = document.getElementById('num-show-year').checked;
  const digits = parseInt(document.getElementById('num-digits').value) || 4;
  const start = parseInt(document.getElementById('num-start')?.value) || 1;
  const year = new Date().getFullYear();
  const counter = String(start).padStart(digits, '0');

  let preview;
  if (showYear) {
    preview = `${escapeHtml(prefix)}${escapeHtml(sep)}${year}${escapeHtml(sep)}${counter}`;
  } else {
    preview = `${escapeHtml(prefix)}${escapeHtml(sep)}${counter}`;
  }

  const el = document.getElementById('number-preview');
  if (el) el.textContent = preview;
}
