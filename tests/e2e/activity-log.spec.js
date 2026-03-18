/**
 * E2E tests – Activity log on the Dashboard.
 * Creates a full invoice and verifies the log entry shows up on the Dashboard.
 */

const { test, expect } = require('./fixtures');

const CLIENT_NAME = 'Cliente ActivityLog E2E';

async function ensureTestClient(window) {
  await window.locator('.nav-item[data-page="clients"]').click();
  await window.waitForTimeout(600);

  // Check if client already exists
  const tbody = window.locator('#clients-tbody');
  const existingRow = tbody.locator('tr').filter({ hasText: CLIENT_NAME });
  if (await existingRow.count() > 0) return;

  // Create it
  await window.locator('#new-client-btn').click();
  await window.waitForSelector('#client-form');
  await window.locator('#client-name').fill(CLIENT_NAME);
  await window.locator('#client-email').fill('activity-log@e2e.com');
  await window.locator('#client-form button[type="submit"]').click();
  await window.waitForTimeout(600);
}

async function cleanupTestClient(window) {
  await window.locator('.nav-item[data-page="clients"]').click();
  await window.waitForTimeout(600);
  const row = window.locator('#clients-tbody tr').filter({ hasText: CLIENT_NAME });
  const count = await row.count();
  if (count > 0) {
    await row.locator('button[title="Eliminar"]').click();
    await window.waitForSelector('#confirm-overlay:not(.hidden)');
    await window.locator('#confirm-ok').click();
    await window.waitForTimeout(400);
  }
}

test.describe('Activity Log', () => {
  let createdInvoiceNumber = null;

  test('creating an invoice adds a "Factura creada" entry in the activity log', async ({ window }) => {
    // Ensure the test client exists
    await ensureTestClient(window);

    // Navigate to Nueva Factura
    await window.locator('.nav-item[data-page="new-invoice"]').click();
    await window.waitForSelector('#invoice-client-select');

    // Capture the invoice number
    createdInvoiceNumber = (await window.locator('#invoice-number-display').innerText()).trim();

    // Select client
    const select = window.locator('#invoice-client-select');
    await select.selectOption({ label: new RegExp(CLIENT_NAME) });
    await window.waitForTimeout(300);

    // Add a custom item
    await window.locator('#add-service-select').selectOption('custom');
    await window.waitForSelector('#add-item-name:visible');
    await window.locator('#add-item-name').fill('Sesión actividad log');
    await window.locator('#add-item-qty').fill('1');
    await window.locator('#add-item-price').fill('55');
    await window.locator('#add-item-btn').click();
    await window.waitForTimeout(300);

    // Save the invoice
    await window.locator('#save-invoice-btn').click();
    await window.waitForSelector('.page-title', { timeout: 8000 });

    // Close modal if it opened
    const modalOverlay = window.locator('#modal-overlay:not(.hidden)');
    if (await modalOverlay.count() > 0) {
      await window.locator('#modal-close-btn').click();
      await window.waitForTimeout(300);
    }

    // Navigate to Dashboard
    await window.locator('.nav-item[data-page="dashboard"]').click();
    await window.waitForTimeout(1000);

    // The activity log body should contain "Factura creada"
    const activityBody = window.locator('#activity-log-body');
    await expect(activityBody).toContainText('Factura creada', { timeout: 8000 });
  });

  test('activity log shows the invoice number of the created invoice', async ({ window }) => {
    if (!createdInvoiceNumber) {
      test.skip(true, 'No invoice number captured in previous test');
      return;
    }

    await window.locator('.nav-item[data-page="dashboard"]').click();
    await window.waitForTimeout(800);

    const activityBody = window.locator('#activity-log-body');
    await expect(activityBody).toContainText(createdInvoiceNumber);
  });

  test.afterAll(async ({ app }) => {
    const page = await app.firstWindow();
    await cleanupTestClient(page);
  });
});
