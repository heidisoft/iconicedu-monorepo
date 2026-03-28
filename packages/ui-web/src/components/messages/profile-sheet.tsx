import {
  Calendar,
  BookOpen,
  GraduationCap,
  Phone,
  Award,
  Clock,
  Users,
  FileText,
  Megaphone,
  Mail,
  MapPin,
  Globe,
  School,
  Heart,
  Sparkles,
  MessageCircle,
  type LucideIcon,
} from 'lucide-react';
import {
  AvatarWithStatus,
  getAvatarLocationLabel,
} from '@iconicedu/ui-web/components/shared/avatar-with-status';
import { getProfileDisplayName } from '@iconicedu/ui-web/lib/display-name';
import { Badge } from '@iconicedu/ui-web/ui/badge';
import { Button } from '@iconicedu/ui-web/ui/button';
import { Separator } from '@iconicedu/ui-web/ui/separator';
import { cn } from '@iconicedu/ui-web/lib/utils';
import type { ChildProfileVM, GradeLevel, UserProfileVM } from '@iconicedu/shared-types';
import { gradeLabel, normalizeCountryCode } from '@iconicedu/shared-types';

export type ProfileDetailsUser = UserProfileVM & {
  role?: string;
  email?: string;
  phone?: string;
  joinedDate?: string;
  headline?: string | null;
  bio?: string | null;
  subjects?: string[] | null;
  gradesSupported?: GradeLevel[] | null;
  experienceYears?: number | null;
  certifications?: Array<{
    name: string;
    issuer?: string;
    year?: number;
  }> | null;
  childrenNames?: string[];
};

interface ProfileSheetProps {
  user: ProfileDetailsUser;
  onCallClick?: () => void;
  onDmClick?: () => void;
  onScheduleClick?: () => void;
  onShareClick?: () => void;
  onReportClick?: () => void;
}

interface AboutField {
  key: string;
  label: string;
  value: string;
  icon: LucideIcon;
}

function roleLabelFromKind(kind: UserProfileVM['kind']): string {
  switch (kind) {
    case 'educator':
      return 'Teacher';
    case 'guardian':
      return 'Parent';
    case 'child':
      return 'Student';
    case 'staff':
      return 'Staff';
    case 'system':
      return 'System';
    default:
      return 'Member';
  }
}

function getJoinedDate(user: ProfileDetailsUser): string | null {
  if (user.joinedDate) return user.joinedDate;
  if (user.kind === 'educator' || user.kind === 'guardian') return user.joinedDate;
  return null;
}

function getChildrenNames(user: ProfileDetailsUser): string[] {
  if (user.childrenNames?.length) return user.childrenNames;
  if (user.kind === 'guardian' && user.children?.items?.length) {
    return user.children.items
      .map((child: ChildProfileVM) => child.profile.displayName)
      .filter(Boolean);
  }
  return [];
}

function buildLocationLabel(user: ProfileDetailsUser): string | null {
  const parts = [user.location?.city, user.location?.region, user.location?.countryName]
    .filter((part): part is string => Boolean(part?.trim()))
    .map((part) => part.trim());

  if (!parts.length) {
    return null;
  }

  return parts.join(', ');
}

export function buildAboutFields(user: ProfileDetailsUser): AboutField[] {
  const countryCode = normalizeCountryCode(user.location?.countryCode);
  const aboutFields: AboutField[] = [];
  const roleLabel = user.role ?? roleLabelFromKind(user.kind);
  const joinedDate = getJoinedDate(user);
  const childrenNames = getChildrenNames(user);

  const pushField = (
    key: string,
    label: string,
    value: string | null | undefined,
    icon: LucideIcon,
  ) => {
    if (!value?.trim()) return;
    aboutFields.push({ key, label, value: value.trim(), icon });
  };

  pushField('role', 'Role', roleLabel, Users);
  pushField('bio', 'Bio', user.profile.bio, FileText);
  pushField('email', 'Email', user.profile.email ?? user.accountEmail ?? null, Mail);
  pushField('location', 'Location', buildLocationLabel(user), MapPin);
  pushField('timezone', 'Timezone', user.prefs?.timezone, Globe);
  pushField(
    'languagesSpoken',
    'Languages',
    user.prefs.languagesSpoken?.join(', '),
    Globe,
  );

  if (user.kind === 'educator') {
    pushField('headline', 'Headline', user.headline, Megaphone);
    pushField('subjects', 'Subjects', user.subjects?.join(', '), BookOpen);
    pushField(
      'gradesSupported',
      'Grades supported',
      user.gradesSupported
        ?.map((grade) => (grade ? gradeLabel(grade, countryCode) : null))
        .filter(Boolean)
        .join(', '),
      GraduationCap,
    );
    pushField(
      'experienceYears',
      'Experience',
      typeof user.experienceYears === 'number' ? `${user.experienceYears} years` : null,
      Clock,
    );
    pushField('education', 'Education', user.education, School);
    pushField(
      'certifications',
      'Certifications',
      user.certifications
        ?.map((cert) => {
          if (cert.issuer && cert.year) {
            return `${cert.name} (${cert.issuer}, ${cert.year})`;
          }
          if (cert.issuer) return `${cert.name} (${cert.issuer})`;
          if (cert.year) return `${cert.name} (${cert.year})`;
          return cert.name;
        })
        .join(', '),
      Award,
    );
    pushField('curriculumTags', 'Curriculum', user.curriculumTags?.join(', '), BookOpen);
    pushField('badges', 'Badges', user.badges?.join(', '), Award);
  }

  if (user.kind === 'child') {
    pushField(
      'gradeLevel',
      'Grade',
      user.gradeLevel ? gradeLabel(user.gradeLevel, countryCode) : null,
      GraduationCap,
    );
    pushField('schoolName', 'School', user.schoolName, School);
    pushField('schoolYear', 'School year', user.schoolYear, Calendar);
    pushField('guardianNames', 'Parents', user.guardianNames?.join(', '), Users);
    pushField('interests', 'Interests', user.interests?.join(', '), Heart);
    pushField('strengths', 'Strengths', user.strengths?.join(', '), Sparkles);
    pushField(
      'learningPreferences',
      'Learning style',
      user.learningPreferences?.join(', '),
      BookOpen,
    );
  }

  if (user.kind === 'guardian') {
    pushField('childrenNames', 'Children', childrenNames.join(', '), Users);
  }

  pushField(
    'joinedDate',
    'Member since',
    joinedDate
      ? new Date(joinedDate).toLocaleDateString('en-US', {
          month: 'long',
          year: 'numeric',
        })
      : null,
    Calendar,
  );

  return aboutFields;
}

