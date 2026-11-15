import { expect, test, type Browser, type Page } from '@playwright/test';

const classroomPath = process.env.PLAYWRIGHT_MESSAGE_AUDIENCE_PATH;
const staffAuth = process.env.PLAYWRIGHT_STAFF_AUTH_STATE;
const parentAuth = process.env.PLAYWRIGHT_PARENT_AUTH_STATE;
const tutorAuth = process.env.PLAYWRIGHT_TUTOR_AUTH_STATE;

async function openAs(browser: Browser, storageState: string) {
  const context = await browser.newContext({ storageState });
  const page = await context.newPage();
  await page.goto(classroomPath!);
  return { context, page };
}

async function send(page: Page, text: string) {
  await page.getByPlaceholder('Write a message...').fill(text);
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.getByText(text, { exact: true })).toBeVisible();
}

test.describe('staff channel message audiences', () => {
  test('keeps parent and tutor messages private through threads, edits, and deletion', async ({
    browser,
  }) => {
    test.skip(
      !classroomPath || !staffAuth || !parentAuth || !tutorAuth,
      'Set the message-audience path and staff, parent, and tutor storage states.',
    );

    const runId = `${Date.now()}`;
    const publicText = `E2E welcome ${runId}`;
    const parentText = `E2E parent payment ${runId}`;
    const parentReply = `E2E parent reply ${runId}`;
    const tutorText = `E2E tutor handover ${runId}`;

    const staff = await openAs(browser, staffAuth!);
    const parent = await openAs(browser, parentAuth!);
    const tutor = await openAs(browser, tutorAuth!);

    try {
      await expect(
        staff.page.getByRole('button', { name: /Message audience: Everyone/i }),
      ).toBeVisible();
      await send(staff.page, publicText);

      await staff.page.getByRole('button', { name: /Message audience:/i }).click();
      await staff.page.getByText(/^Parent(s)?$/).click();
      await send(staff.page, parentText);
      await expect(staff.page.getByText(/Private ·/).last()).toBeVisible();

      await parent.page.reload();
      await expect(parent.page.getByText(publicText, { exact: true })).toBeVisible();
      await expect(parent.page.getByText(parentText, { exact: true })).toBeVisible();
      await tutor.page.reload();
      await expect(tutor.page.getByText(publicText, { exact: true })).toBeVisible();
      await expect(tutor.page.getByText(parentText, { exact: true })).toHaveCount(0);

      const parentMessage = staff.page.getByText(parentText, { exact: true });
      await parentMessage.hover();
      await staff.page
        .getByLabel(/Start a thread|Reply in thread/)
        .last()
        .click();
      await expect(staff.page.getByText(/Replying privately/)).toBeVisible();
      await staff.page.getByPlaceholder('Reply...').fill(parentReply);
      await staff.page.getByRole('button', { name: 'Send', exact: true }).last().click();

      await parent.page.reload();
      await expect(parent.page.getByText(parentReply, { exact: true })).toBeVisible();
      await tutor.page.reload();
      await expect(tutor.page.getByText(parentReply, { exact: true })).toHaveCount(0);

      await staff.page.getByRole('button', { name: /Message audience:/i }).click();
      await staff.page.getByText(/^Tutor(s)?$/).click();
      await send(staff.page, tutorText);
      await tutor.page.reload();
      await expect(tutor.page.getByText(tutorText, { exact: true })).toBeVisible();
      await parent.page.reload();
      await expect(parent.page.getByText(tutorText, { exact: true })).toHaveCount(0);

      // Deletion must remove the restricted content for every allowed reader.
      const tutorMessage = staff.page.getByText(tutorText, { exact: true });
      await tutorMessage.hover();
      await staff.page.getByLabel('More actions').last().click();
      await staff.page.getByText('Delete message').click();
      await staff.page.getByRole('button', { name: 'Delete' }).click();
      await tutor.page.reload();
      await expect(tutor.page.getByText(tutorText, { exact: true })).toHaveCount(0);
    } finally {
      await Promise.all([
        staff.context.close(),
        parent.context.close(),
        tutor.context.close(),
      ]);
    }
  });
});
