/**
 * E2E tests – Settings page.
 */

const { test, expect } = require('./fixtures');

test.describe('Settings', () => {
  test.beforeEach(async ({ window }) => {
    await window.locator('.nav-item[data-page="settings"]').click();
    await window.waitForSelector('.settings-tab');
  });

  test('settings page shows title "Configuración"', async ({ window }) => {
    const title = await window.locator('.page-title').innerText();
    expect(title).toBe('Configuración');
  });

  test('Empresa tab is active by default', async ({ window }) => {
    const activeTab = window.locator('.settings-tab.active');
    const tabText = await activeTab.innerText();
    expect(tabText.trim()).toContain('Empresa');

    // Empresa panel should be active
    const activePanel = window.locator('.settings-panel.active');
    await expect(activePanel).toBeVisible();
    await expect(activePanel.locator('#business-form')).toBeVisible();
  });

  test('can fill and save business name with success toast', async ({ window }) => {
    // Make sure Empresa tab is active
    await window.locator('.settings-tab[data-tab="empresa"]').click();
    await window.waitForTimeout(300);

    // Clear and fill the business name
    await window.locator('#biz-name').fill('Test Empresa E2E');

    // Submit the form
    await window.locator('#business-form button[type="submit"]').click();
    await window.waitForTimeout(500);

    // Toast should appear with success message
    const toast = window.locator('.toast.success');
    await expect(toast).toBeVisible({ timeout: 4000 });
    const toastText = await toast.innerText();
    expect(toastText).toContain('guardad');
  });

  test('Facturas tab shows numbering form', async ({ window }) => {
    await window.locator('.settings-tab[data-tab="facturas"]').click();
    await window.waitForTimeout(400);

    // The Facturas panel should now be active and show the numbering form
    const facturasPanel = window.locator('.settings-panel[data-panel="facturas"]');
    await expect(facturasPanel).toHaveClass(/active/);

    // Should have prefix input
    const prefixInput = facturasPanel.locator('#num-prefix');
    await expect(prefixInput).toBeVisible();
  });

  test('can change invoice prefix and preview updates', async ({ window }) => {
    await window.locator('.settings-tab[data-tab="facturas"]').click();
    await window.waitForTimeout(400);

    const facturasPanel = window.locator('.settings-panel[data-panel="facturas"]');
    const prefixInput = facturasPanel.locator('#num-prefix');

    await prefixInput.fill('TF');
    await prefixInput.dispatchEvent('input');
    await window.waitForTimeout(300);

    // Preview should update to show TF
    const preview = facturasPanel.locator('#number-preview');
    if (await preview.count() > 0) {
      const previewText = await preview.innerText();
      expect(previewText).toContain('TF');
    }
  });

  test('can save invoice numbering settings with toast', async ({ window }) => {
    await window.locator('.settings-tab[data-tab="facturas"]').click();
    await window.waitForTimeout(400);

    const facturasPanel = window.locator('.settings-panel[data-panel="facturas"]');
    const saveBtn = facturasPanel.locator('button[type="submit"]');
    await saveBtn.click();
    await window.waitForTimeout(500);

    const toast = window.locator('.toast.success');
    await expect(toast).toBeVisible({ timeout: 4000 });
  });

  test('Email tab shows Gmail configuration fields', async ({ window }) => {
    await window.locator('.settings-tab[data-tab="email"]').click();
    await window.waitForTimeout(400);

    const emailPanel = window.locator('.settings-panel[data-panel="email"]');
    await expect(emailPanel).toHaveClass(/active/);

    // Should have gmail user and app password fields
    await expect(emailPanel.locator('#email-user')).toBeVisible();
    await expect(emailPanel.locator('#email-pass')).toBeVisible();
  });

  test('Avanzado tab shows Verifactu toggle', async ({ window }) => {
    await window.locator('.settings-tab[data-tab="avanzado"]').click();
    await window.waitForTimeout(400);

    const avanzadoPanel = window.locator('.settings-panel[data-panel="avanzado"]');
    await expect(avanzadoPanel).toHaveClass(/active/);

    // Should contain a Verifactu toggle or checkbox
    const verifactuToggle = avanzadoPanel.locator('#vf-enabled');
    await expect(verifactuToggle).toBeVisible();
  });
});