export function ProfileContent({
  user,
  onDmClick,
  onCallClick: _onCallClick,
  onScheduleClick: _onScheduleClick,
  onShareClick: _onShareClick,
  onReportClick: _onReportClick,
}: {
  user: ProfileDetailsUser;
  onCallClick?: () => void;
  onDmClick?: () => void;
  onScheduleClick?: () => void;
  onShareClick?: () => void;
  onReportClick?: () => void;
}) {
  const profileDisplayName = getProfileDisplayName(user.profile);
  const roleLabel = user.role ?? roleLabelFromKind(user.kind);
  const aboutFields = buildAboutFields(user);
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="flex flex-col items-center gap-3 p-6 min-w-0">
        <AvatarWithStatus
          accountId={user.ids.accountId}
          profileId={user.ids.id}
          name={profileDisplayName}
          avatar={user.profile.avatar}
          presence={user.presence}
          themeKey={user.ui?.themeKey}
          roleLabel={roleLabel}
          timezone={user.prefs?.timezone ?? null}
          showStatus={false}
          locationLabel={getAvatarLocationLabel(user.location)}
          about={user.profile.bio ?? null}
          onMessageClick={onDmClick}
          sizeClassName="h-20 w-20"
          statusClassName="bottom-1 right-1 h-4 w-4"
          fallbackClassName="text-2xl"
        />
        <div className="text-center min-w-0">
          <h2 className="text-lg font-semibold text-foreground break-words">
            {profileDisplayName}
          </h2>
          {(user.presence?.state?.emoji || user.presence?.state?.text) && (
            <Badge variant="secondary" className="mt-1 max-w-full">
              <span className="inline-flex items-center gap-1.5 truncate">
                {user.presence?.state?.emoji ? (
                  <span>{user.presence.state.emoji}</span>
                ) : null}
                {user.presence?.state?.text ? (
                  <span className="truncate">{user.presence.state.text}</span>
                ) : null}
              </span>
            </Badge>
          )}
        </div>
        <Badge variant="secondary" className="text-xs">
          {roleLabel}
        </Badge>
        {onDmClick ? (
          <div className="mt-1 flex items-start gap-3">
            <Button
              type="button"
              variant="ghost"
              disabled
              className={cn(
                'h-auto w-16 shrink-0 basis-16 flex-col items-center gap-2 px-1 py-2 text-[11px] font-medium text-muted-foreground hover:bg-transparent',
              )}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Phone className="h-4 w-4" />
              </span>
              <span className="w-full truncate text-center">Call</span>
            </Button>
            <Button
              type="button"
              variant="ghost"
              className={cn(
                'group h-auto w-16 shrink-0 basis-16 flex-col items-center gap-2 px-1 py-2 text-[11px] font-medium text-foreground hover:bg-transparent',
              )}
              onClick={onDmClick}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors group-hover:bg-primary/15 group-hover:text-primary">
                <MessageCircle className="h-4 w-4" />
              </span>
              <span className="w-full truncate text-center">Message</span>
            </Button>
          </div>
        ) : null}
      </div>

      <Separator />

      <div className="space-y-4 p-4 min-w-0">
        <h3 className="text-sm font-semibold text-foreground">About</h3>
        <div className="space-y-3 min-w-0">
          {aboutFields.map((field) => (
            <div key={field.key} className="flex items-start gap-3">
              <field.icon className="mt-0.5 h-4 w-4 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">{field.label}</p>
                <p className="text-sm text-foreground break-words">{field.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ProfileSheet({
  user,
  onCallClick,
  onDmClick,
  onScheduleClick,
  onShareClick,
  onReportClick,
}: ProfileSheetProps) {
  return (
    <ProfileContent
      user={user}
      onCallClick={onCallClick}
      onDmClick={onDmClick}
      onScheduleClick={onScheduleClick}
      onShareClick={onShareClick}
      onReportClick={onReportClick}
    />
  );
}
