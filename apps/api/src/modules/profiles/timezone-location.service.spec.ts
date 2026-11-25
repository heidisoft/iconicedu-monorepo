import { TimezoneLocationService } from './timezone-location.service';

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
});
const response = (rows: unknown[]) => ({ ok: true, json: async () => rows }) as Response;
const ny = {
  address: { city: 'New York', state: 'NY', country_code: 'us', postcode: '10001' },
};
it('enriches and caches an exact timezone city, normalizing its region', async () => {
  global.fetch = jest.fn().mockResolvedValue(response([ny]));
  const service = new TimezoneLocationService();
  const expected = {
    city: 'New York',
    region: 'New York',
    countryCode: 'US',
    postalCode: '10001',
  };
  expect(await service.lookup('America/New_York')).toEqual(expected);
  expect(await service.lookup('America/New_York')).toEqual(expected);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(jest.mocked(fetch).mock.calls[0]![0]).toContain('countrycodes=us');
});
it('keeps offline hints when the provider is unavailable', async () => {
  global.fetch = jest.fn().mockRejectedValue(new Error('Unavailable'));
  expect(await new TimezoneLocationService().lookup('America/New_York')).toEqual({
    city: 'New York',
    countryCode: 'US',
    region: '',
    postalCode: '',
  });
});
it('does not infer an address from an ambiguous city or wrong country', async () => {
  global.fetch = jest.fn().mockResolvedValue(response([ny, ny]));
  expect((await new TimezoneLocationService().lookup('America/New_York'))?.region).toBe(
    '',
  );
  global.fetch = jest
    .fn()
    .mockResolvedValue(response([{ address: { ...ny.address, country_code: 'gb' } }]));
  expect((await new TimezoneLocationService().lookup('America/New_York'))?.region).toBe(
    '',
  );
});
it('does not contact a provider for arbitrary input or UTC', async () => {
  global.fetch = jest.fn();
  const service = new TimezoneLocationService();
  expect(await service.lookup('https://example.com')).toBeNull();
  expect(await service.lookup('UTC')).toBeNull();
  expect(fetch).not.toHaveBeenCalled();
});
it('leaves invalid postal codes blank', async () => {
  global.fetch = jest
    .fn()
    .mockResolvedValue(
      response([{ address: { ...ny.address, postcode: '10001;10002' } }]),
    );
  expect(
    (await new TimezoneLocationService().lookup('America/New_York'))?.postalCode,
  ).toBe('');
});
