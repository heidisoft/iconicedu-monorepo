import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { ClassroomWhiteboard } from './classroom-whiteboard';
vi.mock('next/dynamic', () => ({ default: () => () => <div>Drawing canvas</div> }));
vi.mock('./use-whiteboard', () => ({
  useWhiteboard: () => ({
    snapshot: {
      id: 'board',
      revision: 1,
      actorId: 'self',
      role: 'student',
      presence: [
        { id: 'self', name: 'Me', role: 'student' },
        { id: 'teacher', name: 'Tutor', role: 'teacher' },
        { id: 'peer', name: 'Peer', role: 'student' },
      ],
      document: {
        schemaVersion: 1,
        studentEditing: false,
        pages: [{ id: 'page', title: 'Class', elements: [] }],
      },
    },
    connection: 'connected',
    saveStatus: 'saved',
    changeElements: vi.fn(),
  }),
}));
it('offers an icon-only one-time tutor focus with a tooltip', async () => {
  render(
    <ClassroomWhiteboard
      token="synthetic-token"
      repository={{ load: vi.fn(), save: vi.fn() }}
    />,
  );
  const focus = screen.getByRole('button', { name: 'Focus tutor' });
  expect(focus).toHaveAttribute('title', 'Focus tutor’s current view');
  expect(focus).not.toHaveAttribute('aria-pressed');
  expect(focus).not.toHaveTextContent('Focus tutor');
  await userEvent.click(focus);
  expect(screen.queryByRole('button', { name: 'Follow viewport' })).toBeNull();
});
it('keeps Saved and board options inside toolbar More and exposes a direct tutor toggle', async () => {
  const user = userEvent.setup();
  render(
    <ClassroomWhiteboard
      token="synthetic-token"
      repository={{ load: vi.fn(), save: vi.fn() }}
    />,
  );
  expect(screen.queryByText('Saved')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Board options' })).toBeNull();
  const follow = screen.getByRole('button', { name: 'Focus tutor', exact: true });
  await user.click(follow);
  await user.click(follow);
  await user.click(screen.getByRole('button', { name: 'More whiteboard actions' }));
  expect(screen.getByRole('status')).toHaveTextContent('Saved');
  expect(screen.getByRole('menuitem', { name: 'Export PNG' })).toBeTruthy();
});

it('exposes zoom actions on the canvas while waiting for the engine to load', () => {
  render(
    <ClassroomWhiteboard
      token="synthetic-token"
      repository={{ load: vi.fn(), save: vi.fn() }}
    />,
  );
  const group = screen.getByRole('group', { name: 'Whiteboard zoom controls' });
  for (const name of ['Fit content', 'Zoom in', 'Zoom out', 'Reset zoom to 100%']) {
    const button = screen.getByRole('button', { name });
    expect(group).toContainElement(button);
    expect(button).toBeDisabled();
  }
});
