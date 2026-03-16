import type {
  EducatorAvailabilityVM,
  EducatorProfileVM,
  GradeLevel,
  UserProfileVM,
} from '@iconicedu/shared-types';
import type { ProfileRow } from '@iconicedu/shared-types';
import type { SupabaseClient } from '@supabase/supabase-js';

import {
  getEducatorAvailability,
  getEducatorBadges,
  getEducatorCurriculumTags,
  getEducatorGradeLevels,
  getEducatorProfile,
  getEducatorSubjects,
} from '@iconicedu/web/lib/profile/queries/educator.query';
import { parseGradeLevel } from '@iconicedu/shared-types';

function normalizeCertifications(
  raw: unknown[] | null | undefined,
): EducatorProfileVM['certifications'] {
  if (!Array.isArray(raw)) {
    return null;
  }

  const items = raw
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }
      const record = item as Record<string, unknown>;
      const name = typeof record.name === 'string' ? record.name.trim() : '';
      if (!name) {
        return null;
      }
      const issuer = typeof record.issuer === 'string' ? record.issuer : undefined;
      const year = typeof record.year === 'number' ? record.year : undefined;
      return { name, issuer, year };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  return items.length ? items : null;
}

function normalizeIdentityVerificationStatus(
  raw: string | null | undefined,
): EducatorProfileVM['identityVerificationStatus'] {
  if (raw === 'unverified' || raw === 'pending' || raw === 'verified') {
    return raw;
  }
  return null;
}

export async function buildEducatorProfile(
  supabase: SupabaseClient,
  baseProfile: Omit<UserProfileVM, 'kind'>,
  profileRow: ProfileRow,
): Promise<EducatorProfileVM> {
  const [educator, subjects, grades, tags, badges, availabilityResponse] =
    await Promise.all([
      getEducatorProfile(supabase, profileRow.id),
      getEducatorSubjects(supabase, profileRow.id),
      getEducatorGradeLevels(supabase, profileRow.id),
      getEducatorCurriculumTags(supabase, profileRow.id),
      getEducatorBadges(supabase, profileRow.id),
      getEducatorAvailability(supabase, profileRow.id),
    ]);

  const gradeLevels: GradeLevel[] | null = grades.data
    ? grades.data
        .map((row) => parseGradeLevel(row.grade_id) ?? parseGradeLevel(row.grade_label))
        .filter((item): item is GradeLevel => Boolean(item))
    : null;

  const availability: EducatorAvailabilityVM | null = availabilityResponse.data
    ? {
        classTypes: availabilityResponse.data.class_types ?? null,
        weeklyCommitment: availabilityResponse.data.weekly_commitment ?? null,
        availability: availabilityResponse.data.availability ?? null,
      }
    : null;

  return {
    ...baseProfile,
    kind: 'educator',
    headline: educator.data?.headline ?? null,
    subjects: subjects.data?.map((row) => row.subject) ?? null,
    gradesSupported: gradeLevels,
    education: educator.data?.education ?? null,
    experienceYears: educator.data?.experience_years ?? null,
    certifications: normalizeCertifications(educator.data?.certifications),
    joinedDate: educator.data?.joined_date ?? profileRow.created_at,
    ageGroupsComfortableWith: educator.data?.age_groups_comfortable_with ?? null,
    identityVerificationStatus: normalizeIdentityVerificationStatus(
      educator.data?.identity_verification_status,
    ),
    curriculumTags: tags.data?.map((row) => row.tag) ?? null,
    badges: badges.data?.map((row) => row.badge) ?? null,
    averageRating: educator.data?.average_rating ?? null,
    totalReviews: educator.data?.total_reviews ?? null,
    featuredVideoIntroUrl: educator.data?.featured_video_intro_url ?? null,
    availability,
  };
}
