import { test, expect } from '@playwright/test';
import { createWhiteboardClass } from './helpers/whiteboard-class';

for (const width of [320, 390, 768]) {
  test(`whiteboard conserves space and scrolls tools on a ${width}px touch screen`, async ({
    browser,
  }) => {
    const fixture = createWhiteboardClass();
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      hasTouch: true,
    });
    await context.addInitScript(
      (token) =>
        sessionStorage.setItem(
          'whiteboard-test-entry',
          JSON.stringify({ token, title: 'Mobile class' }),
        ),
      fixture.teacher,
    );
    const page = await context.newPage();
    try {
      await page.goto('/visual-test/whiteboard');
      await page.getByRole('button', { name: 'Join class whiteboard' }).click();
      await expect(page.getByRole('button', { name: 'Pen', exact: true })).toBeEnabled();
      const details = page.getByTestId('whiteboard-board-details');
      if (width < 600) await expect(details).toBeHidden();
      else await expect(details).toBeVisible();
      const overlay = page.getByTestId('whiteboard-overlay-toolbar');
      const board = (await page.getByTestId('classroom-whiteboard').boundingBox())!;
      const overlayBox = (await overlay.boundingBox())!;
      expect(overlayBox.x + overlayBox.width).toBeLessThanOrEqual(board.x + board.width);
      if (width < 600) expect(overlayBox.y - board.y).toBeLessThan(20);
      const view = overlay.getByRole('button', { name: 'View controls' });
      await view.scrollIntoViewIfNeeded();
      await view.click();
      await expect(page.getByRole('menuitem', { name: 'Fit content' })).toBeVisible();
      await page.keyboard.press('Escape');
      const pen = overlay.getByRole('button', { name: 'Pen', exact: true });
      await pen.scrollIntoViewIfNeeded();
      await pen.click();
      const styles = page.getByRole('toolbar', { name: 'Drawing styles' });
      await expect(styles).toBeVisible();
      const stylesBox = (await styles.boundingBox())!;
      expect(stylesBox.y).toBeGreaterThanOrEqual(overlayBox.y + overlayBox.height);
    } finally {
      await context.close();
      fixture.cleanup();
    }
  });
}
