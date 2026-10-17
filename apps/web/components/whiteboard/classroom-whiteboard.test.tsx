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
it('offers tutor following by default and lets participants select peers or explore freely', async () => {
  const user = userEvent.setup();
  render(
    <ClassroomWhiteboard
      token="synthetic-token"
      repository={{ load: vi.fn(), save: vi.fn() }}
    />,
  );
  await user.click(screen.getByRole('button', { name: 'Follow viewport' }));
  expect(screen.getByRole('menuitemradio', { name: 'Tutor (default)' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  expect(screen.queryByRole('menuitemradio', { name: 'Me' })).toBeNull();
  await user.click(screen.getByRole('menuitemradio', { name: 'Peer' }));
  expect(screen.getByRole('button', { name: 'Follow viewport' })).toHaveTextContent(
    'Follow Peer',
  );
  await user.click(screen.getByRole('button', { name: 'Follow viewport' }));
  await user.click(screen.getByRole('menuitemradio', { name: 'Explore freely' }));
  expect(screen.getByRole('button', { name: 'Follow viewport' })).toHaveTextContent(
    'Explore freely',
  );
});
