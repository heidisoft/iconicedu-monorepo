import { test, expect } from '@playwright/test';
import { createWhiteboardClass, joinClassAs, draw } from './helpers/whiteboard-class';

test('quick styles keep native options accessible and persist chosen pen styles', async ({
  browser,
  request,
}) => {
  const fixture = createWhiteboardClass();
  const { page, context } = await joinClassAs(browser, fixture.teacher);
  try {
    await page.getByRole('button', { name: 'Pen', exact: true }).click();
    const strip = page.getByRole('toolbar', { name: 'Drawing styles' });
    await expect(strip).toBeVisible();
    const canvas = page.getByTestId('whiteboard-canvas');
    await expect(canvas).toHaveAttribute('data-style-options', 'false');
    await strip.getByRole('button', { name: 'More style options' }).click();
    await expect(canvas).toHaveAttribute('data-style-options', 'true');
    await expect(page.locator('.selected-shape-actions .Island')).toBeVisible();
    await strip.getByRole('button', { name: 'Stroke color #1971c2' }).click();
    await expect(canvas).toHaveAttribute('data-style-options', 'false');
    await strip.getByRole('button', { name: 'Thick stroke' }).click();
    await draw(page);
    await expect(page.getByText('Saved', { exact: true })).toBeVisible();
    await expect
      .poll(async () => {
        const response = await request.get('http://127.0.0.1:3001/whiteboards/current', {
          headers: { Authorization: `Bearer ${fixture.teacher}` },
        });
        const data = await response.json();
        return data.document.pages[0].elements[0]?.data;
      })
      .toMatchObject({ strokeColor: '#1971c2', strokeWidth: 4 });
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(strip).toBeVisible();
    const box = (await strip.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
  } finally {
    await context.close();
    fixture.cleanup();
  }
});
