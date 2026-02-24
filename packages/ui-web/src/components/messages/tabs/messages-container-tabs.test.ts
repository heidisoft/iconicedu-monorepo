import { describe, expect, it } from 'vitest';
import { getMessagesContainerTabs } from './messages-container-tabs';

describe('messages-container-tabs', () => {
  it('includes members and excludes schedule when schedule is disabled', () => {
    const tabs = getMessagesContainerTabs(false);
    expect(tabs.map((tab) => tab.key)).toEqual(['messages', 'files', 'members']);
  });

  it('includes schedule before members when schedule is enabled', () => {
    const tabs = getMessagesContainerTabs(true);
    expect(tabs.map((tab) => tab.key)).toEqual([
      'messages',
      'files',
      'schedule',
      'members',
    ]);
  });
});
