// ─── New Invoice Page ──────────────────────────────────────────────────────────

let invoiceItems = [];
let pendingInvoiceNumber = null;
let pendingCounter = null;
let editingInvoiceId = null;
let rectificativaOf = null;
let rectificativaCounter = null;

async function renderNewInvoice(container, params = null) {
  editingInvoiceId = params?.editId || null;
  const duplicateId = params?.duplicateId || null;
  rectificativaOf = params?.rectificativaOf || null;
  rectificativaCounter = null;

  let existingInvoice = null;
  let existingItems = [];

  if (editingInvoiceId) {
    [existingInvoice, existingItems] = await Promise.all([
      window.api.invoices.getById(editingInvoiceId),
      window.api.invoiceItems.getByInvoice(editingInvoiceId)
    ]);
    pendingInvoiceNumber = existingInvoice.invoice_number;
    pendingCounter = null;
  } else if (duplicateId) {
    const [srcInvoice, srcItems, numResult] = await Promise.all([
      window.api.invoices.getById(duplicateId),
      window.api.invoiceItems.getByInvoice(duplicateId),
      window.api.generateInvoiceNumber()
    ]);
    pendingInvoiceNumber = numResult.invoiceNumber;
    pendingCounter = numResult.newCounter;
    existingInvoice = { ...srcInvoice, date: today() };
    existingItems = srcItems;
  } else if (rectificativaOf) {
    const [srcInvoice, srcItems, numResult] = await Promise.all([
      window.api.invoices.getById(rectificativaOf),
      window.api.invoiceItems.getByInvoice(rectificativaOf),
      window.api.generateRectificativaNumber()
    ]);
    pendingInvoiceNumber = numResult.invoiceNumber;
    rectificativaCounter = numResult.newCounter;
    pendingCounter = null;
    existingInvoice = { ...srcInvoice, date: today() };
    existingItems = srcItems.map(item => ({ ...item, unit_price: -Math.abs(item.unit_price), total: -Math.abs(item.total) }));
  } else {
    const { invoiceNumber, newCounter } = await window.api.generateInvoiceNumber();
    pendingInvoiceNumber = invoiceNumber;
    pendingCounter = newCounter;
  }

  const [clients, services] = await Promise.all([
    window.api.clients.getAll(),
    window.api.services.getAll()
  ]);

  // Pre-load items if editing
  invoiceItems = existingItems.map(item => ({
    _id: Date.now() + Math.random(),
    service_id: item.service_id,
    service_name: item.service_name,
    description: item.description || '',
    quantity: item.quantity,
    unit_price: item.unit_price,
    total: item.total
  }));

  container.innerHTML = `
    <div class="page-header">
      <div>
        <h1 class="page-title">${editingInvoiceId ? 'Editar Factura' : rectificativaOf ? 'Factura Rectificativa' : 'Nueva Factura'}</h1>
        <p class="page-subtitle">${editingInvoiceId ? `Modificando ${escapeHtml(pendingInvoiceNumber)}` : rectificativaOf ? `Anulación de factura · ${escapeHtml(pendingInvoiceNumber)}` : duplicateId ? `Copia de factura · ${escapeHtml(pendingInvoiceNumber)}` : 'Crea una nueva factura'}</p>
      </div>
    </div>
    ${rectificativaOf ? `<div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:10px 16px;margin-bottom:16px;font-size:13px;color:#92400e;">
      <strong>Factura rectificativa (R1)</strong> — Los importes aparecen en negativo para anular la factura original. Revisa los datos antes de guardar.
    </div>` : ''}

    <div class="invoice-header-bar">
      <div>
        <div class="invoice-number-label">Número de factura</div>
        <div class="invoice-number-display" id="invoice-number-display">${escapeHtml(pendingInvoiceNumber)}</div>
      </div>
      <div style="text-align:right;">
        <div class="invoice-number-label">Fecha</div>
        <div style="font-weight:600;font-size:15px;" id="invoice-date-display">${formatDate(existingInvoice?.date || today())}</div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px;">
      <!-- Client selector -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">Cliente</span>
        </div>
        <div class="card-body">
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label">Seleccionar cliente <span class="required">*</span></label>
            <select class="form-control" id="invoice-client-select">
              <option value="">-- Selecciona un cliente --</option>
              ${clients.map(c => `<option value="${c.id}" ${existingInvoice?.client_id === c.id ? 'selected' : ''}>${escapeHtml(c.name)}${c.nif ? ` (${escapeHtml(c.nif)})` : ''}</option>`).join('')}
            </select>
          </div>
          <div id="client-info-preview" style="margin-top:12px;font-size:12.5px;color:var(--text-secondary);display:none;">
          </div>
        </div>
      </div>

      <!-- Invoice meta -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">Detalles</span>
        </div>
        <div class="card-body">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Fecha <span class="required">*</span></label>
              <input type="date" class="form-control" id="invoice-date" value="${existingInvoice?.date || today()}">
            </div>
            <div class="form-group">
              <label class="form-label">IVA (%)</label>
              <input type="number" class="form-control" id="invoice-tax" value="${existingInvoice?.tax_rate ?? 0}" min="0" max="100" step="0.1" placeholder="0">
            </div>
          </div>
          <div class="form-row">
            <div class="form-group" style="flex:1;">
              <label class="form-label">IRPF (%)</label>
              <input type="number" class="form-control" id="invoice-irpf" value="${existingInvoice?.irpf_rate ?? 0}" min="0" max="100" step="0.1" placeholder="0">
            </div>
            <div class="form-group" style="flex:1;"></div>
          </div>
          <div class="form-group" style="margin-bottom:0;">
            <label class="form-label">Notas</label>
            <textarea class="form-control" id="invoice-notes" rows="2" placeholder="Notas o condiciones de pago...">${escapeHtml(existingInvoice?.notes || '')}</textarea>
          </div>
        </div>
      </div>
    </div>

    <!-- Items -->
    <div class="card" style="margin-bottom:20px;">
      <div class="card-header">
        <span class="card-title">Líneas de factura</span>
      </div>
      <div class="card-body" style="padding:0;">
        <div class="items-table-wrapper" style="border:none;border-radius:0;">
          <table>
            <thead>
              <tr>
                <th style="width:35%;">Servicio / Concepto</th>
                <th>Descripción</th>
                <th style="width:80px;" class="text-right">Cantidad</th>
                <th style="width:110px;" class="text-right">Precio unit.</th>
                <th style="width:110px;" class="text-right">Total</th>
                <th style="width:50px;"></th>
              </tr>
            </thead>
            <tbody id="invoice-items-tbody">
              <tr id="empty-items-row">
                <td colspan="6" class="text-center text-muted" style="padding:20px 14px;">
                  Añade líneas usando el panel de abajo
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Add item panel -->
        <div class="add-item-row">
          <select class="form-control" id="add-service-select" style="flex:2;min-width:180px;">
            <option value="">-- Seleccionar servicio --</option>
            ${services.map(s => `<option value="${s.id}" data-price="${s.price}" data-name="${escapeHtml(s.name)}" data-desc="${escapeHtml(s.description || '')}">${escapeHtml(s.name)} — ${formatCurrency(s.price)}</option>`).join('')}
            <option value="custom">+ Concepto personalizado</option>
          </select>
          <input type="text" class="form-control" id="add-item-name" placeholder="Nombre del concepto" style="flex:2;display:none;">
          <input type="text" class="form-control" id="add-item-desc" placeholder="Descripción (opcional)" style="flex:2;">
          <input type="number" class="form-control" id="add-item-qty" value="1" min="1" style="flex:0.6;min-width:60px;" placeholder="Cant.">
          <input type="number" class="form-control" id="add-item-price" value="" min="0" step="0.01" style="flex:1;min-width:90px;" placeholder="Precio">
          <button class="btn btn-primary" id="add-item-btn">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Añadir
          </button>
        </div>
      </div>
    </div>

    <!-- Totals + Save -->
    <div style="display:flex;justify-content:space-between;align-items:flex-end;flex-wrap:wrap;gap:16px;">
      <div style="flex:1;max-width:480px;">
        <div class="form-group" style="margin-bottom:0;">
          <!-- Empty left side or future use -->
        </div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:16px;">
        <div class="totals-box" id="totals-box">
          <div class="totals-row">
            <span>Subtotal</span>
            <span id="total-subtotal">0,00 €</span>
          </div>
          <div class="totals-row">
            <span>IVA (<span id="tax-rate-label">0</span>%)</span>
            <span id="total-tax">0,00 €</span>
          </div>
          <div class="totals-row" id="irpf-row" style="color:var(--danger,#ef4444);">
            <span>IRPF (<span id="irpf-rate-label">0</span>%)</span>
            <span id="total-irpf">0,00 €</span>
          </div>
          <div class="totals-row total-final">
            <span>TOTAL</span>
            <span id="total-final">0,00 €</span>
          </div>
        </div>
        <button class="btn btn-primary" id="save-invoice-btn" style="min-width:180px;justify-content:center;padding:12px 24px;font-size:15px;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
            <polyline points="17 21 17 13 7 13 7 21"/>
            <polyline points="7 3 7 8 15 8"/>
          </svg>
          ${editingInvoiceId ? 'Guardar cambios' : 'Guardar factura'}
        </button>
      </div>
    </div>
  `;

  // Bind events
  // Render pre-loaded items if editing
  if (invoiceItems.length > 0) {
    renderItemsTable();
    updateTotals();
  }

  document.getElementById('invoice-date').addEventListener('change', (e) => {
    document.getElementById('invoice-date-display').textContent = formatDate(e.target.value);
  });

  document.getElementById('invoice-client-select').addEventListener('change', async (e) => {
    const clientId = e.target.value;
    const preview = document.getElementById('client-info-preview');
    if (clientId) {
      const client = await window.api.clients.getById(parseInt(clientId));
      preview.style.display = 'block';
      preview.innerHTML = `
        <div style="padding:10px;background:#f8fafc;border-radius:6px;line-height:1.7;">
          ${client.nif ? `<div><strong>NIF:</strong> ${escapeHtml(client.nif)}</div>` : ''}
          ${client.address ? `<div><strong>Dirección:</strong> ${escapeHtml(client.address)}</div>` : ''}
          ${client.email ? `<div><strong>Email:</strong> ${escapeHtml(client.email)}</div>` : ''}
          ${client.phone ? `<div><strong>Teléfono:</strong> ${escapeHtml(client.phone)}</div>` : ''}
        </div>
      `;
    } else {
      preview.style.display = 'none';
    }
  });

  document.getElementById('add-service-select').addEventListener('change', (e) => {
    const option = e.target.selectedOptions[0];
    const nameInput = document.getElementById('add-item-name');

    if (e.target.value === 'custom') {
      nameInput.style.display = 'block';
      nameInput.value = '';
      document.getElementById('add-item-price').value = '';
      document.getElementById('add-item-desc').value = '';
    } else if (e.target.value) {
      nameInput.style.display = 'none';
      document.getElementById('add-item-price').value = option.dataset.price;
      document.getElementById('add-item-desc').value = option.dataset.desc;
    } else {
      nameInput.style.display = 'none';
      document.getElementById('add-item-price').value = '';
      document.getElementById('add-item-desc').value = '';
    }
  });

  document.getElementById('invoice-tax').addEventListener('input', updateTotals);
  document.getElementById('invoice-irpf').addEventListener('input', updateTotals);

  document.getElementById('add-item-btn').addEventListener('click', () => addInvoiceItem());

  document.getElementById('save-invoice-btn').addEventListener('click', () => saveInvoice());
}

