import * as React from 'react';
import {
  ArrowRight,
  Check,
  ChevronRight,
  Clock,
  Globe,
  Languages,
  Palette,
  X,
} from 'lucide-react';

import { getAllTimezones } from 'countries-and-timezones';
import type { ThemeKey, UserProfileVM } from '@iconicedu/shared-types';
import { Button } from '@iconicedu/ui-web/ui/button';
import { Input } from '@iconicedu/ui-web/ui/input';
import { Label } from '@iconicedu/ui-web/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@iconicedu/ui-web/ui/select';
import { UserSettingsTabSection } from '@iconicedu/ui-web/components/sidebar/user-settings/components/user-settings-tab-section';
import {
  languageOptions,
  localeOptions,
  SOFT_ACCENT_PICK_BUTTON_CLASSNAME,
} from '@iconicedu/ui-web/components/sidebar/user-settings/constants';
import { useSequentialHighlight } from '@iconicedu/ui-web/components/sidebar/user-settings/hooks/use-sequential-highlight';
import { BorderBeam } from '@iconicedu/ui-web/ui/border-beam';

const DEFAULT_TIMEZONE = 'UTC';
const normalizeTimezone = (value?: string | null) => {
  const next = value?.trim() ?? '';
  return next === DEFAULT_TIMEZONE ? '' : next;
};

type TimezoneOption = {
  name: string;
  countryCode: string | null;
};

const countryCodeToEmoji = (code?: string | null) => {
  if (!code) {
    return null;
  }
  return code
    .toUpperCase()
    .split('')
    .map((char) => String.fromCodePoint(char.charCodeAt(0) + 127397))
    .join('');
};

export type PreferencesSectionKey = 'accent' | 'timezone' | 'locale' | 'languages';

type PreferencesTabProps = {
  currentThemeKey: ThemeKey;
  currentThemeLabel: string;
  profileId: string;
  orgId: string;
  prefs: UserProfileVM['prefs'];
  profileThemeOptions: Array<{ value: string; label: string }>;
  setProfileThemes: React.Dispatch<React.SetStateAction<Record<string, ThemeKey>>>;
  scrollToRequired?: boolean;
  scrollToken?: number;
  onPrefsSave?: (input: {
    profileId: string;
    orgId: string;
    timezone?: string;
    locale?: string | null;
    languagesSpoken?: string[] | null;
    themeKey?: string | null;
  }) => Promise<void> | void;
  onboardingRequiredSection?: PreferencesSectionKey | null;
  lockSections?: boolean;
};

