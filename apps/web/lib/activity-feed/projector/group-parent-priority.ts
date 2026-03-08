type GroupParentPriorityInput = {
  groupKey: string;
  existingVerb?: string | null;
  nextVerb: string;
};

const GROUP_PARENT_PRIORITY: Array<{
  prefix: string;
  preferredVerb: string;
}> = [
  { prefix: 'class-created:', preferredVerb: 'class.created' },
  { prefix: 'class-updated:', preferredVerb: 'class.updated' },
];

function getPreferredVerb(groupKey: string) {
  return GROUP_PARENT_PRIORITY.find((entry) => groupKey.startsWith(entry.prefix))
    ?.preferredVerb;
}

export function shouldReplaceGroupParent(input: GroupParentPriorityInput) {
  if (!input.existingVerb) {
    return true;
  }

  const preferredVerb = getPreferredVerb(input.groupKey);
  if (!preferredVerb) {
    return true;
  }

  if (input.existingVerb === preferredVerb) {
    return input.nextVerb === preferredVerb;
  }

  return input.nextVerb === preferredVerb;
}
