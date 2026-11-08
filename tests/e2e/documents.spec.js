/**
 * E2E tests – Documents: applying a template when creating a document.
 */

const { test, expect, selectOptionContaining } = require('./fixtures');

test.describe('Documents', () => {
  test('applying a template fills in the title and the content', async ({ window }) => {
    const errors = [];
    window.on('pageerror', e => errors.push(e.message));

    await window.evaluate(() => window.api.documentTemplates.create({
      name: 'Informe de evolución E2E',
      body: '<p>Paciente: <strong>{nombre}</strong></p><p>Evolución favorable.</p>'
    }));

    await window.locator('.nav-item[data-page="documents"]').click();
    await window.waitForSelector('#doc-new-btn');
    await window.locator('#doc-new-btn').click();
    await window.waitForSelector('#doc-template-select');

    await selectOptionContaining(window.locator('#doc-template-select'), 'Informe de evolución E2E');
    await window.locator('#doc-apply-tpl-btn').click();

    await expect(window.locator('#doc-title')).toHaveValue('Informe de evolución E2E');
    await expect(window.locator('#doc-body')).toContainText('Evolución favorable.');
    await expect(window.locator('#doc-body strong')).toHaveText('{nombre}');
    expect(errors).toEqual([]);
  });

  test('a title already typed is kept when applying a template', async ({ window }) => {
    await window.locator('.nav-item[data-page="documents"]').click();
    await window.waitForSelector('#doc-new-btn');
    await window.locator('#doc-new-btn').click();
    await window.waitForSelector('#doc-template-select');

    await window.locator('#doc-title').fill('Mi título');
    await selectOptionContaining(window.locator('#doc-template-select'), 'Informe de evolución E2E');
    await window.locator('#doc-apply-tpl-btn').click();

    await expect(window.locator('#doc-title')).toHaveValue('Mi título');
    await expect(window.locator('#doc-body')).toContainText('Evolución favorable.');
  });
});
