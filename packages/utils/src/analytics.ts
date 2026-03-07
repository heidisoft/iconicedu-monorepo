/**
 * Vendor-agnostic analytics interface.
 *
 * All apps implement this interface via their platform SDK (PostHog, Mixpanel, etc.).
 * Feature code imports `useAnalytics()` from each app's own analytics provider —
 * never the vendor SDK directly — so swapping providers only touches the provider file.
 */
export interface AnalyticsClient {
  /** Associate all subsequent events with a known user. */
  identify(userId: string, traits?: Record<string, unknown>): void;
  /** Track a discrete event. */
  capture(event: string, properties?: Record<string, unknown>): void;
  /** Track a screen / page view. */
  screen(name: string, properties?: Record<string, unknown>): void;
  /** Clear the current identity (e.g. on sign-out). */
  reset(): void;
}

/** Drop-in no-op — safe default before the real provider mounts. */
export function createNoopAnalytics(): AnalyticsClient {
  return {
    identify: () => undefined,
    capture: () => undefined,
    screen: () => undefined,
    reset: () => undefined,
  };
}

// ─── Canonical Event Catalog ──────────────────────────────────────────────────
//
// Every event name lives here. Prevents typos and makes audit-by-grep trivial.
// Add new events here before using them in any app.

export const AnalyticsEvent = {
  // ── Authentication ─────────────────────────────────────────────────────────
  LOGIN_OTP_REQUESTED: 'login otp requested',
  LOGIN_GOOGLE_STARTED: 'login google started',
  LOGIN_ERROR: 'login error',
  OTP_VERIFIED: 'otp verified',
  OTP_VERIFICATION_FAILED: 'otp verification failed',
  OTP_RESENT: 'otp resent',
  ONBOARDING_COMPLETED: 'onboarding completed',
  SIGNED_OUT: 'signed out',

  // ── Navigation / Screen ────────────────────────────────────────────────────
  SCREEN_VIEWED: 'screen viewed',
  TAB_CHANGED: 'tab changed',
  MODAL_OPENED: 'modal opened',
  MODAL_CLOSED: 'modal closed',
  DRAWER_OPENED: 'drawer opened',
  BACK_PRESSED: 'back pressed',

  // ── Clicks / Interactions ──────────────────────────────────────────────────
  BUTTON_CLICKED: 'button clicked',
  LINK_CLICKED: 'link clicked',
  MENU_ITEM_CLICKED: 'menu item clicked',
  CTA_CLICKED: 'cta clicked',

  // ── Form Interactions ──────────────────────────────────────────────────────
  FORM_STARTED: 'form started',
  FORM_STEP_COMPLETED: 'form step completed',
  FORM_SUBMITTED: 'form submitted',
  FORM_ABANDONED: 'form abandoned',
  FORM_VALIDATION_ERROR: 'form validation error',
  FIELD_FOCUSED: 'field focused',

  // ── Search ─────────────────────────────────────────────────────────────────
  SEARCH_PERFORMED: 'search performed',
  SEARCH_RESULT_CLICKED: 'search result clicked',
  SEARCH_CLEARED: 'search cleared',

  // ── Messaging ──────────────────────────────────────────────────────────────
  MESSAGE_SENT: 'message sent',
  MESSAGE_REACTION_ADDED: 'message reaction added',
  MESSAGE_REACTION_REMOVED: 'message reaction removed',
  MESSAGE_DELETED: 'message deleted',
  FILE_UPLOADED: 'file uploaded',
  FILE_DOWNLOADED: 'file downloaded',
  THREAD_OPENED: 'thread opened',
  CHANNEL_VIEWED: 'channel viewed',

  // ── Spaces / Classes ───────────────────────────────────────────────────────
  SESSION_JOINED: 'session joined',
  SESSION_LEFT: 'session left',
  SPACE_VIEWED: 'space viewed',
  CLASS_SCHEDULE_VIEWED: 'class schedule viewed',

  // ── Notifications ──────────────────────────────────────────────────────────
  NOTIFICATION_RECEIVED: 'notification received',
  NOTIFICATION_TAPPED: 'notification tapped',
  NOTIFICATION_DISMISSED: 'notification dismissed',
  NOTIFICATION_PREFS_SAVED: 'notification preferences saved',

  // ── Engagement / Feature Usage ─────────────────────────────────────────────
  CONTENT_SHARED: 'content shared',
  PROFILE_VIEWED: 'profile viewed',
  SETTINGS_OPENED: 'settings opened',
  SETTINGS_SAVED: 'settings saved',
  FEATURE_USED: 'feature used',

  // ── Errors ─────────────────────────────────────────────────────────────────
  ERROR_SHOWN: 'error shown',
  API_ERROR: 'api error',
  CRASH_RECOVERED: 'crash recovered',

  // ── Performance (manual; complements autocapture web vitals) ──────────────
  PERF_MARK: 'performance mark',
  SLOW_SCREEN: 'slow screen load',

  // ── Session / Funnel ──────────────────────────────────────────────────────
  SESSION_STARTED: 'session started',
  FUNNEL_STEP_REACHED: 'funnel step reached',
  FUNNEL_COMPLETED: 'funnel completed',
  FUNNEL_ABANDONED: 'funnel abandoned',

  // ── App Lifecycle (mobile) ────────────────────────────────────────────────
  APP_FOREGROUNDED: 'app foregrounded',
  APP_BACKGROUNDED: 'app backgrounded',

  // ── Family / Admin ────────────────────────────────────────────────────────
  FAMILY_INVITE_SENT: 'family invite sent',
  FAMILY_LINK_ACCEPTED: 'family link accepted',
  ADMIN_ACTION_PERFORMED: 'admin action performed',
} as const;

export type AnalyticsEventName = (typeof AnalyticsEvent)[keyof typeof AnalyticsEvent];

// ─── Standard Property Shapes ─────────────────────────────────────────────────
// These document expected properties for common events and enable IDE auto-complete.

export interface ScreenViewedProps {
  screen_name: string;
  previous_screen?: string;
}

export interface ButtonClickedProps {
  button_name: string;
  screen_name?: string;
  context?: string;
}

export interface FormEventProps {
  form_name: string;
  step?: string | number;
  field?: string;
  error?: string;
}

export interface SearchProps {
  query: string;
  result_count?: number;
  source?: string;
}

export interface MessageEventProps {
  channel_id?: string;
  channel_type?: 'dm' | 'space' | 'class' | 'support';
  has_attachment?: boolean;
  thread_id?: string;
}

export interface ErrorEventProps {
  message: string;
  code?: string | number;
  source?: string;
}

export interface FunnelProps {
  funnel_name: string;
  step: string | number;
  total_steps?: number;
}

export interface NotificationEventProps {
  notification_type?: string;
  source?: string;
  action?: string;
}

// ─── User Context / Person Traits ─────────────────────────────────────────────
// Set these when calling analytics.identify() so every event carries user context.

export interface UserTraits {
  email?: string;
  role?: string;
  org_id?: string;
  org_slug?: string;
  profile_kind?: string;
  onboarding_complete?: boolean;
  timezone?: string;
  created_at?: string;
}
