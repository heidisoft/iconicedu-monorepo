import { randomUUID } from 'node:crypto';
import { test as base, expect, type APIRequestContext } from '@playwright/test';
import {
  createAudienceFixture,
  localUrl,
  senderRoles,
  type AudienceFixture,
  type Persona,
} from './helpers/message-audience';

const test = base.extend<{ audience: AudienceFixture }>({
  audience: async ({ baseURL }, runScenario) => {
    localUrl(baseURL ?? 'http://127.0.0.1:3100');
    const fixture = await createAudienceFixture();
    try {
      await runScenario(fixture);
    } finally {
      await fixture.cleanup();
    }
  },
});

async function send(
  request: APIRequestContext,
  fixture: AudienceFixture,
  sender: Persona,
  extra: Record<string, unknown> = {},
) {
  return request.post(`${fixture.apiUrl}/messages/text`, {
    headers: { Authorization: `Bearer ${sender.session.access_token}` },
    data: {
      orgId: fixture.org,
      channelId: fixture.channel,
      senderProfileId: sender.profile,
      content: `Audience E2E ${randomUUID()}`,
      ...extra,
    },
  });
}

const STAFF_ROLES = ['owner', 'admin', 'staff'];
const isStaff = (person: Persona) => STAFF_ROLES.includes(person.role);

/**
 * Safeguarding rules (see packages/utils/src/message-audience-policy.ts):
 * staff -> anyone; tutor -> staff/tutors/parents, students only with a parent
 * in the channel; parent -> staff/tutors; student -> nobody. The fixture's
 * channel student has no guardian in the channel.
 */
function canSendPrivately(sender: Persona, recipient: Persona) {
  if (isStaff(sender)) return true;
  if (sender.role === 'educator') return recipient.role !== 'child';
  if (sender.role === 'guardian')
    return isStaff(recipient) || recipient.role === 'educator';
  return false;
}

/** Audience members plus every staff reviewer (read-only review access). */
function readersOf(fixture: AudienceFixture, audience: Persona[]) {
  return fixture.members.filter((person) => audience.includes(person) || isStaff(person));
}

async function delivered(
  request: APIRequestContext,
  fixture: AudienceFixture,
  id: string,
  allowed: Persona[],
) {
  for (const persona of [...fixture.members, fixture.nonmember, fixture.outsider]) {
    const rows = await fixture.history(request, persona);
    expect(
      rows.some((row) => row.ids.id === id),
      `delivery to ${persona.name}`,
    ).toBe(allowed.includes(persona));
  }
}

