'use client';

import * as React from 'react';
import {
  BadgeCheck,
  Bell,
  BookOpen,
  Briefcase,
  CalendarDays,
  Clock3,
  Globe,
  Lightbulb,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Shield,
  User,
  Users,
} from 'lucide-react';

import type { UserAccountVM, UserProfileVM } from '@iconicedu/shared-types';
import { AvatarWithStatus } from '@iconicedu/ui-web/components/shared/avatar-with-status';
import { getProfileFullName } from '@iconicedu/ui-web/lib/display-name';
import { Badge } from '@iconicedu/ui-web/ui/badge';
import { Button } from '@iconicedu/ui-web/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@iconicedu/ui-web/ui/dialog';
import { ScrollArea } from '@iconicedu/ui-web/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@iconicedu/ui-web/ui/tabs';
import {
  type AdminUserPreviewTab,
  getAdminUserPreviewTabs,
} from '@iconicedu/ui-web/components/admin/admin-user-profile-preview.utils';

type AdminUserProfilePreviewDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account?: UserAccountVM | null;
  profile?: UserProfileVM | null;
  isLoading?: boolean;
  error?: string | null;
  onDmClick?: () => void;
};

const TAB_LABELS: Record<AdminUserPreviewTab, string> = {
  account: 'Account',
  profile: 'Profile',
  preferences: 'Preferences',
  location: 'Location',
  notifications: 'Notifications',
  family: 'Family',
  'student-profile': 'Student Profile',
  'educator-profile': 'Educator Profile',
  'educator-availability': 'Availability',
  'staff-profile': 'Staff Profile',
};

function formatList(values?: Array<string | null | undefined> | null) {
  const items = (values ?? []).map((value) => value?.trim() ?? '').filter(Boolean);
  return items.length ? items.join(', ') : '—';
}

function formatDate(value?: string | null) {
  if (!value) {
    return '—';
  }
  return new Date(value).toLocaleDateString();
}

function formatNotificationDefaults(profile?: UserProfileVM | null) {
  if (!profile?.prefs.notificationDefaults) {
    return [];
  }

  return Object.entries(profile.prefs.notificationDefaults).map(([key, value]) => ({
    key,
    label: key,
    value: value?.muted
      ? 'Muted'
      : value?.channels?.length
        ? value.channels.join(', ')
        : 'Enabled',
  }));
}

function getPreviewTitle(profile?: UserProfileVM | null, account?: UserAccountVM | null) {
  if (profile) {
    return getProfileFullName(profile.profile, account?.contacts.email ?? 'User');
  }

  return account?.contacts.email ?? 'User';
}

function getRoleLabel(profile?: UserProfileVM | null) {
  switch (profile?.kind) {
    case 'guardian':
      return 'Parent';
    case 'child':
      return 'Student';
    case 'educator':
      return 'Educator';
    case 'staff':
      return 'Staff';
    default:
      return 'Account';
  }
}

function FieldGrid({
  items,
}: {
  items: Array<{ label: string; value: React.ReactNode; icon?: React.ReactNode }>;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.label} className="rounded-xl border border-border/60 bg-card p-3">
          <div className="mb-1 flex items-center gap-2 text-xs font-medium text-muted-foreground">
            {item.icon}
            <span>{item.label}</span>
          </div>
          <div className="text-sm">{item.value}</div>
        </div>
      ))}
    </div>
  );
}

function EmptyTab({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border/70 p-6 text-sm text-muted-foreground">
      No {label.toLowerCase()} details available.
    </div>
  );
}

