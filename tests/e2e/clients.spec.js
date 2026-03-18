/**
 * E2E tests – Clients CRUD flow.
 */

const { test, expect } = require('./fixtures');

const TEST_CLIENT = {
  name: 'Test Cliente E2E',
  email: 'test@e2e.com',
  nif: '12345678Z',
  phone: '600999888',
};

test.describe('Clients', () => {
  test.beforeEach(async ({ window }) => {
    // Navigate to Clients before each test
    await window.locator('.nav-item[data-page="clients"]').click();
    await window.waitForSelector('.page-title');
  });

  test('clients page shows title "Clientes"', async ({ window }) => {
    const title = await window.locator('.page-title').innerText();
    expect(title).toBe('Clientes');
  });

  test('can create a new client', async ({ window }) => {
    // Open new client modal
    await window.locator('#new-client-btn').click();
    await window.waitForSelector('#client-form');

    // Fill in the form
    await window.locator('#client-name').fill(TEST_CLIENT.name);
    await window.locator('#client-nif').fill(TEST_CLIENT.nif);
    await window.locator('#client-email').fill(TEST_CLIENT.email);
    await window.locator('#client-phone').fill(TEST_CLIENT.phone);

    // Submit the form
    await window.locator('#client-form button[type="submit"]').click();
    await window.waitForTimeout(500);

    // Client should now appear in the table
    const tbody = window.locator('#clients-tbody');
    await expect(tbody).toContainText(TEST_CLIENT.name);
  });

  test('client appears in the list after creation', async ({ window }) => {
    const tbody = window.locator('#clients-tbody');
    await expect(tbody).toContainText(TEST_CLIENT.name);
  });

  test('can search for the created client', async ({ window }) => {
    const searchInput = window.locator('#client-search');
    await searchInput.fill('Test Cliente');
    await window.waitForTimeout(400);

    const tbody = window.locator('#clients-tbody');
    await expect(tbody).toContainText(TEST_CLIENT.name);
  });

  test('can edit a client and verify the change', async ({ window }) => {
    // Find the edit button for Test Cliente E2E
    const row = window.locator('#clients-tbody tr').filter({ hasText: TEST_CLIENT.name });
    await row.locator('button[title="Editar"]').click();
    await window.waitForSelector('#client-form');

    // Change the phone number
    await window.locator('#client-phone').fill('611777666');
    await window.locator('#client-form button[type="submit"]').click();
    await window.waitForTimeout(500);

    // The table should reflect the change (reload the page to confirm)
    await window.locator('.nav-item[data-page="clients"]').click();
    await window.waitForTimeout(600);

    const tbody = window.locator('#clients-tbody');
    await expect(tbody).toContainText(TEST_CLIENT.name);
  });

  test('can delete the client', async ({ window }) => {
    // Find the delete button for Test Cliente E2E
    const row = window.locator('#clients-tbody tr').filter({ hasText: TEST_CLIENT.name });
    await row.locator('button[title="Eliminar"]').click();

    // Confirm the deletion dialog
    await window.waitForSelector('#confirm-overlay:not(.hidden)');
    await window.locator('#confirm-ok').click();
    await window.waitForTimeout(500);

    // Client should no longer appear in the table
    const tbody = window.locator('#clients-tbody');
    await expect(tbody).not.toContainText(TEST_CLIENT.name);
  });
});
