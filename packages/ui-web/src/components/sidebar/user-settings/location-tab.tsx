'use client';

import * as React from 'react';
import { MapPin } from 'lucide-react';
import { reportObservedError } from '@iconicedu/utils';

import { Country, State } from 'country-state-city';
import type { UserProfileVM } from '@iconicedu/shared-types';
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
  postalExamples,
  SOFT_ACCENT_PICK_BUTTON_CLASSNAME,
} from '@iconicedu/ui-web/components/sidebar/user-settings/constants';
import { BorderBeam } from '@iconicedu/ui-web/ui/border-beam';
import { useSequentialHighlight } from '@iconicedu/ui-web/components/sidebar/user-settings/hooks/use-sequential-highlight';
import {
  isLocationComplete,
  normalizeReverseGeocodeAddress,
} from '@iconicedu/ui-web/components/sidebar/user-settings/location-tab.utils';

type LocationRequiredField = 'city' | 'region' | 'postal';
const LOCATION_REQUIRED_FIELDS: LocationRequiredField[] = ['city', 'region', 'postal'];

type LocationTabProps = {
  location?: UserProfileVM['location'] | null;
  expandLocation?: boolean;
  scrollToRequired?: boolean;
  scrollToken?: number;
  onLocationContinue?: (input: {
    city: string;
    region: string;
    postalCode: string;
    countryCode?: string | null;
    countryName?: string | null;
    streetAddress?: string | null;
  }) => Promise<void> | void;
};

