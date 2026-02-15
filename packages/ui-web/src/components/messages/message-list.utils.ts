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

  if (updates.social && 'thread' in updates.social && updates.social.thread === undefined) {
    mergedSocial.thread = current.social.thread;
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

export function upsertMessage(messages: MessageVM[], incoming: MessageVM): MessageVM[] {
  const existingIndex = messages.findIndex((message) => message.ids.id === incoming.ids.id);
  if (existingIndex < 0) {
    return [...messages, incoming].sort(compareMessagesByCreatedAt);
  }

  const next = [...messages];
  next[existingIndex] = mergeMessage(next[existingIndex], incoming);
  return next.sort(compareMessagesByCreatedAt);
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
  return merged.sort(compareMessagesByCreatedAt);
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
  return next;
}

export function removeMessageById(messages: MessageVM[], id: string): MessageVM[] {
  return messages.filter((message) => message.ids.id !== id);
}