test.describe('real local messaging role and recipient matrix', () => {
  test.skip(
    process.env.AUDIENCE_E2E_LOCAL !== '1',
    'Run pnpm --filter web test:e2e:audiences with the local Supabase stack.',
  );
  test.setTimeout(120000);

  for (const role of senderRoles) {
    test(`${role}: everyone and every individual recipient reach only the correct accounts`, async ({
      request,
      audience: fixture,
    }) => {
      const sender = fixture.members.find((person) => person.role === role)!;
      const publicUnread = fixture.members.map((person) => fixture.unread(person));
      const everyone = await send(request, fixture, sender);
      expect(everyone.status()).toBe(201);
      await delivered(request, fixture, (await everyone.json()).id, fixture.members);
      fixture.members.forEach((person, index) =>
        expect(
          fixture.unread(person) - publicUnread[index],
          `public unread for ${person.name}`,
        ).toBe(person === sender ? 0 : 1),
      );

      for (const recipient of fixture.members.filter((person) => person !== sender)) {
        const before = fixture.members.map((person) => fixture.unread(person));
        const response = await send(request, fixture, sender, {
          audience: { profileIds: [recipient.profile] },
        });
        if (!canSendPrivately(sender, recipient)) {
          expect(response.status(), `${role} to ${recipient.name} is blocked`).toBe(403);
          fixture.members.forEach((person, index) =>
            expect(
              fixture.unread(person) - before[index],
              `unread for ${person.name}`,
            ).toBe(0),
          );
          continue;
        }
        expect(response.status(), `${role} to ${recipient.name}`).toBe(201);
        const { id } = await response.json();
        await delivered(request, fixture, id, readersOf(fixture, [sender, recipient]));
        fixture.members.forEach((person, index) => {
          expect(
            fixture.unread(person) - before[index],
            `unread for ${person.name}`,
          ).toBe(person === recipient ? 1 : 0);
        });
      }
    });

    test(`${role}: browser composer sends to a named person, resets, and sends to everyone`, async ({
      playwright,
      request,
      audience: fixture,
    }) => {
      const browser = await playwright.chromium.launch();
      try {
        const sender = fixture.members.find((person) => person.role === role)!;
        // Peer Parent proves profile targeting rather than a role broadcast.
        // Parents may only address staff and tutors, so they target the tutor.
        const recipient =
          role === 'guardian'
            ? fixture.members.find((person) => person.role === 'educator')!
            : fixture.members[6];
        const reader = await fixture.open(browser, recipient);
        const excluded = await fixture.open(
          browser,
          fixture.members.find(
            (person) => person !== sender && person !== recipient && !isStaff(person),
          )!,
        );
        const actor = await fixture.open(browser, sender);
        const privateText = `Private UI ${randomUUID()}`,
          publicText = `Everyone UI ${randomUUID()}`;
        try {
          await actor.page.bringToFront();
          if (role === 'child') {
            // Students cannot start private messages: no audience picker.
            await expect(
              actor.page.getByPlaceholder(/^(Write a message|Message #)/),
            ).toBeVisible();
            await expect(
              actor.page.getByRole('button', { name: /Message audience:/ }),
            ).toHaveCount(0);
          } else {
            await actor.page.getByRole('button', { name: /Message audience:/ }).click();
            const target = actor.page.getByRole('menuitemcheckbox', {
              name: role === 'guardian' ? /E2E educator/ : /Peer Parent/,
            });
            await expect(target).toBeInViewport();
            await target.click();
            await actor.page.keyboard.press('Escape');
            await actor.page
              .getByPlaceholder(/^(Write a message|Message #)/)
              .fill(privateText);
            await actor.page.getByRole('button', { name: 'Send', exact: true }).click();
            await expect(
              actor.page.getByPlaceholder(/^(Write a message|Message #)/),
            ).toHaveValue('');
            await expect(
              actor.page.getByText(privateText, { exact: true }),
            ).toBeVisible();
            await expect(
              actor.page.getByRole('button', { name: /Message audience: Everyone/ }),
            ).toBeVisible();
            await expect(reader.page.getByText(privateText, { exact: true })).toBeVisible(
              {
                timeout: 15000,
              },
            );
            await reader.page.reload();
            await expect(
              reader.page.getByText(privateText, { exact: true }),
            ).toBeVisible();
            const privateId = (await fixture.history(request, sender)).find((row) =>
              JSON.stringify(row).includes(privateText),
            )?.ids.id;
            expect(privateId).toBeTruthy();
            await delivered(
              request,
              fixture,
              privateId!,
              readersOf(fixture, [sender, recipient]),
            );
            await excluded.page.reload();
            await expect(
              excluded.page.getByPlaceholder(/^(Write a message|Message #)/),
            ).toBeVisible();
            await expect(
              excluded.page.getByText(privateText, { exact: true }),
            ).toHaveCount(0);
          }
          await actor.page.bringToFront();
          await actor.page
            .getByPlaceholder(/^(Write a message|Message #)/)
            .fill(publicText);
          await actor.page.getByRole('button', { name: 'Send', exact: true }).click();
          await expect(
            actor.page.getByPlaceholder(/^(Write a message|Message #)/),
          ).toHaveValue('');
          await expect(actor.page.getByText(publicText, { exact: true })).toBeVisible();
          for (const page of [reader.page, excluded.page]) {
            await page.reload();
            await expect(page.getByText(publicText, { exact: true })).toBeVisible();
          }
          // Also verify all remaining accounts through the authenticated history endpoint.
          const history = await fixture.history(request, sender);
          const id = history.find((row) => JSON.stringify(row).includes(publicText))?.ids
            .id;
          expect(id).toBeTruthy();
          await delivered(request, fixture, id!, fixture.members);
        } finally {
          await Promise.allSettled([
            actor.context.close(),
            reader.context.close(),
            excluded.context.close(),
          ]);
        }
      } finally {
        await browser.close();
      }
    });
  }

  test('private replies, edits, retry deduplication, deletion, and forged recipients preserve isolation', async ({
    request,
    audience: fixture,
  }) => {
    // Tutor -> parent private conversation. Peer Parent is excluded; the
    // owner reviews it read-only.
    const sender = fixture.members.find((person) => person.role === 'educator')!;
    const recipient = fixture.members.find((person) => person.role === 'guardian')!;
    const excluded = fixture.members[6];
    const reviewer = fixture.members.find((person) => person.role === 'owner')!;
    const readers = readersOf(fixture, [sender, recipient]);
    expect(
      (await request.post(`${fixture.apiUrl}/messages/text`, { data: {} })).status(),
    ).toBe(401);
    const clientMessageId = randomUUID();
    const input = {
      clientMessageId,
      audience: { profileIds: [recipient.profile, recipient.profile] },
    };
    const root = await send(request, fixture, sender, input);
    expect(root.status()).toBe(201);
    const { id } = await root.json();
    const retry = await send(request, fixture, sender, input);
    expect(retry.status()).toBe(201);
    expect((await retry.json()).id).toBe(id);
    expect(
      (await fixture.history(request, recipient)).filter((row) => row.ids.id === id),
    ).toHaveLength(1);
    const quoted = await send(request, fixture, recipient, { replyToMessageId: id });
    expect(quoted.status()).toBe(201);
    await delivered(request, fixture, (await quoted.json()).id, readers);
    expect(
      (await fixture.history(request, reviewer)).some((row) => row.ids.id === id),
      'staff reviewer can read the private message',
    ).toBe(true);
    for (const field of ['threadParentId', 'replyToMessageId']) {
      expect(
        (await send(request, fixture, reviewer, { [field]: id })).status(),
        `staff reviewer cannot reply via ${field}`,
      ).toBe(403);
    }
    expect(
      (await fixture.history(request, excluded, recipient.profile)).some(
        (row) => row.ids.id === id,
      ),
    ).toBe(false);
    const reply = await send(request, fixture, recipient, { threadParentId: id });
    expect(reply.status()).toBe(201);
    const replyId = (await reply.json()).id;
    for (const person of [sender, recipient, reviewer, excluded]) {
      const response = await request.get(`${fixture.apiUrl}/messages/thread`, {
        headers: { Authorization: `Bearer ${person.session.access_token}` },
        params: {
          orgId: fixture.org,
          channelId: fixture.channel,
          parentMessageId: id,
          threadId: fixture.threadId(id),
          profileId: person.profile,
          accountId: person.account,
        },
      });
      expect(response.status()).toBe(200);
      expect(JSON.stringify(await response.json()).includes(replyId)).toBe(
        person !== excluded,
      );
    }
    for (const profileIds of [
      [],
      [fixture.nonmember.profile],
      [fixture.outsider.profile],
    ]) {
      expect(
        (await send(request, fixture, sender, { audience: { profileIds } })).status(),
      ).toBe(400);
    }
    expect(
      (
        await send(request, fixture, excluded, { senderProfileId: sender.profile })
      ).status(),
    ).toBe(403);
    expect((await send(request, fixture, fixture.nonmember)).status()).toBe(403);
    expect((await send(request, fixture, fixture.outsider)).status()).toBe(403);
    expect(
      (
        await send(request, fixture, recipient, {
          threadParentId: id,
          audience: { profileIds: [excluded.profile] },
        })
      ).status(),
    ).toBe(400);
    const edited = await request.patch(`${fixture.apiUrl}/messages/${id}/text`, {
      headers: { Authorization: `Bearer ${sender.session.access_token}` },
      data: { orgId: fixture.org, messageId: id, content: 'Edited private E2E message' },
    });
    expect(edited.status()).toBe(200);
    await delivered(request, fixture, id, readers);
    const deleted = await request.delete(`${fixture.apiUrl}/messages/${replyId}`, {
      headers: { Authorization: `Bearer ${recipient.session.access_token}` },
      data: { orgId: fixture.org, profileId: recipient.profile },
    });
    expect(deleted.status()).toBe(200);
    const remaining = await request.get(`${fixture.apiUrl}/messages/thread`, {
      headers: { Authorization: `Bearer ${sender.session.access_token}` },
      params: {
        orgId: fixture.org,
        channelId: fixture.channel,
        threadId: fixture.threadId(id),
        parentMessageId: id,
        profileId: sender.profile,
        accountId: sender.account,
      },
    });
    expect(remaining.status()).toBe(200);
    expect(JSON.stringify(await remaining.json())).not.toContain(replyId);
    const deletedRoot = await request.delete(`${fixture.apiUrl}/messages/${id}`, {
      headers: { Authorization: `Bearer ${sender.session.access_token}` },
      data: { orgId: fixture.org, profileId: sender.profile },
    });
    expect(deletedRoot.status()).toBe(200);
    await delivered(request, fixture, id, []);
  });
});