export function LocationTab({
  location,
  expandLocation = false,
  scrollToRequired = false,
  scrollToken = 0,
  onLocationContinue,
}: LocationTabProps) {
  const [cityValue, setCityValue] = React.useState(location?.city ?? '');
  const [regionValue, setRegionValue] = React.useState(location?.region ?? '');
  const [postalValue, setPostalValue] = React.useState(location?.postalCode ?? '');
  const [streetValue, setStreetValue] = React.useState(location?.streetAddress ?? '');
  const [, setIsCityFocused] = React.useState(false);
  const [, setIsRegionFocused] = React.useState(false);
  const [, setIsPostalFocused] = React.useState(false);
  const [isCountryFocused, setIsCountryFocused] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isPickingLocation, setIsPickingLocation] = React.useState(false);
  const [locationError, setLocationError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<{
    city?: string | null;
    region?: string | null;
    postalCode?: string | null;
    country?: string | null;
  }>({});
  const cityInputRef = React.useRef<HTMLInputElement | null>(null);
  const regionInputRef = React.useRef<HTMLInputElement | null>(null);
  const postalInputRef = React.useRef<HTMLInputElement | null>(null);
  const countryFieldRef = React.useRef<HTMLDivElement | null>(null);

  const countries = React.useMemo(() => {
    return Country.getAllCountries()
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
  }, []);
  const [countryValue, setCountryValue] = React.useState(() => {
    if (location?.countryCode) {
      return location.countryCode;
    }
    return 'US';
  });
  const isLocationRequiredMissing =
    !countryValue || !cityValue.trim() || !regionValue.trim() || !postalValue.trim();
  const sequentialHighlight = useSequentialHighlight<LocationRequiredField>({
    order: LOCATION_REQUIRED_FIELDS,
    satisfied: {
      city: Boolean(cityValue.trim()),
      region: Boolean(regionValue.trim()),
      postal: Boolean(postalValue.trim()),
    },
    enabled: expandLocation,
  });
  const showCityBeam = sequentialHighlight.isActive('city');
  const showRegionBeam = sequentialHighlight.isActive('region');
  const showPostalBeam = sequentialHighlight.isActive('postal');
  const selectedCountry = React.useMemo(() => {
    return (
      countries.find((entry) => entry.isoCode === countryValue) ?? countries[0] ?? null
    );
  }, [countries, countryValue]);
  const stateOptions = React.useMemo(() => {
    if (!countryValue) {
      return [];
    }
    return State.getStatesOfCountry(countryValue).sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
    );
  }, [countryValue]);
  const postalPlaceholder =
    postalExamples[selectedCountry?.isoCode ?? ''] ?? 'Postal code';

  const showPickLocationBeam =
    expandLocation && isLocationRequiredMissing && !isPickingLocation;
  const showContinueBeam = expandLocation && !isLocationRequiredMissing && !isSaving;

  React.useEffect(() => {
    setCityValue(location?.city ?? '');
    setRegionValue(location?.region ?? '');
    setPostalValue(location?.postalCode ?? '');
    setStreetValue(location?.streetAddress ?? '');
    setCountryValue(
      location?.countryCode ??
        countries.find((entry) => entry.name === location?.countryName)?.isoCode ??
        'US',
    );
  }, [
    countries,
    location?.city,
    location?.countryCode,
    location?.countryName,
    location?.postalCode,
    location?.region,
    location?.streetAddress,
  ]);

  React.useEffect(() => {
    if (!scrollToRequired) {
      return;
    }
    const target = !countryValue.trim()
      ? countryFieldRef.current
      : !cityValue.trim()
        ? cityInputRef.current
        : !regionValue.trim()
          ? regionInputRef.current
          : !postalValue.trim()
            ? postalInputRef.current
            : cityInputRef.current;
    if (target) {
      requestAnimationFrame(() => {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }
  }, [cityValue, countryValue, postalValue, regionValue, scrollToRequired, scrollToken]);

  const handleCountryChange = React.useCallback((value: string) => {
    setCountryValue(value);
    setRegionValue('');
    setFieldErrors((prev) => ({ ...prev, country: null }));
  }, []);

  const handlePickLocation = React.useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setLocationError('Geolocation is not supported in this browser.');
      return;
    }
    setLocationError(null);
    setIsPickingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${position.coords.latitude}&lon=${position.coords.longitude}`,
          );
          if (!response.ok) {
            throw new Error('Unable to determine your location.');
          }
          const data = (await response.json()) as { address?: Record<string, string> };
          const normalized = normalizeReverseGeocodeAddress(
            data.address ?? {},
            countries,
          );

          if (normalized.countryCode) {
            const match = countries.find(
              (entry) => entry.isoCode === normalized.countryCode,
            );
            setCountryValue(match?.isoCode ?? normalized.countryCode);
          }
          setCityValue(normalized.city);
          setRegionValue(normalized.region);
          setPostalValue(normalized.postalCode);
          setStreetValue((current) => current || normalized.streetAddress || '');
          setFieldErrors({});

          if (
            onLocationContinue &&
            isLocationComplete({
              countryCode: normalized.countryCode,
              city: normalized.city,
              region: normalized.region,
              postalCode: normalized.postalCode,
            })
          ) {
            setIsSaving(true);
            await onLocationContinue({
              city: normalized.city,
              region: normalized.region,
              postalCode: normalized.postalCode,
              countryCode: normalized.countryCode,
              countryName: normalized.countryName,
              streetAddress: normalized.streetAddress ?? undefined,
            });
            setLocationError(null);
          } else if (onLocationContinue) {
            setLocationError(
              'Location found. Please complete any missing fields, then click Save.',
            );
          }
        } catch (error) {
          reportObservedError({
            error,
            source: 'web.user_settings.location.reverse_geocode',
            message: 'Failed to reverse geocode the selected location',
          });
          setLocationError('Unable to determine your location.');
        } finally {
          setIsSaving(false);
          setIsPickingLocation(false);
        }
      },
      (error) => {
        setIsPickingLocation(false);
        setLocationError(error.message ?? 'Unable to read your location.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  }, [countries, onLocationContinue]);

  const handleLocationContinue = React.useCallback(async () => {
    if (!onLocationContinue) {
      return;
    }
    const city = cityValue.trim();
    const region = regionValue.trim();
    const postalCode = postalValue.trim();
    const countryName = selectedCountry?.name ?? '';
    const streetAddress = streetValue.trim();
    const nextErrors = {
      city: city ? null : 'City is required.',
      region: region ? null : 'State is required.',
      postalCode: postalCode ? null : 'Zip is required.',
      country: countryValue ? null : 'Country is required.',
    };
    const hasErrors = Object.values(nextErrors).some((value) => value);
    if (hasErrors) {
      setFieldErrors(nextErrors);
      return;
    }
    setFieldErrors({});
    setIsSaving(true);
    try {
      await onLocationContinue({
        city,
        region,
        postalCode,
        countryCode: countryValue,
        countryName,
        streetAddress: streetAddress || undefined,
      });
    } finally {
      setIsSaving(false);
    }
  }, [
    countryValue,
    onLocationContinue,
    postalValue,
    regionValue,
    selectedCountry,
    streetValue,
    cityValue,
  ]);

  const showStateSelect = stateOptions.length > 0;

  return (
    <div className="space-y-8 w-full">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <h3 className="text-base font-semibold">Location</h3>
            <p className="text-sm text-muted-foreground">
              Manage your country, region, and local address details.
            </p>
          </div>
        </div>
        <div className="space-y-1 w-full">
          <UserSettingsTabSection
            icon={<MapPin className="h-5 w-5" />}
            title="Address"
            subtitle={`${
              location?.city ?? 'City'
            }, ${location?.region ?? 'State'} ${location?.postalCode ?? 'Zip'} • ${
              location?.countryName ?? selectedCountry?.name ?? 'Country'
            }`}
            open={expandLocation || undefined}
            showSeparator={false}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2" ref={countryFieldRef}>
                <Label htmlFor="settings-country">
                  Country <span className="text-destructive">*</span>
                </Label>
                <div className="relative rounded-full border border-border/60">
                  {!countryValue && !isCountryFocused ? (
                    <span className="pointer-events-none absolute inset-0 rounded-full border-2 border-destructive/40" />
                  ) : null}
                  <Select
                    value={countryValue}
                    onValueChange={handleCountryChange}
                    onOpenChange={(open) => setIsCountryFocused(open)}
                  >
                    <SelectTrigger id="settings-country" className="w-full">
                      <SelectValue placeholder="Select country" />
                    </SelectTrigger>
                    <SelectContent className="max-h-72 overflow-y-auto">
                      {countries.map((country) => (
                        <SelectItem key={country.isoCode} value={country.isoCode}>
                          <span className="flex items-center justify-between gap-2">
                            <span className="truncate">{country.name}</span>
                            <span>{country.flag}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {fieldErrors.country ? (
                  <p className="text-xs text-destructive">{fieldErrors.country}</p>
                ) : null}
              </div>

              <div className="space-y-2 sm:col-span-2">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="settings-street">Street address</Label>
                  <span className="text-xs text-muted-foreground">Optional</span>
                </div>
                <Input
                  id="settings-street"
                  value={streetValue}
                  onChange={(event) => setStreetValue(event.target.value)}
                  placeholder="123 Example St"
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="settings-city">
                  City <span className="text-destructive">*</span>
                </Label>
                <div className="relative rounded-full border border-border/60">
                  {showCityBeam && !cityValue.trim() ? (
                    <BorderBeam
                      size={52}
                      initialOffset={8}
                      borderWidth={2}
                      className="from-transparent via-amber-700 to-transparent"
                      transition={{ type: 'spring', stiffness: 60, damping: 20 }}
                    />
                  ) : null}
                  <Input
                    id="settings-city"
                    value={cityValue}
                    ref={cityInputRef}
                    required
                    placeholder="City"
                    onFocus={() => setIsCityFocused(true)}
                    onBlur={() => setIsCityFocused(false)}
                    onChange={(event) => {
                      setCityValue(event.target.value);
                      if (event.target.value.trim()) {
                        setFieldErrors((prev) => ({ ...prev, city: null }));
                      }
                    }}
                  />
                </div>
                {fieldErrors.city ? (
                  <p className="text-xs text-destructive">{fieldErrors.city}</p>
                ) : null}
              </div>

              <div className="space-y-2 sm:col-span-1">
                <Label htmlFor="settings-region">
                  State <span className="text-destructive">*</span>
                </Label>
                <div className="relative rounded-full border border-border/60">
                  {showRegionBeam && !regionValue.trim() ? (
                    <BorderBeam
                      size={52}
                      initialOffset={8}
                      borderWidth={2}
                      className="from-transparent via-amber-700 to-transparent"
                      transition={{ type: 'spring', stiffness: 60, damping: 20 }}
                    />
                  ) : null}
                  {showStateSelect ? (
                    <Select
                      value={regionValue}
                      onValueChange={(value) => {
                        setRegionValue(value);
                        if (value.trim()) {
                          setFieldErrors((prev) => ({ ...prev, region: null }));
                        }
                      }}
                      onOpenChange={(open) => setIsRegionFocused(open)}
                    >
                      <SelectTrigger id="settings-region" className="w-full">
                        <SelectValue placeholder="Select state / province" />
                      </SelectTrigger>
                      <SelectContent className="max-h-72 overflow-y-auto">
                        {stateOptions.map((state) => (
                          <SelectItem key={state.isoCode} value={state.name}>
                            {state.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      id="settings-region"
                      value={regionValue}
                      ref={regionInputRef}
                      required
                      placeholder="State"
                      onFocus={() => setIsRegionFocused(true)}
                      onBlur={() => setIsRegionFocused(false)}
                      onChange={(event) => {
                        setRegionValue(event.target.value);
                        if (event.target.value.trim()) {
                          setFieldErrors((prev) => ({ ...prev, region: null }));
                        }
                      }}
                    />
                  )}
                </div>
                {fieldErrors.region ? (
                  <p className="text-xs text-destructive">{fieldErrors.region}</p>
                ) : null}
              </div>

              <div className="space-y-2 sm:col-span-1">
                <Label htmlFor="settings-postal">
                  Zip <span className="text-destructive">*</span>
                </Label>
                <div className="relative rounded-full border border-border/60">
                  {showPostalBeam && !postalValue.trim() ? (
                    <BorderBeam
                      size={52}
                      initialOffset={8}
                      borderWidth={2}
                      className="from-transparent via-amber-700 to-transparent"
                      transition={{ type: 'spring', stiffness: 60, damping: 20 }}
                    />
                  ) : null}
                  <Input
                    id="settings-postal"
                    value={postalValue}
                    ref={postalInputRef}
                    required
                    placeholder={postalPlaceholder}
                    onFocus={() => setIsPostalFocused(true)}
                    onBlur={() => setIsPostalFocused(false)}
                    onChange={(event) => {
                      setPostalValue(event.target.value);
                      if (event.target.value.trim()) {
                        setFieldErrors((prev) => ({ ...prev, postalCode: null }));
                      }
                    }}
                  />
                </div>
                {fieldErrors.postalCode ? (
                  <p className="text-xs text-destructive">{fieldErrors.postalCode}</p>
                ) : null}
              </div>

              <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-2">
                <div className="relative inline-flex rounded-full">
                  {showPickLocationBeam ? (
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
                    className={SOFT_ACCENT_PICK_BUTTON_CLASSNAME}
                    onClick={handlePickLocation}
                    disabled={isPickingLocation}
                  >
                    {isPickingLocation ? 'Picking location…' : 'Pick location for me'}
                  </Button>
                </div>
                <div className="flex gap-2">
                  {expandLocation && onLocationContinue ? (
                    <div className="relative inline-flex rounded-full">
                      {showContinueBeam ? (
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
                        onClick={handleLocationContinue}
                        disabled={isSaving || isLocationRequiredMissing}
                      >
                        {isSaving ? (
                          'Saving...'
                        ) : (
                          <span className="inline-flex items-center gap-2">Save</span>
                        )}
                      </Button>
                    </div>
                  ) : (
                    <div className="relative inline-flex rounded-full">
                      {showContinueBeam ? (
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
                        onClick={handleLocationContinue}
                        disabled={isSaving || isLocationRequiredMissing}
                      >
                        {isSaving ? 'Saving...' : 'Save'}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
              {locationError ? (
                <p className="text-xs text-destructive">{locationError}</p>
              ) : null}
            </div>
          </UserSettingsTabSection>
        </div>
      </div>
    </div>
  );
}
