/**
 * E2E tests – Invoice creation and management flow.
 * This is the most important E2E test file.
 */

const { test, expect } = require('./fixtures');

// Helper: navigate to Clients and create a temporary client via the UI
async function createTestClient(window, name = 'Cliente Factura E2E') {
  await window.locator('.nav-item[data-page="clients"]').click();
  await window.waitForSelector('#new-client-btn');
  await window.locator('#new-client-btn').click();
  await window.waitForSelector('#client-form');
  await window.locator('#client-name').fill(name);
  await window.locator('#client-email').fill('factura-e2e@test.com');
  await window.locator('#client-nif').fill('99887766X');
  await window.locator('#client-form button[type="submit"]').click();
  await window.waitForTimeout(600);
}

// Helper: delete a client by name (to clean up after tests)
async function deleteTestClient(window, name) {
  await window.locator('.nav-item[data-page="clients"]').click();
  await window.waitForTimeout(600);
  const row = window.locator('#clients-tbody tr').filter({ hasText: name });
  const count = await row.count();
  if (count > 0) {
    await row.locator('button[title="Eliminar"]').click();
    await window.waitForSelector('#confirm-overlay:not(.hidden)');
    await window.locator('#confirm-ok').click();
    await window.waitForTimeout(400);
  }
}

test.describe('Invoices', () => {
  const CLIENT_NAME = 'Cliente Factura E2E';

  test.beforeAll(async ({ app }) => {
    // Create the test client before the suite runs
    const page = await app.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(1500);
    await createTestClient(page, CLIENT_NAME);
  });

  test.afterAll(async ({ app }) => {
    const page = await app.firstWindow();
    await deleteTestClient(page, CLIENT_NAME);
  });

  test('Nueva Factura page loads correctly', async ({ window }) => {
    await window.locator('.nav-item[data-page="new-invoice"]').click();
    await window.waitForSelector('.page-title');
    const title = await window.locator('.page-title').innerText();
    expect(title).toContain('Factura');
    // Invoice number display should be visible
    await expect(window.locator('#invoice-number-display')).toBeVisible();
  });

  test('can select a client from the dropdown', async ({ window }) => {
    await window.locator('.nav-item[data-page="new-invoice"]').click();
    await window.waitForSelector('#invoice-client-select');

    const select = window.locator('#invoice-client-select');
    await select.selectOption({ label: new RegExp(CLIENT_NAME) });
    await window.waitForTimeout(400);

    // Client info preview should appear
    const preview = window.locator('#client-info-preview');
    await expect(preview).toBeVisible();
  });

  test('can add a custom invoice line and see total update', async ({ window }) => {
    await window.locator('.nav-item[data-page="new-invoice"]').click();
    await window.waitForSelector('#invoice-client-select');

    // Select client
    const select = window.locator('#invoice-client-select');
    await select.selectOption({ label: new RegExp(CLIENT_NAME) });
    await window.waitForTimeout(300);

    // Choose "custom concept"
    await window.locator('#add-service-select').selectOption('custom');
    await window.waitForSelector('#add-item-name:visible');

    // Fill the custom item
    await window.locator('#add-item-name').fill('Sesión terapia');
    await window.locator('#add-item-qty').fill('1');
    await window.locator('#add-item-price').fill('60');

    // Add the item
    await window.locator('#add-item-btn').click();
    await window.waitForTimeout(300);

    // Total should show 60
    const totalFinal = window.locator('#total-final');
    await expect(totalFinal).toContainText('60');
  });

  test('full invoice creation flow: save, navigate to Facturas, see invoice in table', async ({ window }) => {
    await window.locator('.nav-item[data-page="new-invoice"]').click();
    await window.waitForSelector('#invoice-client-select');

    // Select client
    const select = window.locator('#invoice-client-select');
    await select.selectOption({ label: new RegExp(CLIENT_NAME) });
    await window.waitForTimeout(300);

    // Get the generated invoice number before saving
    const invoiceNumber = await window.locator('#invoice-number-display').innerText();

    // Add a custom item
    await window.locator('#add-service-select').selectOption('custom');
    await window.waitForSelector('#add-item-name:visible');
    await window.locator('#add-item-name').fill('Sesión terapia E2E');
    await window.locator('#add-item-qty').fill('1');
    await window.locator('#add-item-price').fill('60');
    await window.locator('#add-item-btn').click();
    await window.waitForTimeout(300);

    // Save the invoice
    await window.locator('#save-invoice-btn').click();

    // Should navigate to Facturas and the modal should open with invoice details
    await window.waitForSelector('.page-title', { timeout: 8000 });
    const pageTitle = await window.locator('.page-title').innerText();
    expect(pageTitle).toBe('Facturas');

    // Wait for the invoice detail modal or the invoices table to load
    await window.waitForTimeout(1000);

    // Close any open modal
    const modalOverlay = window.locator('#modal-overlay:not(.hidden)');
    const modalVisible = await modalOverlay.count();
    if (modalVisible > 0) {
      await window.locator('#modal-close-btn').click();
      await window.waitForTimeout(400);
    }

    // Invoice should appear in the table
    const tbody = window.locator('#invoices-tbody');
    await expect(tbody).toContainText(invoiceNumber.trim());
  });

  test('invoice shows in Facturas table with client name', async ({ window }) => {
    await window.locator('.nav-item[data-page="invoices"]').click();
    await window.waitForTimeout(800);

    const tbody = window.locator('#invoices-tbody');
    await expect(tbody).toContainText(CLIENT_NAME);
  });
});
