/** Preserve server status for UI recovery without changing API-owned authorization. */
export class ApiHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiHttpError';
  }
}
