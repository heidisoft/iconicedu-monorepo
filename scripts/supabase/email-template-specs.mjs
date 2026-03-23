const CONFIG_START_MARKER = '# BEGIN managed by supabase email templates';
const CONFIG_END_MARKER = '# END managed by supabase email templates';

const TEMPLATE_SPECS = [
  {
    id: 'confirmation',
    kind: 'auth',
    section: 'auth.email.template.confirmation',
    fileName: 'confirmation.html',
    subjectKey: 'mailer_subjects_confirmation',
    contentKey: 'mailer_templates_confirmation_content',
  },
  {
    id: 'invite',
    kind: 'auth',
    section: 'auth.email.template.invite',
    fileName: 'invite.html',
    subjectKey: 'mailer_subjects_invite',
    contentKey: 'mailer_templates_invite_content',
  },
  {
    id: 'magic_link',
    kind: 'auth',
    section: 'auth.email.template.magic_link',
    fileName: 'magic_link.html',
    subjectKey: 'mailer_subjects_magic_link',
    contentKey: 'mailer_templates_magic_link_content',
  },
  {
    id: 'recovery',
    kind: 'auth',
    section: 'auth.email.template.recovery',
    fileName: 'recovery.html',
    subjectKey: 'mailer_subjects_recovery',
    contentKey: 'mailer_templates_recovery_content',
  },
  {
    id: 'reauthentication',
    kind: 'auth',
    section: 'auth.email.template.reauthentication',
    fileName: 'reauthentication.html',
    subjectKey: 'mailer_subjects_reauthentication',
    contentKey: 'mailer_templates_reauthentication_content',
  },
  {
    id: 'email_change',
    kind: 'auth',
    section: 'auth.email.template.email_change',
    fileName: 'email_change.html',
    subjectKey: 'mailer_subjects_email_change',
    contentKey: 'mailer_templates_email_change_content',
  },
  {
    id: 'password_changed',
    kind: 'notification',
    section: 'auth.email.notification.password_changed',
    fileName: 'password_changed_notification.html',
    subjectKey: 'mailer_subjects_password_changed_notification',
    contentKey: 'mailer_templates_password_changed_notification_content',
    enabledKey: 'mailer_notifications_password_changed_enabled',
    defaultEnabled: false,
  },
  {
    id: 'email_changed',
    kind: 'notification',
    section: 'auth.email.notification.email_changed',
    fileName: 'email_changed_notification.html',
    subjectKey: 'mailer_subjects_email_changed_notification',
    contentKey: 'mailer_templates_email_changed_notification_content',
    enabledKey: 'mailer_notifications_email_changed_enabled',
    defaultEnabled: false,
  },
  {
    id: 'phone_changed',
    kind: 'notification',
    section: 'auth.email.notification.phone_changed',
    fileName: 'phone_changed_notification.html',
    subjectKey: 'mailer_subjects_phone_changed_notification',
    contentKey: 'mailer_templates_phone_changed_notification_content',
    enabledKey: 'mailer_notifications_phone_changed_enabled',
    defaultEnabled: false,
  },
  {
    id: 'mfa_factor_enrolled',
    kind: 'notification',
    section: 'auth.email.notification.mfa_factor_enrolled',
    fileName: 'mfa_factor_enrolled_notification.html',
    subjectKey: 'mailer_subjects_mfa_factor_enrolled_notification',
    contentKey: 'mailer_templates_mfa_factor_enrolled_notification_content',
    enabledKey: 'mailer_notifications_mfa_factor_enrolled_enabled',
    defaultEnabled: false,
  },
  {
    id: 'mfa_factor_unenrolled',
    kind: 'notification',
    section: 'auth.email.notification.mfa_factor_unenrolled',
    fileName: 'mfa_factor_unenrolled_notification.html',
    subjectKey: 'mailer_subjects_mfa_factor_unenrolled_notification',
    contentKey: 'mailer_templates_mfa_factor_unenrolled_notification_content',
    enabledKey: 'mailer_notifications_mfa_factor_unenrolled_enabled',
    defaultEnabled: false,
  },
  {
    id: 'identity_linked',
    kind: 'notification',
    section: 'auth.email.notification.identity_linked',
    fileName: 'identity_linked_notification.html',
    subjectKey: 'mailer_subjects_identity_linked_notification',
    contentKey: 'mailer_templates_identity_linked_notification_content',
    enabledKey: 'mailer_notifications_identity_linked_enabled',
    defaultEnabled: false,
  },
  {
    id: 'identity_unlinked',
    kind: 'notification',
    section: 'auth.email.notification.identity_unlinked',
    fileName: 'identity_unlinked_notification.html',
    subjectKey: 'mailer_subjects_identity_unlinked_notification',
    contentKey: 'mailer_templates_identity_unlinked_notification_content',
    enabledKey: 'mailer_notifications_identity_unlinked_enabled',
    defaultEnabled: false,
  },
];

function normalizeText(value) {
  return String(value ?? '')
    .replace(/\r\n/g, '\n')
    .trim();
}

export { CONFIG_END_MARKER, CONFIG_START_MARKER, TEMPLATE_SPECS, normalizeText };
