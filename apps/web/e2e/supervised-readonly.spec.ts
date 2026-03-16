import { expect, test } from '@playwright/test';

test('supervised conversation keeps message actions disabled but thread viewing enabled', async ({
  page,
}) => {
  const path = process.env.PLAYWRIGHT_SUPERVISED_PATH;
  test.skip(
    !process.env.PLAYWRIGHT_AUTH_STATE || !path,
    'Set PLAYWRIGHT_AUTH_STATE and PLAYWRIGHT_SUPERVISED_PATH to run supervised conversation assertions.',
  );

  await page.goto(path!);

  await expect(page.getByText('Read-only supervised conversation')).toBeVisible();

  const saveButton = page.getByLabel('Save message').first();
  if ((await saveButton.count()) > 0) {
    await expect(saveButton).toBeDisabled();
  }

  const addEmojiButton = page.getByLabel('Add emoji').first();
  if ((await addEmojiButton.count()) > 0) {
    await expect(addEmojiButton).toBeDisabled();
  }

  const threadIndicator = page
    .getByRole('button', { name: /\d+\s+repl(y|ies)/i })
    .first();
  if ((await threadIndicator.count()) > 0) {
    await expect(threadIndicator).toBeEnabled();
    await threadIndicator.click();
    await expect(page.locator('.border-l-2.border-border\\/60').first()).toBeVisible();
  }
});
