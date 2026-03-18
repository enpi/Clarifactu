/**
 * E2E tests – basic navigation and app shell.
 */

const { test, expect } = require('./fixtures');

test.describe('App navigation', () => {
  test('app loads and shows the dashboard', async ({ window }) => {
    // The page container should have content from the dashboard
    await expect(window.locator('#page-container')).not.toBeEmpty();
  });

  test('page title is "Clarifactu"', async ({ window }) => {
    const title = await window.title();
    expect(title).toBe('Clarifactu');
  });

  test('sidebar contains all expected nav items', async ({ window }) => {
    const navItems = window.locator('.nav-item');
    await expect(navItems).toHaveCount(6);

    const labels = await navItems.locator('.nav-label').allTextContents();
    expect(labels).toContain('Dashboard');
    expect(labels).toContain('Clientes');
    expect(labels).toContain('Servicios');
    expect(labels).toContain('Nueva Factura');
    expect(labels).toContain('Facturas');
    expect(labels).toContain('Configuración');
  });

  test('navigates to Clientes page', async ({ window }) => {
    await window.locator('.nav-item[data-page="clients"]').click();
    await window.waitForSelector('.page-title');
    const title = await window.locator('.page-title').innerText();
    expect(title).toBe('Clientes');
  });

  test('navigates to Servicios page', async ({ window }) => {
    await window.locator('.nav-item[data-page="services"]').click();
    await window.waitForSelector('.page-title');
    const title = await window.locator('.page-title').innerText();
    expect(title).toBe('Servicios');
  });

  test('navigates to Nueva Factura page', async ({ window }) => {
    await window.locator('.nav-item[data-page="new-invoice"]').click();
    await window.waitForSelector('.page-title');
    const title = await window.locator('.page-title').innerText();
    expect(title).toContain('Factura');
  });

  test('navigates to Facturas page', async ({ window }) => {
    await window.locator('.nav-item[data-page="invoices"]').click();
    await window.waitForSelector('.page-title');
    const title = await window.locator('.page-title').innerText();
    expect(title).toBe('Facturas');
  });

  test('navigates to Configuración page', async ({ window }) => {
    await window.locator('.nav-item[data-page="settings"]').click();
    await window.waitForSelector('.page-title');
    const title = await window.locator('.page-title').innerText();
    expect(title).toBe('Configuración');
  });

  test('Configuración shows the four expected tabs', async ({ window }) => {
    await window.locator('.nav-item[data-page="settings"]').click();
    await window.waitForSelector('.settings-tab');

    const tabs = window.locator('.settings-tab');
    const tabTexts = await tabs.allTextContents();
    const normalised = tabTexts.map(t => t.trim());

    expect(normalised.some(t => t.includes('Empresa'))).toBe(true);
    expect(normalised.some(t => t.includes('Facturas'))).toBe(true);
    expect(normalised.some(t => t.includes('Email'))).toBe(true);
    expect(normalised.some(t => t.includes('Avanzado'))).toBe(true);
  });

  test('Dashboard nav item is active on initial load', async ({ window }) => {
    await window.locator('.nav-item[data-page="dashboard"]').click();
    await window.waitForTimeout(500);
    const dashItem = window.locator('.nav-item[data-page="dashboard"]');
    await expect(dashItem).toHaveClass(/active/);
  });
});
