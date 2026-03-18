import type { MessageVM } from '@iconicedu/shared-types';

function compareMessagesByCreatedAt(a: MessageVM, b: MessageVM) {
  const left = new Date(a.core.createdAt).getTime();
  const right = new Date(b.core.createdAt).getTime();
  if (left !== right) {
    return left - right;
  }
  return a.ids.id.localeCompare(b.ids.id);
}

function mergeMessage(current: MessageVM, updates: Partial<MessageVM>): MessageVM {
  const mergedSocial = updates.social
    ? {
        ...current.social,
        ...updates.social,
      }
    : current.social;

  if (
    updates.social &&
    'thread' in updates.social &&
    updates.social.thread === undefined
  ) {
    mergedSocial.thread = current.social.thread;
  }

  if (
    updates.social?.thread &&
    current.social.thread?.readState &&
    updates.social.thread.readState?.unreadCount === undefined
  ) {
    mergedSocial.thread = {
      ...updates.social.thread,
      readState: current.social.thread.readState,
    };
  }

  return {
    ...current,
    ...updates,
    core: updates.core ? { ...current.core, ...updates.core } : current.core,
    social: mergedSocial,
    state: updates.state
      ? {
          ...(current.state ?? {}),
          ...updates.state,
        }
      : current.state,
  } as MessageVM;
}

function hydrateParentThreads(messages: MessageVM[]): MessageVM[] {
  if (!messages.length) {
    return messages;
  }

  const parentThreadByMessageId = new Map<
    string,
    NonNullable<MessageVM['social']['thread']>
  >();

  messages.forEach((message) => {
    const thread = message.social.thread;
    const parentId = thread?.parent?.messageId;
    if (!thread || !parentId || parentId === message.ids.id) {
      return;
    }

    if (!parentThreadByMessageId.has(parentId)) {
      parentThreadByMessageId.set(parentId, thread);
    }
  });

  if (!parentThreadByMessageId.size) {
    return messages;
  }

  let changed = false;
  const hydrated = messages.map((message) => {
    if (message.social.thread) {
      return message;
    }

    const inferredThread = parentThreadByMessageId.get(message.ids.id);
    if (!inferredThread) {
      return message;
    }

    changed = true;
    return {
      ...message,
      social: {
        ...message.social,
        thread: inferredThread,
      },
    };
  });

  return changed ? hydrated : messages;
}

export function upsertMessage(messages: MessageVM[], incoming: MessageVM): MessageVM[] {
  const existingIndex = messages.findIndex(
    (message) => message.ids.id === incoming.ids.id,
  );
  if (existingIndex < 0) {
    return hydrateParentThreads([...messages, incoming].sort(compareMessagesByCreatedAt));
  }

  const next = [...messages];
  next[existingIndex] = mergeMessage(next[existingIndex], incoming);
  return hydrateParentThreads(next.sort(compareMessagesByCreatedAt));
}

export function prependUniqueMessages(
  messages: MessageVM[],
  olderMessages: MessageVM[],
): MessageVM[] {
  if (!olderMessages.length) {
    return messages;
  }
  const merged = [...messages];
  olderMessages.forEach((message) => {
    if (merged.some((item) => item.ids.id === message.ids.id)) {
      return;
    }
    merged.push(message);
  });
  return hydrateParentThreads(merged.sort(compareMessagesByCreatedAt));
}

export function updateMessageById(
  messages: MessageVM[],
  id: string,
  updates: Partial<MessageVM>,
): MessageVM[] {
  const existingIndex = messages.findIndex((message) => message.ids.id === id);
  if (existingIndex < 0) {
    return messages;
  }
  const next = [...messages];
  next[existingIndex] = mergeMessage(next[existingIndex], updates);
  return hydrateParentThreads(next);
}

export function removeMessageById(messages: MessageVM[], id: string): MessageVM[] {
  return messages.filter((message) => message.ids.id !== id);
}
