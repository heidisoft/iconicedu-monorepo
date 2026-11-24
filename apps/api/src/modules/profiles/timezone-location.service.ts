import { Injectable } from '@nestjs/common';
import {
  findCountryRegion,
  getCountryAddressFields,
  getCountryRegions,
  type LocationSuggestion,
} from '@iconicedu/shared-types';
import { getTimezoneLocationHint } from '@iconicedu/utils';

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}
function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}
const normalize = (value: string) =>
  value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

@Injectable()
export class TimezoneLocationService {
  private cache = new Map<string, { expires: number; value: LocationSuggestion }>();
  private pending = new Map<string, Promise<LocationSuggestion>>();
  private nextRequestAt = 0;

  async lookup(timezone: string): Promise<LocationSuggestion | null> {
    const hint = getTimezoneLocationHint(timezone);
    if (!hint) return null;
    const base = { ...hint, region: '', postalCode: '' };
    const cached = this.cache.get(timezone);
    if (cached && cached.expires > Date.now()) return cached.value;
    const pending = this.pending.get(timezone);
    if (pending) return pending;
    const delay = Math.max(0, this.nextRequestAt - Date.now());
    if (delay > 4000) return base;
    this.nextRequestAt = Date.now() + delay + 1000;
    const lookup = (async () => {
      if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
      let value = base;
      try {
        const params = new URLSearchParams({
          city: hint.city,
          format: 'jsonv2',
          addressdetails: '1',
          limit: '3',
        });
        if (hint.countryCode) params.set('countrycodes', hint.countryCode.toLowerCase());
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?${params}`,
          {
            headers: {
              'User-Agent': 'ICONICAcademy/1.0 (https://iconicedu.lk)',
              'Accept-Language': 'en',
            },
            signal: AbortSignal.timeout(4000),
          },
        );
        if (response.ok) {
          const results: unknown = await response.json();
          const candidates = (Array.isArray(results) ? results.slice(0, 3) : [])
            .map((result) => record(record(result).address))
            .filter(
              (address) =>
                normalize(
                  text(address.city) ||
                    text(address.town) ||
                    text(address.village) ||
                    text(address.municipality),
                ) === normalize(hint.city) &&
                (!hint.countryCode ||
                  text(address.country_code).toUpperCase() === hint.countryCode),
            );
          // Do not choose between multiple places with the same name.
          if (candidates.length === 1) {
            const address = candidates[0]!;
            const countryCode =
              text(address.country_code).toUpperCase() || hint.countryCode;
            const fields = getCountryAddressFields(countryCode);
            const rawRegion =
              text(address.state) || text(address.region) || text(address.county);
            const region =
              findCountryRegion(countryCode, rawRegion)?.label ??
              (getCountryRegions(countryCode).length ? '' : rawRegion);
            const postalCode = text(address.postcode).toUpperCase();
            const validPostal =
              fields?.postal.visible &&
              postalCode.length <= 32 &&
              fields.postalPattern &&
              new RegExp(`^(?:${fields.postalPattern})$`, 'i').test(postalCode);
            value = {
              ...base,
              countryCode,
              region,
              postalCode: validPostal ? postalCode : '',
            };
          }
        }
      } catch {
        /* Address enrichment is optional; keep the offline city/country hint. */
      }
      if (this.cache.size >= 512) this.cache.delete(this.cache.keys().next().value!);
      this.cache.set(timezone, { value, expires: Date.now() + 60 * 60 * 1000 });
      return value;
    })();
    this.pending.set(timezone, lookup);
    try {
      return await lookup;
    } finally {
      this.pending.delete(timezone);
    }
  }
}