export function AdminUserProfilePreviewDialog({
  open,
  onOpenChange,
  account,
  profile,
  isLoading = false,
  error,
  onDmClick,
}: AdminUserProfilePreviewDialogProps) {
  const tabs = React.useMemo(() => getAdminUserPreviewTabs(profile), [profile]);
  const [activeTab, setActiveTab] = React.useState<AdminUserPreviewTab>('account');

  React.useEffect(() => {
    setActiveTab(tabs[0] ?? 'account');
  }, [tabs, open]);

  const previewTitle = getPreviewTitle(profile, account);
  const roleLabel = getRoleLabel(profile);
  const notificationDefaults = formatNotificationDefaults(profile);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border border-border/70 shadow-2xl dark:border-border sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Profile Preview</DialogTitle>
          <DialogDescription>
            Review account and profile details without leaving the users table.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex h-72 items-center justify-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl border border-border/60 bg-card p-4">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex min-w-0 items-center gap-4">
                  <AvatarWithStatus
                    name={previewTitle}
                    avatar={
                      profile?.profile.avatar ?? { source: 'seed', seed: previewTitle }
                    }
                    presence={profile?.presence ?? undefined}
                    themeKey={profile?.ui?.themeKey}
                    showStatus={false}
                    sizeClassName="size-14"
                    initialsLength={2}
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold">{previewTitle}</h3>
                      <Badge variant="outline">{roleLabel}</Badge>
                      {account?.lifecycle.status ? (
                        <Badge variant="secondary" className="capitalize">
                          {account.lifecycle.status}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {account?.contacts.email ?? 'No email available'}
                    </p>
                  </div>
                </div>
                {onDmClick && profile ? (
                  <Button variant="outline" size="sm" onClick={onDmClick}>
                    Message
                  </Button>
                ) : null}
              </div>
            </div>

            <Tabs
              value={activeTab}
              onValueChange={(value) => setActiveTab(value as AdminUserPreviewTab)}
            >
              <TabsList className="h-auto w-full flex-wrap justify-start">
                {tabs.map((tab) => (
                  <TabsTrigger key={tab} value={tab}>
                    {TAB_LABELS[tab]}
                  </TabsTrigger>
                ))}
              </TabsList>
              <ScrollArea className="max-h-[55vh] pr-4">
                <div className="pt-4">
                  <TabsContent value="account" className="m-0 space-y-4">
                    <FieldGrid
                      items={[
                        {
                          label: 'Email',
                          value: account?.contacts.email ?? '—',
                          icon: <Mail className="size-3.5" />,
                        },
                        {
                          label: 'Phone',
                          value: account?.contacts.phoneE164 ?? '—',
                          icon: <Phone className="size-3.5" />,
                        },
                        {
                          label: 'WhatsApp',
                          value: account?.contacts.whatsappE164 ?? '—',
                          icon: <Phone className="size-3.5" />,
                        },
                        {
                          label: 'Preferred contact',
                          value: formatList(account?.contacts.preferredContactChannels),
                          icon: <BadgeCheck className="size-3.5" />,
                        },
                        {
                          label: 'Created',
                          value: formatDate(account?.lifecycle.createdAt),
                          icon: <CalendarDays className="size-3.5" />,
                        },
                        {
                          label: 'Updated',
                          value: formatDate(account?.lifecycle.updatedAt),
                          icon: <Clock3 className="size-3.5" />,
                        },
                        {
                          label: 'Roles',
                          value: formatList(
                            account?.access?.userRoles?.map((role) => role.roleKey),
                          ),
                          icon: <Shield className="size-3.5" />,
                        },
                      ]}
                    />
                  </TabsContent>

                  <TabsContent value="profile" className="m-0 space-y-4">
                    {profile ? (
                      <FieldGrid
                        items={[
                          {
                            label: 'Full name',
                            value: getProfileFullName(
                              profile.profile,
                              account?.contacts.email ?? 'User',
                            ),
                            icon: <User className="size-3.5" />,
                          },
                          {
                            label: 'Display name',
                            value: profile.profile.displayName || '—',
                            icon: <User className="size-3.5" />,
                          },
                          {
                            label: 'First name',
                            value: profile.profile.firstName ?? '—',
                            icon: <User className="size-3.5" />,
                          },
                          {
                            label: 'Last name',
                            value: profile.profile.lastName ?? '—',
                            icon: <User className="size-3.5" />,
                          },
                          {
                            label: 'Bio',
                            value: profile.profile.bio ?? '—',
                            icon: <BookOpen className="size-3.5" />,
                          },
                        ]}
                      />
                    ) : (
                      <EmptyTab label="Profile" />
                    )}
                  </TabsContent>

                  <TabsContent value="preferences" className="m-0 space-y-4">
                    {profile ? (
                      <FieldGrid
                        items={[
                          {
                            label: 'Timezone',
                            value: profile.prefs.timezone ?? '—',
                            icon: <Globe className="size-3.5" />,
                          },
                          {
                            label: 'Locale',
                            value: profile.prefs.locale ?? '—',
                            icon: <Globe className="size-3.5" />,
                          },
                          {
                            label: 'Languages',
                            value: formatList(profile.prefs.languagesSpoken),
                            icon: <Globe className="size-3.5" />,
                          },
                        ]}
                      />
                    ) : (
                      <EmptyTab label="Preferences" />
                    )}
                  </TabsContent>

                  <TabsContent value="location" className="m-0 space-y-4">
                    {profile ? (
                      <FieldGrid
                        items={[
                          {
                            label: 'Country',
                            value: profile.location?.countryName ?? '—',
                            icon: <MapPin className="size-3.5" />,
                          },
                          {
                            label: 'Region',
                            value: profile.location?.region ?? '—',
                            icon: <MapPin className="size-3.5" />,
                          },
                          {
                            label: 'City',
                            value: profile.location?.city ?? '—',
                            icon: <MapPin className="size-3.5" />,
                          },
                          {
                            label: 'Postal code',
                            value: profile.location?.postalCode ?? '—',
                            icon: <MapPin className="size-3.5" />,
                          },
                        ]}
                      />
                    ) : (
                      <EmptyTab label="Location" />
                    )}
                  </TabsContent>

                  <TabsContent value="notifications" className="m-0 space-y-4">
                    {notificationDefaults.length ? (
                      <div className="space-y-2">
                        {notificationDefaults.map((item) => (
                          <div
                            key={item.key}
                            className="rounded-xl border border-border/60 bg-card p-3"
                          >
                            <div className="mb-1 flex items-center gap-2 text-xs font-medium text-muted-foreground">
                              <Bell className="size-3.5" />
                              <span>{item.label}</span>
                            </div>
                            <div className="text-sm">{item.value}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <EmptyTab label="Notifications" />
                    )}
                  </TabsContent>

                  <TabsContent value="family" className="m-0 space-y-4">
                    {profile?.kind === 'guardian' ? (
                      <FieldGrid
                        items={[
                          {
                            label: 'Children',
                            value: formatList(
                              profile.children?.items?.map(
                                (child: { profile: { displayName: string } }) =>
                                  child.profile.displayName,
                              ),
                            ),
                            icon: <Users className="size-3.5" />,
                          },
                          {
                            label: 'Family invites',
                            value: formatList(
                              profile.familyInvites?.map((invite) => invite.invitedEmail),
                            ),
                            icon: <Users className="size-3.5" />,
                          },
                        ]}
                      />
                    ) : profile?.kind === 'child' ? (
                      <FieldGrid
                        items={[
                          {
                            label: 'Parents',
                            value: formatList(profile.guardianNames),
                            icon: <Users className="size-3.5" />,
                          },
                        ]}
                      />
                    ) : (
                      <EmptyTab label="Family" />
                    )}
                  </TabsContent>

                  <TabsContent value="student-profile" className="m-0 space-y-4">
                    {profile?.kind === 'child' ? (
                      <FieldGrid
                        items={[
                          { label: 'Grade', value: profile.gradeLevel ?? '—' },
                          { label: 'Birth year', value: profile.birthYear ?? '—' },
                          { label: 'School', value: profile.schoolName ?? '—' },
                          { label: 'School year', value: profile.schoolYear ?? '—' },
                          { label: 'Interests', value: formatList(profile.interests) },
                          { label: 'Strengths', value: formatList(profile.strengths) },
                          {
                            label: 'Learning preferences',
                            value: formatList(profile.learningPreferences),
                          },
                          {
                            label: 'Motivation styles',
                            value: formatList(profile.motivationStyles),
                          },
                          {
                            label: 'Communication styles',
                            value: formatList(profile.communicationStyles),
                          },
                        ]}
                      />
                    ) : (
                      <EmptyTab label="Student profile" />
                    )}
                  </TabsContent>

                  <TabsContent value="educator-profile" className="m-0 space-y-4">
                    {profile?.kind === 'educator' ? (
                      <FieldGrid
                        items={[
                          {
                            label: 'Headline',
                            value: profile.headline ?? '—',
                            icon: <Lightbulb className="size-3.5" />,
                          },
                          {
                            label: 'Subjects',
                            value: formatList(profile.subjects),
                            icon: <BookOpen className="size-3.5" />,
                          },
                          {
                            label: 'Grades supported',
                            value: formatList(profile.gradesSupported?.map(String)),
                            icon: <BookOpen className="size-3.5" />,
                          },
                          {
                            label: 'Education',
                            value: profile.education ?? '—',
                            icon: <BookOpen className="size-3.5" />,
                          },
                          {
                            label: 'Experience',
                            value:
                              typeof profile.experienceYears === 'number'
                                ? `${profile.experienceYears} years`
                                : '—',
                            icon: <Clock3 className="size-3.5" />,
                          },
                          {
                            label: 'Certifications',
                            value: formatList(
                              profile.certifications?.map((cert) => cert.name),
                            ),
                            icon: <BadgeCheck className="size-3.5" />,
                          },
                          {
                            label: 'Curriculum tags',
                            value: formatList(profile.curriculumTags),
                            icon: <BookOpen className="size-3.5" />,
                          },
                          {
                            label: 'Badges',
                            value: formatList(profile.badges),
                            icon: <BadgeCheck className="size-3.5" />,
                          },
                        ]}
                      />
                    ) : (
                      <EmptyTab label="Educator profile" />
                    )}
                  </TabsContent>

                  <TabsContent value="educator-availability" className="m-0 space-y-4">
                    {profile?.kind === 'educator' && profile.availability ? (
                      <FieldGrid
                        items={[
                          {
                            label: 'Class types',
                            value: formatList(profile.availability.classTypes),
                            icon: <CalendarDays className="size-3.5" />,
                          },
                          {
                            label: 'Weekly commitment',
                            value: profile.availability.weeklyCommitment ?? '—',
                            icon: <CalendarDays className="size-3.5" />,
                          },
                          {
                            label: 'Availability set',
                            value: profile.availability.availability ? 'Yes' : 'No',
                            icon: <CalendarDays className="size-3.5" />,
                          },
                        ]}
                      />
                    ) : (
                      <EmptyTab label="Availability" />
                    )}
                  </TabsContent>

                  <TabsContent value="staff-profile" className="m-0 space-y-4">
                    {profile?.kind === 'staff' ? (
                      <FieldGrid
                        items={[
                          {
                            label: 'Department',
                            value: profile.department ?? '—',
                            icon: <Briefcase className="size-3.5" />,
                          },
                          {
                            label: 'Job title',
                            value: profile.jobTitle ?? '—',
                            icon: <Briefcase className="size-3.5" />,
                          },
                          {
                            label: 'Specialties',
                            value: formatList(profile.specialties),
                            icon: <Briefcase className="size-3.5" />,
                          },
                          {
                            label: 'Permission scope',
                            value: profile.permissionsScope ?? '—',
                            icon: <Shield className="size-3.5" />,
                          },
                          {
                            label: 'Weekly availability set',
                            value: profile.weeklyAvailability ? 'Yes' : 'No',
                            icon: <CalendarDays className="size-3.5" />,
                          },
                        ]}
                      />
                    ) : (
                      <EmptyTab label="Staff profile" />
                    )}
                  </TabsContent>
                </div>
              </ScrollArea>
            </Tabs>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
