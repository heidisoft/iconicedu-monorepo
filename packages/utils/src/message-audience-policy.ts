import type { MessageVisibilityVM } from '@iconicedu/shared-types';

/**
 * Safeguarding rules for restricted ("private") channel messages.
 *
 * The API enforces these rules; web and mobile use the same helpers only to
 * hide options the API would reject.
 *
 * | Sender  | May address privately               |
 * | ------- | ----------------------------------- |
 * | staff   | anyone                              |
 * | tutor   | staff, tutors, parents, students *  |
 * | parent  | staff, tutors                       |
 * | student | nobody (cannot start private chats) |
 *
 * * A student is only addressable together with a guardian, who is added to
 *   the audience automatically.
 */
export type MessageAudienceRole = 'staff' | 'tutor' | 'parent' | 'student' | 'other';

const ADDRESSABLE_ROLES: Record<MessageAudienceRole, ReadonlySet<MessageAudienceRole>> = {
  staff: new Set<MessageAudienceRole>(['staff', 'tutor', 'parent', 'student', 'other']),
  tutor: new Set<MessageAudienceRole>(['staff', 'tutor', 'parent', 'student']),
  parent: new Set<MessageAudienceRole>(['staff', 'tutor']),
  student: new Set<MessageAudienceRole>(),
  other: new Set<MessageAudienceRole>(),
};

/**
 * Maps a profile kind (plus org staff roles, which only the API can see) to a
 * safeguarding role. Owners and admins count as staff.
 */
export function resolveMessageAudienceRole(
  profileKind: string | null | undefined,
  options: { hasStaffRole?: boolean } = {},
): MessageAudienceRole {
  if (options.hasStaffRole || profileKind === 'staff') return 'staff';
  switch (profileKind) {
    case 'educator':
      return 'tutor';
    case 'guardian':
      return 'parent';
    case 'child':
      return 'student';
    default:
      return 'other';
  }
}

export function canInitiateRestrictedMessage(sender: MessageAudienceRole): boolean {
  return ADDRESSABLE_ROLES[sender].size > 0;
}

export function canAddressPrivately(
  sender: MessageAudienceRole,
  recipient: MessageAudienceRole,
): boolean {
  return ADDRESSABLE_ROLES[sender].has(recipient);
}

/**
 * Non-staff senders may only reach a student when at least one of the
 * student's guardians is also in the audience. Staff are exempt because every
 * restricted message is already open to staff review.
 */
export function requiresGuardianForStudentRecipients(
  sender: MessageAudienceRole,
): boolean {
  return sender !== 'staff';
}

/**
 * True when the viewer can see a restricted message only through staff review,
 * i.e. they are neither its sender nor in its audience. Such messages are
 * read-only: no replies, reactions, pins, or edits.
 */
export function isOutsideMessageAudience(input: {
  visibility: MessageVisibilityVM;
  senderProfileId?: string | null;
  viewerProfileId?: string | null;
}): boolean {
  const { visibility, senderProfileId, viewerProfileId } = input;
  if (!viewerProfileId || visibility.type === 'all') return false;
  if (viewerProfileId === senderProfileId) return false;
  switch (visibility.type) {
    case 'sender-only':
      return true;
    case 'recipient-only':
      return visibility.userId !== viewerProfileId;
    case 'specific-users':
      return !visibility.userIds.includes(viewerProfileId);
    default:
      return false;
  }
}

export interface MessageAudienceCandidate {
  id: string;
  /** Profile kind (`staff`, `educator`, `guardian`, `child`, …). */
  kind: string | null | undefined;
}

export interface MessageAudienceGroups<T extends MessageAudienceCandidate> {
  /** Staff the sender may reach; offered as one "Staff" option, never by name. */
  staffIds: string[];
  parents: T[];
  tutors: T[];
  students: T[];
  /** Everyone the sender may pick by name, in display order: parents, tutors, students, then anyone else. */
  namedPeople: T[];
}

/**
 * Sorts the channel members a sender may address privately into the picker's
 * groups. Staff (including owners and admins) are offered only as a single
 * "Staff" option, so families and tutors can alert the staff team without
 * picking an individual. The sender is never included.
 */
export function groupMessageAudienceCandidates<T extends MessageAudienceCandidate>(
  candidates: readonly T[],
  input: { senderId?: string | null; senderKind?: string | null },
): MessageAudienceGroups<T> {
  const senderRole = resolveMessageAudienceRole(
    input.senderKind ??
      candidates.find((candidate) => candidate.id === input.senderId)?.kind,
  );
  const groups: MessageAudienceGroups<T> = {
    staffIds: [],
    parents: [],
    tutors: [],
    students: [],
    namedPeople: [],
  };
  if (!canInitiateRestrictedMessage(senderRole)) return groups;
  const others: T[] = [];

  const seen = new Set<string>();
  for (const candidate of candidates) {
    if (!candidate.id || candidate.id === input.senderId || seen.has(candidate.id)) {
      continue;
    }
    seen.add(candidate.id);
    const role = resolveMessageAudienceRole(candidate.kind);
    if (!canAddressPrivately(senderRole, role)) continue;
    if (role === 'staff') groups.staffIds.push(candidate.id);
    else if (role === 'parent') groups.parents.push(candidate);
    else if (role === 'tutor') groups.tutors.push(candidate);
    else if (role === 'student') groups.students.push(candidate);
    else others.push(candidate);
  }
  groups.namedPeople = [
    ...groups.parents,
    ...groups.tutors,
    ...groups.students,
    ...others,
  ];
  return groups;
}

/** True when `selected` is exactly the ids in `group` (order-insensitive, non-empty). */
export function isExactAudienceSelection(
  selected: readonly string[],
  group: readonly string[],
): boolean {
  if (!group.length || selected.length !== group.length) return false;
  const set = new Set(selected);
  return group.every((id) => set.has(id));
}

export interface MessageAudienceGroupOption {
  key: 'parents' | 'tutors' | 'students';
  /** Singular when the group has one member ("Tutor"), plural otherwise ("Tutors"). */
  label: string;
  ids: string[];
}

/**
 * The whole-group picker options (parents, tutors, students) for the groups the
 * sender can reach. Each replaces the current selection with exactly that group.
 */
export function getMessageAudienceGroupOptions(
  groups: Pick<
    MessageAudienceGroups<MessageAudienceCandidate>,
    'parents' | 'tutors' | 'students'
  >,
): MessageAudienceGroupOption[] {
  const entries: Array<
    [MessageAudienceGroupOption['key'], string, MessageAudienceCandidate[]]
  > = [
    ['parents', 'Parent', groups.parents],
    ['tutors', 'Tutor', groups.tutors],
    ['students', 'Student', groups.students],
  ];
  return entries
    .filter(([, , members]) => members.length > 0)
    .map(([key, singular, members]) => ({
      key,
      label: members.length === 1 ? singular : `${singular}s`,
      ids: members.map((member) => member.id),
    }));
}
