import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildAuthConfigPatch,
  parseArgs,
  parseManagedTemplateConfig,
} from './push-email-templates.mjs';

test('parseArgs supports dry-run and project-ref override', () => {
  const options = parseArgs(['--dry-run', '--project-ref', 'branch-ref-123']);

  assert.deepEqual(options, {
    dryRun: true,
    projectRef: 'branch-ref-123',
  });
});

test('parseManagedTemplateConfig reads generated managed sections', () => {
  const configText = [
    '[auth.email]',
    'enable_signup = true',
    '# BEGIN managed by supabase email templates',
    '# Managed email templates tracked in git.',
    '',
    '[auth.email.template.invite]',
    'subject = "Join IconicEdu"',
    'content_path = "./supabase/templates/email/invite.html"',
    '',
    '[auth.email.notification.password_changed]',
    'enabled = true',
    'subject = "Password changed"',
    'content_path = "./supabase/templates/email/password_changed_notification.html"',
    '',
    '# END managed by supabase email templates',
  ].join('\n');

  const templates = parseManagedTemplateConfig(configText);

  assert.deepEqual(
    templates.map((template) => ({
      id: template.id,
      subject: template.subject,
      enabled: template.enabled,
      contentPath: template.contentPath,
    })),
    [
      {
        id: 'invite',
        subject: 'Join IconicEdu',
        enabled: undefined,
        contentPath: './supabase/templates/email/invite.html',
      },
      {
        id: 'password_changed',
        subject: 'Password changed',
        enabled: true,
        contentPath: './supabase/templates/email/password_changed_notification.html',
      },
    ],
  );
});

test('buildAuthConfigPatch maps local templates to management API keys', () => {
  const payload = buildAuthConfigPatch([
    {
      id: 'invite',
      subjectKey: 'mailer_subjects_invite',
      contentKey: 'mailer_templates_invite_content',
      subject: 'Join IconicEdu',
      content: '<h1>Invite</h1>',
    },
    {
      id: 'password_changed',
      subjectKey: 'mailer_subjects_password_changed_notification',
      contentKey: 'mailer_templates_password_changed_notification_content',
      enabledKey: 'mailer_notifications_password_changed_enabled',
      subject: 'Password changed',
      content: '<h1>Password changed</h1>',
      enabled: true,
    },
  ]);

  assert.deepEqual(payload, {
    mailer_subjects_invite: 'Join IconicEdu',
    mailer_templates_invite_content: '<h1>Invite</h1>',
    mailer_subjects_password_changed_notification: 'Password changed',
    mailer_templates_password_changed_notification_content: '<h1>Password changed</h1>',
    mailer_notifications_password_changed_enabled: true,
  });
});
