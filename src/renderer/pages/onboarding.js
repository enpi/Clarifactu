// ─── Onboarding Wizard ─────────────────────────────────────────────────────────

async function showOnboardingWizard() {
  let step = 1;
  const TOTAL_STEPS = 4;
  const wizardData = { name: '', nif: '', address: '', email: '', phone: '', prefix: 'F', separator: '-' };

  function progressDots() {
    return `<div style="display:flex;align-items:center;justify-content:center;gap:6px;margin-bottom:24px;">
      ${Array.from({ length: TOTAL_STEPS }, (_, i) => `
        <div style="height:8px;border-radius:4px;transition:all 0.3s;
          width:${i + 1 === step ? '24px' : '8px'};
          background:${i + 1 <= step ? 'var(--primary)' : 'var(--border)'};"></div>
      `).join('')}
    </div>`;
  }

  function renderWizard() {
    const overlay = document.getElementById('modal-overlay');
    const container = document.getElementById('modal-container');
    overlay.classList.remove('hidden');
    container.classList.remove('modal-lg', 'modal-xl');
    container.classList.add('modal-lg');
    document.getElementById('modal-close-btn').style.display = 'none';

    let bodyHtml = '';

    if (step === 1) {
      document.getElementById('modal-title').textContent = 'Bienvenido/a a Clarifactu';
      bodyHtml = progressDots() + `
        <div style="text-align:center;padding:12px 0 20px;">
          <div style="width:64px;height:64px;background:#eff6ff;border-radius:16px;
            display:flex;align-items:center;justify-content:center;margin:0 auto 20px;">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="1.5">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
          </div>
          <h2 style="font-size:20px;font-weight:700;margin-bottom:10px;">¡Todo listo para empezar!</h2>
          <p style="color:var(--text-secondary);font-size:14px;max-width:340px;margin:0 auto 28px;line-height:1.6;">
            Configura tu perfil en 2 pasos para poder emitir facturas profesionales desde el primer momento.
          </p>
          <button class="btn btn-primary" id="wizard-start-btn" style="min-width:160px;">Comenzar configuración</button>
          <div style="margin-top:12px;">
            <button type="button" id="wizard-skip-btn" style="background:none;border:none;color:var(--text-secondary);font-size:12px;cursor:pointer;text-decoration:underline;">
              Configurar más tarde
            </button>
          </div>
        </div>
      `;
    } else if (step === 2) {
      document.getElementById('modal-title').textContent = 'Datos de tu empresa';
      bodyHtml = progressDots() + `
        <form id="wizard-biz-form" autocomplete="off">
          <div class="form-group">
            <label class="form-label">Nombre / Razón social <span class="required">*</span></label>
            <input type="text" class="form-control" id="wiz-name" value="${escapeHtml(wizardData.name)}"
              placeholder="Tu nombre completo o nombre de empresa" autofocus>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">NIF / CIF</label>
              <input type="text" class="form-control" id="wiz-nif" value="${escapeHtml(wizardData.nif)}" placeholder="12345678A">
            </div>
            <div class="form-group">
              <label class="form-label">Teléfono</label>
              <input type="text" class="form-control" id="wiz-phone" value="${escapeHtml(wizardData.phone)}" placeholder="+34 600 000 000">
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Email</label>
            <input type="email" class="form-control" id="wiz-email" value="${escapeHtml(wizardData.email)}" placeholder="tu@email.com">
          </div>
          <div class="form-group">
            <label class="form-label">Dirección</label>
            <input type="text" class="form-control" id="wiz-address" value="${escapeHtml(wizardData.address)}" placeholder="Calle, número, ciudad, CP">
          </div>
          <div class="modal-footer" style="padding:0;margin-top:16px;border-top:none;justify-content:space-between;">
            <button type="button" class="btn btn-secondary" id="wizard-back-btn">Atrás</button>
            <button type="submit" class="btn btn-primary">Siguiente</button>
          </div>
        </form>
      `;
    } else if (step === 3) {
      document.getElementById('modal-title').textContent = 'Numeración de facturas';
      bodyHtml = progressDots() + `
        <form id="wizard-inv-form">
          <p style="color:var(--text-secondary);font-size:13px;margin-bottom:16px;line-height:1.5;">
            Define cómo se numerarán tus facturas. Podrás cambiarlo en cualquier momento desde Configuración.
          </p>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Prefijo</label>
              <input type="text" class="form-control" id="wiz-prefix" value="${escapeHtml(wizardData.prefix)}" placeholder="F" maxlength="5">
            </div>
            <div class="form-group">
              <label class="form-label">Separador</label>
              <select class="form-control" id="wiz-separator">
                <option value="-" ${wizardData.separator === '-' ? 'selected' : ''}>Guion — F-2025-0001</option>
                <option value="/" ${wizardData.separator === '/' ? 'selected' : ''}>Barra — F/2025/0001</option>
                <option value="" ${wizardData.separator === '' ? 'selected' : ''}>Sin separador — F20250001</option>
              </select>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Vista previa</label>
            <div id="wiz-number-preview" style="font-size:20px;font-weight:700;color:var(--primary);
              padding:12px 16px;background:#eff6ff;border-radius:8px;font-family:'SF Mono','Fira Code',monospace;letter-spacing:1px;">
              F-2025-0001
            </div>
          </div>
          <div class="modal-footer" style="padding:0;margin-top:16px;border-top:none;justify-content:space-between;">
            <button type="button" class="btn btn-secondary" id="wizard-back-btn">Atrás</button>
            <button type="submit" class="btn btn-primary">Siguiente</button>
          </div>
        </form>
      `;
    } else if (step === 4) {
      document.getElementById('modal-title').textContent = '¡Todo listo!';
      bodyHtml = progressDots() + `
        <div style="text-align:center;padding:12px 0 20px;">
          <div style="width:64px;height:64px;background:#dcfce7;border-radius:16px;
            display:flex;align-items:center;justify-content:center;margin:0 auto 20px;">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <h2 style="font-size:20px;font-weight:700;margin-bottom:10px;">¡Configuración completada!</h2>
          <p style="color:var(--text-secondary);font-size:14px;max-width:360px;margin:0 auto 28px;line-height:1.6;">
            Tu perfil está listo. Puedes modificar estos datos en cualquier momento desde
            <strong>Configuración</strong>.
          </p>
          <button class="btn btn-primary" id="wizard-finish-btn" style="min-width:160px;">Ir al Dashboard</button>
        </div>
      `;
    }

    document.getElementById('modal-body').innerHTML = bodyHtml;
    bindWizardEvents();
  }

  function bindWizardEvents() {
    document.getElementById('wizard-start-btn')?.addEventListener('click', () => { step++; renderWizard(); });

    document.getElementById('wizard-skip-btn')?.addEventListener('click', async () => {
      await finishOnboarding();
    });

    document.getElementById('wizard-back-btn')?.addEventListener('click', () => { step--; renderWizard(); });

    document.getElementById('wizard-biz-form')?.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('wiz-name').value.trim();
      if (!name) { showToast('El nombre es obligatorio', 'error'); return; }
      wizardData.name = name;
      wizardData.nif = document.getElementById('wiz-nif').value.trim();
      wizardData.email = document.getElementById('wiz-email').value.trim();
      wizardData.phone = document.getElementById('wiz-phone').value.trim();
      wizardData.address = document.getElementById('wiz-address').value.trim();
      step++; renderWizard();
    });

    const updatePreview = () => {
      const prefix = document.getElementById('wiz-prefix')?.value || 'F';
      const sep = document.getElementById('wiz-separator')?.value ?? '-';
      const preview = document.getElementById('wiz-number-preview');
      if (preview) preview.textContent = `${prefix}${sep}2025${sep}0001`;
    };
    document.getElementById('wiz-prefix')?.addEventListener('input', updatePreview);
    document.getElementById('wiz-separator')?.addEventListener('change', updatePreview);

    document.getElementById('wizard-inv-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      wizardData.prefix = document.getElementById('wiz-prefix').value.trim() || 'F';
      wizardData.separator = document.getElementById('wiz-separator').value;
      step++; renderWizard();
    });

    document.getElementById('wizard-finish-btn')?.addEventListener('click', async () => {
      await saveWizardData();
      await finishOnboarding();
    });
  }

  async function saveWizardData() {
    try {
      const biz = await window.api.settings.getBusiness();
      await window.api.settings.saveBusiness({
        ...biz,
        name: wizardData.name,
        nif: wizardData.nif,
        email: wizardData.email,
        phone: wizardData.phone,
        address: wizardData.address
      });
      const numSettings = await window.api.settings.getNumberSettings();
      await window.api.settings.saveNumberSettings({
        ...numSettings,
        prefix: wizardData.prefix,
        separator: wizardData.separator,
        show_year: 1,
        digits: numSettings.digits || 4,
        start_number: numSettings.start_number || 1,
        overdue_days: numSettings.overdue_days || 30
      });
    } catch (err) {
      console.error('Onboarding save error:', err);
    }
  }

  async function finishOnboarding() {
    await window.api.settings.markOnboardingDone();
    document.getElementById('modal-close-btn').style.display = '';
    closeModal();
    if (wizardData.name) showToast('Configuración guardada. ¡Bienvenido/a!', 'success');
  }

  renderWizard();
}
