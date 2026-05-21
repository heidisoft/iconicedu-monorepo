import * as React from 'react';
import {
  AsYouType,
  parsePhoneNumberFromString,
  getCountryCallingCode,
} from 'libphonenumber-js';
import type { CountryCode } from 'libphonenumber-js';
import { BadgeCheck, ChevronDown, Info, Mail, MessageCircle, Phone } from 'lucide-react';

import type { UserAccountVM } from '@iconicedu/shared-types';
import { Badge } from '@iconicedu/ui-web/ui/badge';
import { Button } from '@iconicedu/ui-web/ui/button';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@iconicedu/ui-web/ui/input-group';
import { Label } from '@iconicedu/ui-web/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@iconicedu/ui-web/ui/select';
import { Switch } from '@iconicedu/ui-web/ui/switch';
import { Tooltip, TooltipContent, TooltipTrigger } from '@iconicedu/ui-web/ui/tooltip';
import { UserSettingsTabSection } from '@iconicedu/ui-web/components/sidebar/user-settings/components/user-settings-tab-section';
import { Checkbox } from '@iconicedu/ui-web/ui/checkbox';
import { BorderBeam } from '@iconicedu/ui-web/ui/border-beam';
import { getPhoneValidationError } from '@iconicedu/ui-web/components/sidebar/user-settings/account-tab.utils';

const DIAL_COUNTRIES: Array<{ code: CountryCode; flag: string; label: string }> = [
  { code: 'LK', flag: '🇱🇰', label: 'Sri Lanka (+94)' },
  { code: 'IN', flag: '🇮🇳', label: 'India (+91)' },
  { code: 'AU', flag: '🇦🇺', label: 'Australia (+61)' },
  { code: 'GB', flag: '🇬🇧', label: 'United Kingdom (+44)' },
  { code: 'US', flag: '🇺🇸', label: 'United States (+1)' },
  { code: 'CA', flag: '🇨🇦', label: 'Canada (+1)' },
  { code: 'NZ', flag: '🇳🇿', label: 'New Zealand (+64)' },
  { code: 'SG', flag: '🇸🇬', label: 'Singapore (+65)' },
  { code: 'AE', flag: '🇦🇪', label: 'UAE (+971)' },
  { code: 'SA', flag: '🇸🇦', label: 'Saudi Arabia (+966)' },
  { code: 'PK', flag: '🇵🇰', label: 'Pakistan (+92)' },
  { code: 'BD', flag: '🇧🇩', label: 'Bangladesh (+880)' },
  { code: 'MY', flag: '🇲🇾', label: 'Malaysia (+60)' },
  { code: 'KE', flag: '🇰🇪', label: 'Kenya (+254)' },
  { code: 'NG', flag: '🇳🇬', label: 'Nigeria (+234)' },
  { code: 'ZA', flag: '🇿🇦', label: 'South Africa (+27)' },
  { code: 'FR', flag: '🇫🇷', label: 'France (+33)' },
  { code: 'DE', flag: '🇩🇪', label: 'Germany (+49)' },
  { code: 'TR', flag: '🇹🇷', label: 'Turkey (+90)' },
  { code: 'BR', flag: '🇧🇷', label: 'Brazil (+55)' },
  { code: 'JP', flag: '🇯🇵', label: 'Japan (+81)' },
  { code: 'CN', flag: '🇨🇳', label: 'China (+86)' },
  { code: 'PH', flag: '🇵🇭', label: 'Philippines (+63)' },
  { code: 'OM', flag: '🇴🇲', label: 'Oman (+968)' },
  { code: 'QA', flag: '🇶🇦', label: 'Qatar (+974)' },
];

const DEFAULT_COUNTRY: CountryCode = 'US';

function detectCountryFromE164(e164: string | null | undefined): CountryCode {
  if (!e164) return DEFAULT_COUNTRY;
  const parsed = parsePhoneNumberFromString(e164);
  const country = parsed?.country;
  if (country && DIAL_COUNTRIES.some((c) => c.code === country)) {
    return country as CountryCode;
  }
  return DEFAULT_COUNTRY;
}

function toNationalNumber(e164: string | null | undefined, country: CountryCode): string {
  if (!e164) return '';
  const parsed = parsePhoneNumberFromString(e164, country);
  return parsed ? parsed.formatNational() : e164;
}

