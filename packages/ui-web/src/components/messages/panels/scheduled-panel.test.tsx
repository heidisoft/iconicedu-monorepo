/* @vitest-environment jsdom */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import { ScheduledPanel } from './scheduled-panel';

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

function makeScheduled(overrides: Partial<Record<string, any>> = {}) {
  return {
    ids: { id: 'scheduled-1', orgId: 'org-1' },
    channelId: 'channel-1',
    senderProfileId: 'profile-1',
    content: 'Reminder: bring your notebook',
    sendAt: '2026-06-01T15:00:00.000Z',
    timezone: 'UTC',
    status: 'pending',
    ...overrides,
  };
}

describe('ScheduledPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows an empty state when there is nothing scheduled', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => ({ success: true, data: [] }) })),
    );
    render(<ScheduledPanel intent={{ key: 'scheduled' }} />);

    await waitFor(() => {
      expect(screen.getByText('No scheduled messages')).toBeInTheDocument();
    });
  });

  it('shows all four actions enabled for a pending message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ success: true, data: [makeScheduled()] }),
      })),
    );
    render(<ScheduledPanel intent={{ key: 'scheduled' }} />);

    await waitFor(() => {
      expect(screen.getByText('Reminder: bring your notebook')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /edit/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /reschedule/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /send now/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeEnabled();
  });

  it('disables edit, reschedule, and send-now for a failed message, but keeps cancel enabled and shows lastError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          success: true,
          data: [
            makeScheduled({
              status: 'failed',
              lastError: 'Channel no longer exists',
            }),
          ],
        }),
      })),
    );
    render(<ScheduledPanel intent={{ key: 'scheduled' }} />);

    await waitFor(() => {
      expect(screen.getByText('Channel no longer exists')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /edit/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /reschedule/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /send now/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeEnabled();
  });

  it('disables all four actions for a sent message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ success: true, data: [makeScheduled({ status: 'sent' })] }),
      })),
    );
    render(<ScheduledPanel intent={{ key: 'scheduled' }} />);

    await waitFor(() => {
      expect(screen.getByText('Reminder: bring your notebook')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /edit/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /reschedule/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /send now/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();
  });

  it('edits a pending message via PUT and shows the updated content', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === '/api/messages/scheduled') {
        return {
          ok: true,
          json: async () => ({ success: true, data: [makeScheduled()] }),
        };
      }
      if (url === '/api/messages/scheduled/scheduled-1' && init?.method === 'PUT') {
        return {
          ok: true,
          json: async () => ({
            success: true,
            data: makeScheduled({ content: 'Updated reminder text' }),
          }),
        };
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<ScheduledPanel intent={{ key: 'scheduled' }} />);

    await waitFor(() => {
      expect(screen.getByText('Reminder: bring your notebook')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /edit/i }));
    const textarea = screen.getByDisplayValue('Reminder: bring your notebook');
    fireEvent.change(textarea, { target: { value: 'Updated reminder text' } });
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => {
      expect(screen.getByText('Updated reminder text')).toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/messages/scheduled/scheduled-1',
      expect.objectContaining({ method: 'PUT' }),
    );
  });

  it('cancels a scheduled message via DELETE and removes it from the list', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === '/api/messages/scheduled') {
        return {
          ok: true,
          json: async () => ({ success: true, data: [makeScheduled()] }),
        };
      }
      if (url === '/api/messages/scheduled/scheduled-1' && init?.method === 'DELETE') {
        return { ok: true, json: async () => ({ success: true }) };
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<ScheduledPanel intent={{ key: 'scheduled' }} />);

    await waitFor(() => {
      expect(screen.getByText('Reminder: bring your notebook')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    await waitFor(() => {
      expect(screen.getByText('No scheduled messages')).toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/messages/scheduled/scheduled-1',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('sends a pending message now via POST send-now', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === '/api/messages/scheduled') {
        return {
          ok: true,
          json: async () => ({ success: true, data: [makeScheduled()] }),
        };
      }
      if (
        url === '/api/messages/scheduled/scheduled-1/send-now' &&
        init?.method === 'POST'
      ) {
        return {
          ok: true,
          json: async () => ({ success: true, data: makeScheduled({ status: 'sent' }) }),
        };
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    render(<ScheduledPanel intent={{ key: 'scheduled' }} />);

    await waitFor(() => {
      expect(screen.getByText('Reminder: bring your notebook')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /send now/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /send now/i })).toBeDisabled();
    });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/messages/scheduled/scheduled-1/send-now',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