function addInvoiceItem() {
  const serviceSelect = document.getElementById('add-service-select');
  const nameInput = document.getElementById('add-item-name');
  const descInput = document.getElementById('add-item-desc');
  const qtyInput = document.getElementById('add-item-qty');
  const priceInput = document.getElementById('add-item-price');

  const serviceId = serviceSelect.value;
  const isCustom = serviceId === 'custom';

  let serviceName = '';
  let serviceDbId = null;

  if (isCustom) {
    serviceName = nameInput.value.trim();
    if (!serviceName) {
      showToast('Introduce el nombre del concepto', 'error');
      nameInput.focus();
      return;
    }
  } else if (serviceId) {
    const option = serviceSelect.selectedOptions[0];
    serviceName = option.dataset.name;
    serviceDbId = parseInt(serviceId);
  } else {
    showToast('Selecciona un servicio o elige "Concepto personalizado"', 'error');
    return;
  }

  const qty = parseInt(qtyInput.value) || 1;
  const price = parseFloat(priceInput.value);

  if (isNaN(price) || price < 0) {
    showToast('Introduce un precio válido', 'error');
    priceInput.focus();
    return;
  }

  const item = {
    _id: Date.now(),
    service_id: serviceDbId,
    service_name: serviceName,
    description: descInput.value.trim(),
    quantity: qty,
    unit_price: price,
    total: qty * price
  };

  invoiceItems.push(item);
  renderItemsTable();
  updateTotals();

  // Reset inputs
  serviceSelect.value = '';
  nameInput.style.display = 'none';
  nameInput.value = '';
  descInput.value = '';
  qtyInput.value = '1';
  priceInput.value = '';
}