export type AccountSectionKey = 'email' | 'phone' | 'whatsapp';

type AccountTabProps = {
  contacts?: UserAccountVM['contacts'] | null;
  email: string;
  preferredChannelSelections: string[];
  togglePreferredChannel: (channel: string, enabled: boolean) => void;
  scrollToRequired?: boolean;
  scrollToken?: number;
  accountId?: string;
  orgId?: string;
  onAccountUpdate?: (input: {
    accountId: string;
    orgId: string;
    phoneE164?: string | null;
    whatsappE164?: string | null;
    preferredContactChannels?: string[] | null;
  }) => Promise<void> | void;
  onboardingRequiredSection?: AccountSectionKey | null;
  lockSections?: boolean;
  isChildAccount?: boolean;
};

export function AccountTab({
  contacts,
  email,
  preferredChannelSelections,
  togglePreferredChannel,
  scrollToRequired = false,
  scrollToken = 0,
  accountId,
  orgId,
  onAccountUpdate,
  onboardingRequiredSection = null,
  lockSections = false,
  isChildAccount = false,
}: AccountTabProps) {
  const [phoneCountry, setPhoneCountry] = React.useState<CountryCode>(() =>
    detectCountryFromE164(contacts?.phoneE164),
  );
  const [phoneLocal, setPhoneLocal] = React.useState(() =>
    toNationalNumber(contacts?.phoneE164, detectCountryFromE164(contacts?.phoneE164)),
  );
  const [phoneError, setPhoneError] = React.useState<string | null>(null);
  const [whatsappCountry, setWhatsappCountry] = React.useState<CountryCode>(() =>
    detectCountryFromE164(contacts?.whatsappE164 ?? contacts?.phoneE164),
  );
  const [whatsappLocal, setWhatsappLocal] = React.useState(() => {
    const src = contacts?.whatsappE164 ?? contacts?.phoneE164 ?? '';
    const country = detectCountryFromE164(src || null);
    return toNationalNumber(src || null, country);
  });
  const [isWhatsappFocused, setIsWhatsappFocused] = React.useState(false);
  const [whatsappError, setWhatsappError] = React.useState<string | null>(null);
  const phoneInputRef = React.useRef<HTMLInputElement | null>(null);
  const formatLocal = React.useCallback((value: string, country: CountryCode) => {
    return new AsYouType(country).input(value);
  }, []);
  const [isPhoneSaving, setIsPhoneSaving] = React.useState(false);
  const [isWhatsappSaving, setIsWhatsappSaving] = React.useState(false);
  const [usePhoneForWhatsapp, setUsePhoneForWhatsapp] = React.useState(true);
  const emailError = !email.trim() ? 'Email is required.' : null;
  const emailVerified = Boolean(contacts?.emailVerified);
  const emailVerifiedAt = contacts?.emailVerifiedAt ?? null;
  const phoneValue = phoneLocal;
  const whatsappValue = whatsappLocal;
  const formattedPhoneFromContacts = contacts?.phoneE164
    ? toNationalNumber(contacts.phoneE164, phoneCountry)
    : '';
  const formattedWhatsappFromContacts = contacts?.whatsappE164
    ? toNationalNumber(contacts.whatsappE164, whatsappCountry)
    : '';
  const renderVerificationBadge = (isVerified: boolean, verifiedAt?: string | null) =>
    isVerified ? (
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
            <BadgeCheck className="h-3 w-3" />
            <span className="sr-only">Verified</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent>{verifiedAt ?? 'Verified'}</TooltipContent>
      </Tooltip>
    ) : (
      <Badge className="bg-muted text-muted-foreground">
        <BadgeCheck className="h-3 w-3 text-muted-foreground" />
        <span className="sr-only">Not verified</span>
      </Badge>
    );
  const phoneInputValue = phoneValue;
  const whatsappInputValue = whatsappValue;
  const phoneDisplay = formattedPhoneFromContacts || 'Not provided';
  const whatsappDisplay = formattedWhatsappFromContacts || 'Not provided';
  const shouldScrollToPhone = !phoneInputValue.trim();
  const isPhoneSaveDisabled = isPhoneSaving || !onAccountUpdate || !accountId || !orgId;
  const isWhatsappSaveDisabled =
    isWhatsappSaving || !onAccountUpdate || !accountId || !orgId || usePhoneForWhatsapp;
  const [showPhoneActionBeam, setShowPhoneActionBeam] = React.useState(false);
  const [emailOpen, setEmailOpen] = React.useState(false);
  React.useEffect(() => {
    if (!usePhoneForWhatsapp || !phoneInputValue.trim()) {
      return;
    }
    setWhatsappLocal(phoneInputValue);
    setWhatsappCountry(phoneCountry);
  }, [phoneInputValue, phoneCountry, usePhoneForWhatsapp]);
  const [whatsappOpen, setWhatsappOpen] = React.useState(false);
  const [emailInputValue, setEmailInputValue] = React.useState(email);
  const [, setIsEmailFocused] = React.useState(false);
  React.useEffect(() => {
    setEmailInputValue(email);
  }, [email]);

  const shouldLockSections = Boolean(lockSections && onboardingRequiredSection);
  const isEmailSectionActive = onboardingRequiredSection === 'email';
  const isPhoneSectionActive = onboardingRequiredSection === 'phone';
  const isWhatsappSectionActive = onboardingRequiredSection === 'whatsapp';
  const emailDisabled = shouldLockSections && !isEmailSectionActive;
  const phoneDisabled = shouldLockSections && !isPhoneSectionActive;
  const whatsappDisabled = shouldLockSections && !isWhatsappSectionActive;
  React.useEffect(() => {
    const country = detectCountryFromE164(contacts?.phoneE164);
    setPhoneCountry(country);
    setPhoneLocal(toNationalNumber(contacts?.phoneE164, country));
  }, [contacts?.phoneE164]);

  React.useEffect(() => {
    if (!scrollToRequired || !shouldScrollToPhone) {
      return;
    }
    if (phoneInputRef.current) {
      requestAnimationFrame(() => {
        phoneInputRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      });
    }
  }, [scrollToRequired, scrollToken, shouldScrollToPhone]);

  React.useEffect(() => {
    const contactWhatsapp = contacts?.whatsappE164 ?? '';
    const contactPhone = contacts?.phoneE164 ?? '';
    const shouldUsePhone = !contactWhatsapp || contactWhatsapp === contactPhone;
    setUsePhoneForWhatsapp((prev) => (prev === shouldUsePhone ? prev : shouldUsePhone));

    if (isWhatsappFocused) {
      return;
    }

    const src = shouldUsePhone ? contactPhone : contactWhatsapp;
    const country = detectCountryFromE164(src || null);
    setWhatsappCountry(country);
    setWhatsappLocal(toNationalNumber(src || null, country));
  }, [contacts?.phoneE164, contacts?.whatsappE164, isWhatsappFocused]);

  React.useEffect(() => {
    setShowPhoneActionBeam(
      Boolean(isPhoneSectionActive && phoneInputValue.trim() && !isPhoneSaving),
    );
  }, [isPhoneSaving, isPhoneSectionActive, phoneInputValue]);

  const handlePhoneSave = React.useCallback(async () => {
    if (!onAccountUpdate || !accountId || !orgId) {
      return;
    }
    const trimmedLocal = phoneInputValue.trim();
    const parsed = trimmedLocal
      ? parsePhoneNumberFromString(trimmedLocal, phoneCountry)
      : undefined;
    const composedForValidation = parsed?.number ?? trimmedLocal;
    const validationError = getPhoneValidationError(composedForValidation, {
      required: !isChildAccount,
    });
    if (validationError) {
      setPhoneError(validationError);
      return;
    }
    setIsPhoneSaving(true);
    setPhoneError(null);
    try {
      await onAccountUpdate({
        accountId,
        orgId,
        phoneE164: parsed?.number ?? null,
        ...(usePhoneForWhatsapp ? { whatsappE164: parsed?.number ?? null } : {}),
      });
    } finally {
      setIsPhoneSaving(false);
    }
  }, [
    accountId,
    orgId,
    onAccountUpdate,
    phoneInputValue,
    phoneCountry,
    usePhoneForWhatsapp,
    isChildAccount,
  ]);

  const handleWhatsappSave = React.useCallback(async () => {
    if (!onAccountUpdate || !accountId || !orgId) {
      return;
    }
    const trimmedLocal = whatsappInputValue.trim();
    const parsed = trimmedLocal
      ? parsePhoneNumberFromString(trimmedLocal, whatsappCountry)
      : undefined;
    if (trimmedLocal && !parsed?.isValid()) {
      setWhatsappError('Enter a valid number for the selected country.');
      return;
    }
    setIsWhatsappSaving(true);
    try {
      await onAccountUpdate({
        accountId,
        orgId,
        whatsappE164: parsed?.number ?? null,
      });
    } finally {
      setIsWhatsappSaving(false);
    }
  }, [accountId, orgId, onAccountUpdate, whatsappInputValue, whatsappCountry]);

  return (
    <div className="space-y-8 w-full">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <h3 className="text-base font-semibold">Account Settings</h3>
            <p className="text-sm text-muted-foreground">
              Manage email, password, and contact verification settings.
            </p>
          </div>
        </div>
        <div className="space-y-1 w-full">
          <UserSettingsTabSection
            icon={<Mail className="h-5 w-5" />}
            title="Email"
            subtitle={contacts?.email ?? 'Not provided'}
            open={emailOpen}
            onOpenChange={(open) => {
              if (emailDisabled) {
                return;
              }
              setEmailOpen(open);
            }}
            badgeIcon={renderVerificationBadge(emailVerified, emailVerifiedAt)}
            disabled={emailDisabled}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="settings-account-email">
                  <div className="flex items-center gap-1">
                    <span>
                      Email <span className="text-destructive">*</span>
                    </span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-muted-foreground transition hover:text-foreground">
                          <Info className="h-3 w-3" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent>
                        Contact support to change your email.
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </Label>
                <InputGroup>
                  <InputGroupInput
                    id="settings-account-email"
                    value={emailInputValue}
                    aria-label="Email"
                    required
                    readOnly
                    onFocus={() => setIsEmailFocused(true)}
                    onBlur={() => setIsEmailFocused(false)}
                    onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                      setEmailInputValue(event.target.value);
                    }}
                  />
                  <InputGroupAddon align="inline-end">
                    {renderVerificationBadge(emailVerified, emailVerifiedAt)}
                  </InputGroupAddon>
                </InputGroup>
                {emailError ? (
                  <p className="text-xs text-destructive">{emailError}</p>
                ) : null}
              </div>
              <div className="sm:col-span-2 flex items-center justify-between rounded-xl border border-border/60 px-4 py-3">
                <div>
                  <div className="text-sm font-medium">
                    Receive notifications by email
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Use this email for account alerts and reminders.
                  </div>
                </div>
                <Switch
                  checked={preferredChannelSelections.includes('email')}
                  onCheckedChange={(checked) => togglePreferredChannel('email', checked)}
                  aria-label="Receive notifications by email"
                />
              </div>
            </div>
          </UserSettingsTabSection>
        </div>
        <div className="space-y-1 w-full">
          <UserSettingsTabSection
            icon={<Phone className="h-5 w-5" />}
            title="Phone"
            subtitle={phoneDisplay}
            badgeIcon={renderVerificationBadge(
              Boolean(contacts?.phoneVerified),
              contacts?.phoneVerifiedAt,
            )}
            defaultOpen={isPhoneSectionActive}
            disabled={phoneDisabled}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="settings-account-phone">
                  <div className="flex items-center gap-1">
                    <span>
                      Phone <span className="text-destructive">*</span>
                    </span>
                  </div>
                </Label>
                <div className="relative rounded-full">
                  {isPhoneSectionActive && !phoneInputValue.trim() ? (
                    <BorderBeam
                      size={52}
                      initialOffset={8}
                      borderWidth={2}
                      className="from-transparent via-amber-700 to-transparent"
                      transition={{ type: 'spring', stiffness: 60, damping: 20 }}
                    />
                  ) : null}
                  <InputGroup>
                    <InputGroupAddon align="inline-start" className="pl-1 pr-0">
                      <Select
                        value={phoneCountry}
                        onValueChange={(v) => {
                          setPhoneCountry(v as CountryCode);
                          setPhoneLocal('');
                          if (phoneError) setPhoneError(null);
                          setTimeout(() => phoneInputRef.current?.focus(), 0);
                        }}
                      >
                        <SelectTrigger
                          className="h-7 gap-1 border-0 bg-transparent px-2 shadow-none focus:ring-0 text-sm font-medium"
                          aria-label="Country dial code"
                        >
                          <SelectValue>
                            <span className="flex items-center gap-1.5">
                              <span>
                                {
                                  DIAL_COUNTRIES.find((c) => c.code === phoneCountry)
                                    ?.flag
                                }
                              </span>
                              <span className="text-muted-foreground">
                                +{getCountryCallingCode(phoneCountry)}
                              </span>
                              <ChevronDown className="h-3 w-3 text-muted-foreground" />
                            </span>
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent className="max-h-64">
                          {DIAL_COUNTRIES.map((c) => (
                            <SelectItem key={c.code} value={c.code}>
                              <span className="flex items-center gap-2">
                                <span>{c.flag}</span>
                                <span>{c.label}</span>
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <span className="text-border mx-1 select-none">|</span>
                    </InputGroupAddon>
                    <InputGroupInput
                      id="settings-account-phone"
                      value={phoneInputValue}
                      ref={phoneInputRef}
                      aria-label="Phone"
                      required
                      placeholder="71 234 5678"
                      onBlur={() => {
                        const formatted = formatLocal(phoneInputValue, phoneCountry);
                        if (formatted) setPhoneLocal(formatted);
                        const parsed = phoneInputValue.trim()
                          ? parsePhoneNumberFromString(phoneInputValue, phoneCountry)
                          : undefined;
                        const validationError = getPhoneValidationError(
                          parsed?.number ?? phoneInputValue,
                          { required: !isChildAccount },
                        );
                        setPhoneError(validationError);
                      }}
                      onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                        setPhoneLocal(formatLocal(event.target.value, phoneCountry));
                        if (phoneError) setPhoneError(null);
                      }}
                    />
                    <InputGroupAddon align="inline-end">
                      {renderVerificationBadge(
                        Boolean(contacts?.phoneVerified),
                        contacts?.phoneVerifiedAt,
                      )}
                    </InputGroupAddon>
                  </InputGroup>
                </div>
                <div className="text-xs text-muted-foreground">
                  We&apos;ll send a verification code by text.
                </div>
                {phoneError ? (
                  <div className="text-xs text-destructive">{phoneError}</div>
                ) : null}
              </div>
              {contacts?.phoneVerified ? (
                <div className="sm:col-span-2 flex items-center justify-between rounded-xl border border-border/60 px-4 py-3">
                  <div>
                    <div className="text-sm font-medium">
                      Receive notifications by phone
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Use SMS for alerts and reminders.
                    </div>
                  </div>
                  <Switch
                    checked={preferredChannelSelections.includes('sms')}
                    onCheckedChange={(checked) => togglePreferredChannel('sms', checked)}
                    aria-label="Receive notifications by phone"
                  />
                </div>
              ) : null}
              <div className="sm:col-span-2 flex justify-end">
                <div className="relative inline-flex rounded-full">
                  {showPhoneActionBeam ? (
                    <BorderBeam
                      size={26}
                      initialOffset={8}
                      borderWidth={2}
                      className="from-transparent via-amber-700 to-transparent"
                      transition={{ type: 'spring', stiffness: 60, damping: 20 }}
                    />
                  ) : null}
                  <Button
                    size="sm"
                    className="relative"
                    onClick={handlePhoneSave}
                    disabled={isPhoneSaveDisabled}
                  >
                    {isPhoneSaving ? 'Saving...' : 'Save'}
                  </Button>
                </div>
              </div>
            </div>
          </UserSettingsTabSection>
        </div>
        <div className="space-y-1 w-full">
          <UserSettingsTabSection
            icon={<MessageCircle className="h-5 w-5" />}
            title="WhatsApp"
            subtitle={whatsappDisplay}
            open={whatsappOpen}
            onOpenChange={(open) => {
              if (whatsappDisabled) {
                return;
              }
              setWhatsappOpen(open);
            }}
            badgeIcon={renderVerificationBadge(
              Boolean(contacts?.whatsappVerified),
              contacts?.whatsappVerifiedAt,
            )}
            showSeparator={false}
            disabled={whatsappDisabled}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="settings-account-whatsapp">WhatsApp</Label>
                <div className="relative rounded-full">
                  <InputGroup>
                    <InputGroupAddon align="inline-start" className="pl-1 pr-0">
                      <Select
                        value={whatsappCountry}
                        onValueChange={(v) => {
                          if (usePhoneForWhatsapp) return;
                          setWhatsappCountry(v as CountryCode);
                          setWhatsappLocal('');
                          if (whatsappError) setWhatsappError(null);
                        }}
                      >
                        <SelectTrigger
                          className="h-7 gap-1 border-0 bg-transparent px-2 shadow-none focus:ring-0 text-sm font-medium"
                          aria-label="Country dial code"
                          disabled={usePhoneForWhatsapp}
                        >
                          <SelectValue>
                            <span className="flex items-center gap-1.5">
                              <span>
                                {
                                  DIAL_COUNTRIES.find((c) => c.code === whatsappCountry)
                                    ?.flag
                                }
                              </span>
                              <span className="text-muted-foreground">
                                +{getCountryCallingCode(whatsappCountry)}
                              </span>
                              <ChevronDown className="h-3 w-3 text-muted-foreground" />
                            </span>
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent className="max-h-64">
                          {DIAL_COUNTRIES.map((c) => (
                            <SelectItem key={c.code} value={c.code}>
                              <span className="flex items-center gap-2">
                                <span>{c.flag}</span>
                                <span>{c.label}</span>
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <span className="text-border mx-1 select-none">|</span>
                    </InputGroupAddon>
                    <InputGroupInput
                      id="settings-account-whatsapp"
                      value={whatsappInputValue}
                      aria-label="WhatsApp"
                      required={false}
                      placeholder="71 234 5678"
                      disabled={usePhoneForWhatsapp}
                      onFocus={() => setIsWhatsappFocused(true)}
                      onBlur={() => {
                        setIsWhatsappFocused(false);
                        const formatted = formatLocal(
                          whatsappInputValue,
                          whatsappCountry,
                        );
                        if (formatted) setWhatsappLocal(formatted);
                      }}
                      onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                        if (usePhoneForWhatsapp) return;
                        setWhatsappLocal(
                          formatLocal(event.target.value, whatsappCountry),
                        );
                        if (whatsappError) setWhatsappError(null);
                      }}
                    />
                    <InputGroupAddon align="inline-end">
                      {renderVerificationBadge(
                        Boolean(contacts?.whatsappVerified),
                        contacts?.whatsappVerifiedAt,
                      )}
                    </InputGroupAddon>
                  </InputGroup>
                  <div className="text-xs text-muted-foreground">
                    We&apos;ll send a verification code by WhatsApp.
                  </div>
                  {whatsappError ? (
                    <div className="text-xs text-destructive">{whatsappError}</div>
                  ) : null}
                </div>
              </div>
              {contacts?.whatsappVerified ? (
                <div className="sm:col-span-2 flex items-center justify-between rounded-xl border border-border/60 px-4 py-3">
                  <div>
                    <div className="text-sm font-medium">
                      Receive notifications by WhatsApp
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Use WhatsApp for alerts and reminders.
                    </div>
                  </div>
                  <Switch
                    checked={preferredChannelSelections.includes('whatsapp')}
                    onCheckedChange={(checked) =>
                      togglePreferredChannel('whatsapp', checked)
                    }
                    aria-label="Receive notifications by WhatsApp"
                  />
                </div>
              ) : null}
              <div className="sm:col-span-2 flex items-center justify-between gap-2">
                <label
                  className="flex items-center gap-2 text-sm text-muted-foreground"
                  htmlFor="use-phone-for-whatsapp"
                >
                  <Checkbox
                    id="use-phone-for-whatsapp"
                    checked={usePhoneForWhatsapp}
                    onCheckedChange={(checked) =>
                      setUsePhoneForWhatsapp(Boolean(checked))
                    }
                  />
                  Use phone number
                </label>
                <Button
                  size="sm"
                  onClick={handleWhatsappSave}
                  disabled={isWhatsappSaveDisabled}
                >
                  {isWhatsappSaving ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </div>
          </UserSettingsTabSection>
        </div>
      </div>
    </div>
  );
}
