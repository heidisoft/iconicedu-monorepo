import {
  BriefcaseBusiness,
  Presentation,
  ShieldUser,
  Sparkles,
  User,
} from 'lucide-react';

export function getFeedRoleLabel(kind?: string | null) {
  switch (kind) {
    case 'guardian':
      return 'Parent';
    case 'child':
      return 'Student';
    case 'educator':
      return 'Tutor';
    case 'staff':
      return 'Support';
    case 'system':
      return 'System';
    default:
      return 'Member';
  }
}

export function getFeedRoleIcon(kind?: string | null) {
  switch (kind) {
    case 'educator':
      return Presentation;
    case 'guardian':
      return ShieldUser;
    case 'staff':
      return BriefcaseBusiness;
    case 'system':
      return Sparkles;
    case 'child':
    default:
      return User;
  }
}
