import { findCountryRegion, getCountryRegions } from '@iconicedu/shared-types';
import { useCallback, useRef, useState } from 'react';

type LocationFields = {
  city: string;
  region: string;
  postalCode: string;
  countryCode: string;
};

export function useOnboardingLocation() {
  const [location, setLocation] = useState<LocationFields>({
    city: '',
    region: '',
    postalCode: '',
    countryCode: 'US',
  });
  const edited = useRef(new Set<keyof LocationFields>());
  const edit = useCallback((field: keyof LocationFields, value: string) => {
    edited.current.add(field);
    setLocation((current) => ({ ...current, [field]: value }));
  }, []);
  const setCity = useCallback((value: string) => edit('city', value), [edit]);
  const setRegion = useCallback((value: string) => edit('region', value), [edit]);
  const setPostalCode = useCallback((value: string) => edit('postalCode', value), [edit]);
  const setCountryCode = useCallback((value: string) => {
    edited.current.add('countryCode');
    setLocation((current) => {
      if (current.countryCode === value) return current;
      edited.current.delete('region');
      return { ...current, countryCode: value, region: '' };
    });
  }, []);
  const prefillLocation = useCallback((suggestion: Partial<LocationFields>) => {
    setLocation((current) => {
      const next = { ...current };
      const changedPlace =
        (suggestion.city && suggestion.city !== current.city) ||
        (suggestion.countryCode && suggestion.countryCode !== current.countryCode);
      if (changedPlace) {
        for (const field of ['region', 'postalCode'] as const) {
          if (!edited.current.has(field)) next[field] = '';
        }
      }
      for (const field of ['city', 'region', 'postalCode', 'countryCode'] as const) {
        if (suggestion[field] && !edited.current.has(field))
          next[field] = suggestion[field];
      }
      const match = findCountryRegion(next.countryCode, next.region);
      if (match) next.region = match.label;
      else if (
        !edited.current.has('region') &&
        getCountryRegions(next.countryCode).length
      )
        next.region = '';
      return next;
    });
  }, []);
  const restoreLocation = useCallback((saved: Partial<LocationFields>) => {
    const available = Object.fromEntries(
      Object.entries(saved).filter(([, value]) => !!value),
    ) as Partial<LocationFields>;
    for (const field of Object.keys(available) as (keyof LocationFields)[])
      edited.current.add(field);
    setLocation((current) => ({ ...current, ...available }));
  }, []);
  return {
    ...location,
    setCity,
    setRegion,
    setPostalCode,
    setCountryCode,
    prefillLocation,
    restoreLocation,
  };
}