function removeInvoiceItem(itemId) {
  invoiceItems = invoiceItems.filter(i => i._id !== itemId);
  renderItemsTable();
  updateTotals();
}

function renderItemsTable() {
  const tbody = document.getElementById('invoice-items-tbody');
  if (!tbody) return;

  if (invoiceItems.length === 0) {
    tbody.innerHTML = `
      <tr id="empty-items-row">
        <td colspan="6" class="text-center text-muted" style="padding:20px 14px;">
          Añade líneas usando el panel de abajo
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = invoiceItems.map(item => `
    <tr>
      <td class="fw-bold">${escapeHtml(item.service_name)}</td>
      <td style="color:var(--text-secondary);font-size:12.5px;">${escapeHtml(item.description) || ''}</td>
      <td class="text-right">${item.quantity}</td>
      <td class="text-right">${formatCurrency(item.unit_price)}</td>
      <td class="text-right fw-bold">${formatCurrency(item.total)}</td>
      <td class="text-center">
        <button class="item-delete-btn" onclick="removeInvoiceItem(${item._id})" title="Eliminar línea">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </td>
    </tr>
  `).join('');
}

function updateTotals() {
  const subtotal = invoiceItems.reduce((sum, item) => sum + item.total, 0);
  const taxRate = parseFloat(document.getElementById('invoice-tax')?.value) || 0;
  const irpfRate = parseFloat(document.getElementById('invoice-irpf')?.value) || 0;
  const taxAmount = subtotal * (taxRate / 100);
  const irpfAmount = subtotal * (irpfRate / 100);
  const total = subtotal + taxAmount - irpfAmount;

  if (document.getElementById('total-subtotal')) document.getElementById('total-subtotal').textContent = formatCurrency(subtotal);
  if (document.getElementById('total-tax')) document.getElementById('total-tax').textContent = formatCurrency(taxAmount);
  if (document.getElementById('tax-rate-label')) document.getElementById('tax-rate-label').textContent = taxRate;
  if (document.getElementById('total-irpf')) document.getElementById('total-irpf').textContent = `−${formatCurrency(irpfAmount)}`;
  if (document.getElementById('irpf-rate-label')) document.getElementById('irpf-rate-label').textContent = irpfRate;
  if (document.getElementById('irpf-row')) document.getElementById('irpf-row').style.display = irpfRate > 0 ? 'flex' : 'none';
  if (document.getElementById('total-final')) document.getElementById('total-final').textContent = formatCurrency(total);
}

async function saveInvoice() {
  const clientId = document.getElementById('invoice-client-select').value;
  const date = document.getElementById('invoice-date').value;
  const taxRate = parseFloat(document.getElementById('invoice-tax').value) || 0;
  const irpfRate = parseFloat(document.getElementById('invoice-irpf').value) || 0;
  const notes = document.getElementById('invoice-notes').value.trim();

  if (!clientId) {
    showToast('Selecciona un cliente', 'error');
    return;
  }

  if (!date) {
    showToast('Selecciona una fecha', 'error');
    return;
  }

  if (invoiceItems.length === 0) {
    showToast('Añade al menos una línea a la factura', 'error');
    return;
  }

  const subtotal = invoiceItems.reduce((sum, item) => sum + item.total, 0);
  const taxAmount = subtotal * (taxRate / 100);
  const irpfAmount = subtotal * (irpfRate / 100);
  const total = subtotal + taxAmount - irpfAmount;

  const invoiceData = {
    invoice_number: pendingInvoiceNumber,
    client_id: parseInt(clientId),
    date,
    notes,
    subtotal,
    tax_rate: taxRate,
    tax_amount: taxAmount,
    irpf_rate: irpfRate,
    irpf_amount: irpfAmount,
    total,
    tipo_factura: rectificativaOf ? 'R1' : 'F1',
    factura_rectificada_id: rectificativaOf || null,
    items: invoiceItems.map(item => ({
      service_id: item.service_id,
      service_name: item.service_name,
      description: item.description,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total: item.total
    }))
  };

  const saveBtn = document.getElementById('save-invoice-btn');
  saveBtn.disabled = true;
  saveBtn.textContent = 'Guardando...';

  try {
    let invoice;
    if (editingInvoiceId) {
      invoice = await window.api.invoices.update(editingInvoiceId, invoiceData);
    } else {
      invoice = await window.api.invoices.create(invoiceData);
      if (rectificativaOf && rectificativaCounter !== null) {
        await window.api.commitRectificativaNumber(rectificativaCounter);
        await window.api.invoices.markAsRectified(rectificativaOf);
      } else {
        await window.api.commitInvoiceNumber(pendingCounter);
      }
    }

    // Calcular huella Verifactu automáticamente (solo si está activado)
    try {
      const vfCfg = await window.api.verifactu.getSettings();
      if (vfCfg && vfCfg.enabled) await window.api.verifactu.processInvoice(invoice.id);
    } catch (_) {}

    // Registrar en el log de actividad
    try {
      await window.api.activityLog.add({
        action_type: 'factura_creada',
        invoice_id: invoice.id,
        invoice_number: invoice.invoice_number,
        client_name: invoice.client_name || '',
        details: null
      });
    } catch (_) {}

    showToast(`Factura ${pendingInvoiceNumber} guardada correctamente`, 'success');

    navigateTo('invoices');
    setTimeout(() => { viewInvoice(invoice.id); }, 200);
  } catch (err) {
    showToast('Error al guardar la factura: ' + err.message, 'error');
    saveBtn.disabled = false;
    saveBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
        <polyline points="17 21 17 13 7 13 7 21"/>
        <polyline points="7 3 7 8 15 8"/>
      </svg>
      ${editingInvoiceId ? 'Guardar cambios' : 'Guardar factura'}
    `;
  }
}