export function PreferencesTab({
  currentThemeKey,
  currentThemeLabel,
  profileId,
  orgId,
  prefs,
  profileThemeOptions,
  setProfileThemes,
  scrollToRequired = false,
  scrollToken = 0,
  onPrefsSave,
  onboardingRequiredSection = null,
  lockSections = false,
}: PreferencesTabProps) {
  const timezoneOptions = React.useMemo<TimezoneOption[]>(() => {
    const options = Object.values(getAllTimezones()).reduce<TimezoneOption[]>(
      (acc, timezone) => {
        if (!timezone.name) {
          return acc;
        }
        acc.push({
          name: timezone.name,
          countryCode: timezone.countries?.[0] ?? null,
        });
        return acc;
      },
      [],
    );
    return options.sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
    );
  }, []);

  const browserTimezone = React.useMemo(() => {
    if (typeof Intl === 'undefined' || typeof Intl.DateTimeFormat !== 'function') {
      return null;
    }
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
  }, []);

  const [timezoneValue, setTimezoneValue] = React.useState(() => {
    const prefValue = normalizeTimezone(prefs.timezone);
    if (prefValue) {
      return prefValue;
    }
    const browserValue = normalizeTimezone(browserTimezone);
    return browserValue;
  });
  const [isSaving, setIsSaving] = React.useState(false);
  const timezoneInputRef = React.useRef<HTMLDivElement | null>(null);
  const [localeValue, setLocaleValue] = React.useState(prefs.locale ?? '');
  const [languageValue, setLanguageValue] = React.useState<string[]>(
    prefs.languagesSpoken ?? [],
  );
  const [isThemeSaving, setIsThemeSaving] = React.useState(false);
  const [isLocaleSaving, setIsLocaleSaving] = React.useState(false);
  const [isLanguagesSaving, setIsLanguagesSaving] = React.useState(false);
  const sequentialTimezoneHighlight = useSequentialHighlight<'timezone'>({
    order: ['timezone'],
    satisfied: {
      timezone: Boolean(
        timezoneValue.trim() && timezoneValue.trim() !== DEFAULT_TIMEZONE,
      ),
    },
    enabled: Boolean(onboardingRequiredSection === 'timezone'),
  });
  const showTimezoneFieldBeam = sequentialTimezoneHighlight.isActive('timezone');

  React.useEffect(() => {
    const prefValue = normalizeTimezone(prefs.timezone);
    if (prefValue) {
      setTimezoneValue(prefValue);
      return;
    }

    const browserValue = normalizeTimezone(browserTimezone);
    if (browserValue && timezoneOptions.some((option) => option.name === browserValue)) {
      setTimezoneValue(browserValue);
      return;
    }

    setTimezoneValue('');
  }, [browserTimezone, prefs.timezone, timezoneOptions]);

  React.useEffect(() => {
    setLocaleValue(prefs.locale ?? '');
    setLanguageValue(prefs.languagesSpoken ?? []);
  }, [prefs.locale, prefs.languagesSpoken]);

  const shouldLockSections = Boolean(lockSections && onboardingRequiredSection);
  const isAccentSectionActive = onboardingRequiredSection === 'accent';
  const isTimezoneSectionActive = onboardingRequiredSection === 'timezone';
  const isLocaleSectionActive = onboardingRequiredSection === 'locale';
  const isLanguagesSectionActive = onboardingRequiredSection === 'languages';
  const timezoneValueTrimmed = timezoneValue.trim();
  const isTimezoneDefaultOrMissing =
    !timezoneValueTrimmed || timezoneValueTrimmed === DEFAULT_TIMEZONE;
  const isTimezoneRequiredMissing = isTimezoneDefaultOrMissing;
  const isTimezoneOnboarding = onboardingRequiredSection === 'timezone';
  const showTimezoneInputBeam = isTimezoneRequiredMissing && isTimezoneOnboarding;
  const showPickTimezoneBeam =
    Boolean(browserTimezone && isTimezoneRequiredMissing) && isTimezoneOnboarding;
  const showSaveBeam =
    Boolean(!isTimezoneRequiredMissing && !isSaving) && isTimezoneOnboarding;

  React.useEffect(() => {
    if (!scrollToRequired || !isTimezoneRequiredMissing) {
      return;
    }
    if (timezoneInputRef.current) {
      requestAnimationFrame(() => {
        timezoneInputRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      });
    }
  }, [scrollToRequired, scrollToken, isTimezoneRequiredMissing]);
  const handleThemeSave = React.useCallback(async () => {
    if (!onPrefsSave) {
      return;
    }
    setIsThemeSaving(true);
    try {
      await onPrefsSave({
        profileId,
        orgId,
        themeKey: currentThemeKey,
      });
    } finally {
      setIsThemeSaving(false);
    }
  }, [currentThemeKey, onPrefsSave, profileId, orgId]);

  const handleTimezoneSave = React.useCallback(async () => {
    if (!onPrefsSave) {
      return;
    }
    const trimmed = timezoneValue.trim();
    setIsSaving(true);
    try {
      await onPrefsSave({
        profileId,
        orgId,
        timezone: trimmed && trimmed !== DEFAULT_TIMEZONE ? trimmed : undefined,
      });
    } finally {
      setIsSaving(false);
    }
  }, [onPrefsSave, profileId, orgId, timezoneValue]);

  const handleLocaleSave = React.useCallback(async () => {
    if (!onPrefsSave) {
      return;
    }
    setIsLocaleSaving(true);
    try {
      const trimmed = localeValue.trim();
      await onPrefsSave({
        profileId,
        orgId,
        locale: trimmed || null,
      });
    } finally {
      setIsLocaleSaving(false);
    }
  }, [localeValue, onPrefsSave, profileId, orgId]);

  const handleLanguagesSave = React.useCallback(async () => {
    if (!onPrefsSave) {
      return;
    }
    setIsLanguagesSaving(true);
    try {
      await onPrefsSave({
        profileId,
        orgId,
        languagesSpoken: languageValue.length ? languageValue : null,
      });
    } finally {
      setIsLanguagesSaving(false);
    }
  }, [languageValue, onPrefsSave, profileId, orgId]);

  return (
    <div className="space-y-8 w-full">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <h3 className="text-base font-semibold">Preferences</h3>
            <p className="text-sm text-muted-foreground">
              Update your locale, language, and appearance settings.
            </p>
          </div>
        </div>
        <div className="space-y-1 w-full">
          <UserSettingsTabSection
            icon={<Palette className="h-5 w-5" />}
            title="Accent color"
            subtitle={currentThemeLabel}
            defaultOpen={isAccentSectionActive}
            disabled={shouldLockSections && !isAccentSectionActive}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label>Accent color</Label>
                <Select
                  value={currentThemeKey}
                  onValueChange={(value) =>
                    setProfileThemes((prev) => ({
                      ...prev,
                      [profileId]: value as ThemeKey,
                    }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select color" />
                  </SelectTrigger>
                  <SelectContent>
                    {profileThemeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        <span className={`flex items-center gap-2 theme-${option.value}`}>
                          <span className="theme-swatch h-3.5 w-3.5 rounded-full" />
                          {option.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2 flex justify-end">
                <Button
                  size="sm"
                  onClick={handleThemeSave}
                  disabled={!onPrefsSave || isThemeSaving}
                >
                  {isThemeSaving ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </div>
          </UserSettingsTabSection>
        </div>
        <div className="space-y-1 w-full">
          <UserSettingsTabSection
            icon={<Clock className="h-5 w-5" />}
            title="Timezone"
            subtitle={prefs.timezone}
            defaultOpen={isTimezoneSectionActive}
            disabled={shouldLockSections && !isTimezoneSectionActive}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="settings-timezone">
                  <div className="flex items-center gap-1">
                    <span>
                      Timezone <span className="text-destructive">*</span>
                    </span>
                  </div>
                </Label>
                <div className="relative rounded-full" ref={timezoneInputRef}>
                  {showTimezoneFieldBeam && !timezoneValue.trim() ? (
                    <BorderBeam
                      size={52}
                      initialOffset={8}
                      borderWidth={2}
                      className="from-transparent via-amber-700 to-transparent"
                      transition={{ type: 'spring', stiffness: 60, damping: 20 }}
                    />
                  ) : null}
                  {showTimezoneInputBeam && !timezoneValue.trim() ? (
                    <BorderBeam
                      size={52}
                      initialOffset={8}
                      borderWidth={2}
                      className="from-transparent via-amber-700 to-transparent"
                      transition={{ type: 'spring', stiffness: 60, damping: 20 }}
                    />
                  ) : null}
                  {isTimezoneSectionActive && !timezoneValue.trim() ? (
                    <BorderBeam
                      size={52}
                      initialOffset={8}
                      borderWidth={2}
                      className="from-transparent via-amber-700 to-transparent"
                      transition={{ type: 'spring', stiffness: 60, damping: 20 }}
                    />
                  ) : null}
                  <Select
                    value={timezoneValue}
                    onValueChange={(value) => setTimezoneValue(value)}
                  >
                    <SelectTrigger id="settings-timezone" className="w-full">
                      <SelectValue placeholder="Select timezone" />
                    </SelectTrigger>
                    <SelectContent className="max-h-72 overflow-y-auto">
                      {timezoneOptions.map((timezone) => {
                        const flag = countryCodeToEmoji(timezone.countryCode);
                        return (
                          <SelectItem key={timezone.name} value={timezone.name}>
                            <div className="flex items-center justify-between gap-2">
                              <span className="break-words">{timezone.name}</span>
                              {flag ? (
                                <span className="text-sm opacity-80">{flag}</span>
                              ) : null}
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                {isTimezoneRequiredMissing ? (
                  <p className="text-xs text-destructive">Timezone is required.</p>
                ) : null}
              </div>
              <div className="sm:col-span-2 flex items-center justify-between">
                <div className="relative inline-flex rounded-full">
                  {showPickTimezoneBeam ? (
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
                    variant="outline"
                    onClick={() => {
                      if (browserTimezone) {
                        setTimezoneValue(browserTimezone);
                      }
                    }}
                    disabled={!browserTimezone}
                    className={SOFT_ACCENT_PICK_BUTTON_CLASSNAME}
                  >
                    Pick timezone for me
                  </Button>
                </div>
                <div className="relative inline-flex rounded-full">
                  {showSaveBeam ? (
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
                    className="relative z-10"
                    onClick={handleTimezoneSave}
                    disabled={isSaving || isTimezoneRequiredMissing}
                  >
                    {isSaving ? 'Saving...' : 'Save'}
                  </Button>
                </div>
              </div>
            </div>
          </UserSettingsTabSection>
        </div>
        <div className="space-y-1 w-full">
          <UserSettingsTabSection
            icon={<Globe className="h-5 w-5" />}
            title="Locale"
            subtitle={prefs.locale ?? 'Auto'}
            defaultOpen={isLocaleSectionActive}
            disabled={shouldLockSections && !isLocaleSectionActive}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="settings-locale">Locale</Label>
                <Select
                  value={localeValue}
                  onValueChange={(value) => setLocaleValue(value)}
                >
                  <SelectTrigger id="settings-locale" className="w-full">
                    <SelectValue placeholder="Select locale" />
                  </SelectTrigger>
                  <SelectContent>
                    {localeOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2 flex justify-end">
                <Button
                  size="sm"
                  onClick={handleLocaleSave}
                  disabled={!onPrefsSave || isLocaleSaving}
                >
                  {isLocaleSaving ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </div>
          </UserSettingsTabSection>
        </div>
        <div className="space-y-1 w-full">
          <UserSettingsTabSection
            icon={<Languages className="h-5 w-5" />}
            title="Languages spoken"
            subtitle={languageValue.length ? languageValue.join(', ') : 'Not set'}
            defaultOpen={isLanguagesSectionActive}
            disabled={shouldLockSections && !isLanguagesSectionActive}
            showSeparator={false}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-3 sm:col-span-2">
                <Label htmlFor="settings-languages">Languages spoken</Label>
                <div className="flex flex-wrap gap-2">
                  {languageValue.map((value) => {
                    const option = languageOptions.find((entry) => entry.value === value);
                    return (
                      <span
                        key={value}
                        className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium"
                      >
                        {option?.label ?? value}
                        <button
                          type="button"
                          onClick={() =>
                            setLanguageValue((prev) =>
                              prev.filter((entry) => entry !== value),
                            )
                          }
                          aria-label={`Remove ${option?.label ?? value}`}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    );
                  })}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {languageOptions.map((option) => {
                    const isSelected = languageValue.includes(option.value);
                    return (
                      <button
                        type="button"
                        key={option.value}
                        onClick={() => {
                          setLanguageValue((prev) =>
                            prev.includes(option.value)
                              ? prev.filter((entry) => entry !== option.value)
                              : [...prev, option.value],
                          );
                        }}
                        className={`flex items-center justify-between rounded-xl border px-3 py-2 text-sm transition ${
                          isSelected
                            ? 'border-primary bg-primary/5 text-primary'
                            : 'border-border hover:border-foreground/60'
                        }`}
                      >
                        <span>{option.label}</span>
                        {isSelected ? <Check className="h-4 w-4" /> : null}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="sm:col-span-2 flex justify-end">
                <Button
                  size="sm"
                  onClick={handleLanguagesSave}
                  disabled={!onPrefsSave || isLanguagesSaving}
                >
                  {isLanguagesSaving ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </div>
          </UserSettingsTabSection>
        </div>
      </div>
    </div>
  );
}
