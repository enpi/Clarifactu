/**
 * E2E tests – Services CRUD flow.
 */

const { test, expect } = require('./fixtures');

const TEST_SERVICE = {
  name: 'Consulta E2E',
  description: 'Servicio de prueba E2E',
  price: '75.00',
  duration: '50 min',
};

test.describe('Services', () => {
  test.beforeEach(async ({ window }) => {
    await window.locator('.nav-item[data-page="services"]').click();
    await window.waitForSelector('.page-title');
  });

  test('services page shows title "Servicios"', async ({ window }) => {
    const title = await window.locator('.page-title').innerText();
    expect(title).toBe('Servicios');
  });

  test('can create a new service', async ({ window }) => {
    await window.locator('#new-service-btn').click();
    await window.waitForSelector('#service-form');

    await window.locator('#service-name').fill(TEST_SERVICE.name);
    await window.locator('#service-description').fill(TEST_SERVICE.description);
    await window.locator('#service-price').fill(TEST_SERVICE.price);
    await window.locator('#service-duration').fill(TEST_SERVICE.duration);

    await window.locator('#service-form button[type="submit"]').click();
    await window.waitForTimeout(500);

    const tbody = window.locator('#services-tbody');
    await expect(tbody).toContainText(TEST_SERVICE.name);
  });

  test('service appears in list with formatted price', async ({ window }) => {
    const tbody = window.locator('#services-tbody');
    await expect(tbody).toContainText(TEST_SERVICE.name);
    // Price should appear formatted (75 somewhere in the row)
    const row = tbody.locator('tr').filter({ hasText: TEST_SERVICE.name });
    await expect(row).toContainText('75');
  });

  test('can edit service price', async ({ window }) => {
    const row = window.locator('#services-tbody tr').filter({ hasText: TEST_SERVICE.name });
    await row.locator('button[title="Editar"]').click();
    await window.waitForSelector('#service-form');

    // Change price to 80
    await window.locator('#service-price').fill('80.00');
    await window.locator('#service-form button[type="submit"]').click();
    await window.waitForTimeout(500);

    // Navigate away and back to confirm persistence
    await window.locator('.nav-item[data-page="dashboard"]').click();
    await window.waitForTimeout(300);
    await window.locator('.nav-item[data-page="services"]').click();
    await window.waitForTimeout(600);

    const tbody = window.locator('#services-tbody');
    const updatedRow = tbody.locator('tr').filter({ hasText: TEST_SERVICE.name });
    await expect(updatedRow).toContainText('80');
  });

  test('can delete the service', async ({ window }) => {
    const row = window.locator('#services-tbody tr').filter({ hasText: TEST_SERVICE.name });
    await row.locator('button[title="Eliminar"]').click();

    await window.waitForSelector('#confirm-overlay:not(.hidden)');
    await window.locator('#confirm-ok').click();
    await window.waitForTimeout(500);

    const tbody = window.locator('#services-tbody');
    await expect(tbody).not.toContainText(TEST_SERVICE.name);
  });
});
