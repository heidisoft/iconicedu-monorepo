import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import ContactPage, {
  metadata as contactMetadata,
} from '@iconicedu/web/app/(marketing)/contact/page';
import CookiesPage, {
  metadata as cookiesMetadata,
} from '@iconicedu/web/app/(marketing)/cookies/page';
import PricingPage, {
  metadata as pricingMetadata,
} from '@iconicedu/web/app/(marketing)/pricing/page';
import AboutPage, {
  metadata as aboutMetadata,
} from '@iconicedu/web/app/(marketing)/about/page';
import ForParentsPage, {
  metadata as forParentsMetadata,
} from '@iconicedu/web/app/(marketing)/for-parents/page';
import HowItWorksPage, {
  metadata as howItWorksMetadata,
} from '@iconicedu/web/app/(marketing)/how-it-works/page';
import PrivacyPage, {
  metadata as privacyMetadata,
} from '@iconicedu/web/app/(marketing)/privacy/page';
import RegionalPage, {
  generateMetadata as generateRegionalMetadata,
  generateStaticParams,
} from '@iconicedu/web/app/(marketing)/regions/[regionSlug]/page';
import ProgramPage, {
  generateMetadata as generateProgramMetadata,
  generateStaticParams as generateProgramStaticParams,
} from '@iconicedu/web/app/(marketing)/programs/[programSlug]/page';
import LocationPage, {
  generateMetadata as generateLocationMetadata,
  generateStaticParams as generateLocationStaticParams,
} from '@iconicedu/web/app/(marketing)/locations/[locationSlug]/page';
import TermsPage, {
  metadata as termsMetadata,
} from '@iconicedu/web/app/(marketing)/terms/page';
import SubjectsPage, {
  metadata as subjectsMetadata,
} from '@iconicedu/web/app/(marketing)/subjects/page';

const enableMarketingSitePagesRunMock = vi.fn(async () => true);
const notFoundMock = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});
const createSupabaseServerClientMock = vi.fn(async () => ({}));
const resolveDefaultOrgLoginPathMock = vi.fn(async () => '/acme/login');

vi.mock('next/navigation', () => ({
  notFound: () => notFoundMock(),
}));

vi.mock('@iconicedu/web/flags', () => ({
  enableMarketingSitePages: {
    run: (...args: unknown[]) => enableMarketingSitePagesRunMock(...args),
  },
}));

vi.mock('@iconicedu/web/lib/supabase/server', () => ({
  createSupabaseServerClient: (...args: unknown[]) =>
    createSupabaseServerClientMock(...args),
}));

vi.mock('@iconicedu/web/lib/org/resolve-auth-path', () => ({
  resolveDefaultOrgLoginPath: (...args: unknown[]) =>
    resolveDefaultOrgLoginPathMock(...args),
}));

describe('marketing site standard pages', () => {
  beforeEach(() => {
    enableMarketingSitePagesRunMock.mockReset();
    enableMarketingSitePagesRunMock.mockResolvedValue(true);
    notFoundMock.mockClear();
    createSupabaseServerClientMock.mockClear();
    resolveDefaultOrgLoginPathMock.mockClear();
    resolveDefaultOrgLoginPathMock.mockResolvedValue('/acme/login');
  });

  it.each([
    {
      name: 'privacy',
      Page: PrivacyPage,
      metadata: privacyMetadata,
      title: 'Privacy Policy',
      canonical: '/privacy',
    },
    {
      name: 'terms',
      Page: TermsPage,
      metadata: termsMetadata,
      title: 'Terms of Service',
      canonical: '/terms',
    },
    {
      name: 'cookies',
      Page: CookiesPage,
      metadata: cookiesMetadata,
      title: 'Cookie Policy',
      canonical: '/cookies',
    },
    {
      name: 'contact',
      Page: ContactPage,
      metadata: contactMetadata,
      title: 'Talk with ICONIC Academy',
      canonical: '/contact',
    },
    {
      name: 'pricing',
      Page: PricingPage,
      metadata: pricingMetadata,
      title: 'Flexible tutoring options for every family',
      canonical: '/pricing',
    },
    {
      name: 'subjects',
      Page: SubjectsPage,
      metadata: subjectsMetadata,
      title: 'Academic help and enrichment for every kind of learner',
      canonical: '/subjects',
      expectedText: 'Subject support should feel practical, not overwhelming',
    },
    {
      name: 'how it works',
      Page: HowItWorksPage,
      metadata: howItWorksMetadata,
      title: 'Simple online learning with support families can understand',
      canonical: '/how-it-works',
      expectedText: 'A calmer path from inquiry to learning',
    },
    {
      name: 'for parents',
      Page: ForParentsPage,
      metadata: forParentsMetadata,
      title: 'Tutoring that keeps parents informed — not guessing',
      canonical: '/for-parents',
      expectedText: 'Parents deserve to feel informed',
    },
    {
      name: 'about',
      Page: AboutPage,
      metadata: aboutMetadata,
      title: 'A mission-driven learning platform for more families',
      canonical: '/about',
      expectedText: 'Professional, but personal',
    },
  ])(
    'renders the $name page when enabled',
    async ({ Page, metadata, title, canonical, expectedText }) => {
      render(await Page());

      expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
      if (expectedText) {
        expect(screen.getByText(expectedText)).toBeInTheDocument();
      }
      expect(metadata.alternates?.canonical).toBe(canonical);
      expect(metadata.description).toBeTruthy();
      expect(enableMarketingSitePagesRunMock).toHaveBeenCalledWith({
        identify: { profileId: null },
      });
      expect(resolveDefaultOrgLoginPathMock).toHaveBeenCalledWith({});
    },
  );

  it('returns notFound for standard pages when the feature flag is off', async () => {
    enableMarketingSitePagesRunMock.mockResolvedValue(false);

    await expect(PrivacyPage()).rejects.toThrow('NEXT_NOT_FOUND');

    expect(notFoundMock).toHaveBeenCalled();
    expect(resolveDefaultOrgLoginPathMock).not.toHaveBeenCalled();
  });
});

describe('marketing regional microsite page', () => {
  beforeEach(() => {
    enableMarketingSitePagesRunMock.mockReset();
    enableMarketingSitePagesRunMock.mockResolvedValue(true);
    notFoundMock.mockClear();
    createSupabaseServerClientMock.mockClear();
    resolveDefaultOrgLoginPathMock.mockClear();
    resolveDefaultOrgLoginPathMock.mockResolvedValue('/acme/login');
  });

  it('renders a known regional microsite when enabled', async () => {
    render(
      await RegionalPage({
        params: Promise.resolve({ regionSlug: 'global-online' }),
      }),
    );

    expect(
      screen.getByRole('heading', {
        name: 'Specialized online programs for families anywhere',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('STEM and coding pathways')).toBeInTheDocument();
    expect(enableMarketingSitePagesRunMock).toHaveBeenCalledWith({
      identify: { profileId: null },
    });
  });

  it('returns notFound for unknown regional slugs', async () => {
    await expect(
      RegionalPage({
        params: Promise.resolve({ regionSlug: 'unknown-region' }),
      }),
    ).rejects.toThrow('NEXT_NOT_FOUND');

    expect(notFoundMock).toHaveBeenCalled();
  });

  it('returns notFound for regional pages when the feature flag is off', async () => {
    enableMarketingSitePagesRunMock.mockResolvedValue(false);

    await expect(
      RegionalPage({
        params: Promise.resolve({ regionSlug: 'global-online' }),
      }),
    ).rejects.toThrow('NEXT_NOT_FOUND');

    expect(notFoundMock).toHaveBeenCalled();
  });

  it('defines regional metadata and static params', async () => {
    await expect(
      generateRegionalMetadata({
        params: Promise.resolve({ regionSlug: 'global-online' }),
      }),
    ).resolves.toMatchObject({
      title: 'Global Online Programs | ICONIC Academy',
      alternates: { canonical: '/regions/global-online' },
    });

    expect(generateStaticParams()).toEqual([{ regionSlug: 'global-online' }]);
  });
});

describe('marketing program and location landing pages', () => {
  beforeEach(() => {
    enableMarketingSitePagesRunMock.mockReset();
    enableMarketingSitePagesRunMock.mockResolvedValue(true);
    notFoundMock.mockClear();
    createSupabaseServerClientMock.mockClear();
    resolveDefaultOrgLoginPathMock.mockClear();
    resolveDefaultOrgLoginPathMock.mockResolvedValue('/acme/login');
  });

  it('renders an online tutoring program landing page', async () => {
    render(
      await ProgramPage({
        params: Promise.resolve({ programSlug: 'online-tutoring' }),
      }),
    );

    expect(
      screen.getByRole('heading', {
        name: 'Online K-12 tutoring for school success and confidence',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('What support can include')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Find the right tutor' })).toHaveAttribute(
      'href',
      '/acme/login',
    );
  });

  it('defines program metadata and static params', async () => {
    await expect(
      generateProgramMetadata({
        params: Promise.resolve({ programSlug: 'math-tutoring' }),
      }),
    ).resolves.toMatchObject({
      title: 'Online Math Tutoring | ICONIC Academy',
      alternates: { canonical: '/programs/math-tutoring' },
    });

    expect(generateProgramStaticParams()).toContainEqual({
      programSlug: 'online-tutoring',
    });
  });

  it('renders a USA location landing page', async () => {
    render(
      await LocationPage({
        params: Promise.resolve({ locationSlug: 'usa' }),
      }),
    );

    expect(
      screen.getByRole('heading', {
        name: 'Online tutoring for families across the USA',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('Curriculum and exams')).toBeInTheDocument();
    expect(screen.getByText('Who this helps')).toBeInTheDocument();
    expect(screen.getByText('Common tutoring needs')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Explore programs' })).toHaveAttribute(
      'href',
      '/subjects',
    );
  });

  it('defines location metadata and static params', async () => {
    await expect(
      generateLocationMetadata({
        params: Promise.resolve({ locationSlug: 'texas' }),
      }),
    ).resolves.toMatchObject({
      title: 'Online Tutoring in Texas | ICONIC Academy',
      alternates: { canonical: '/locations/texas' },
    });

    expect(generateLocationStaticParams()).toContainEqual({ locationSlug: 'usa' });
    expect(generateLocationStaticParams()).toContainEqual({
      locationSlug: 'australia',
    });
    expect(generateLocationStaticParams()).toContainEqual({
      locationSlug: 'new-york-city',
    });
    expect(generateLocationStaticParams()).toContainEqual({
      locationSlug: 'ontario',
    });
  });

  it('renders regional curriculum and exam details for international pages', async () => {
    render(
      await LocationPage({
        params: Promise.resolve({ locationSlug: 'australia' }),
      }),
    );

    expect(
      screen.getByRole('heading', {
        name: 'Online tutoring for students across Australia',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('Australian Curriculum')).toBeInTheDocument();
    expect(screen.getByText('NAPLAN')).toBeInTheDocument();
    expect(screen.getByText('HSC')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'New South Wales' })).toHaveAttribute(
      'href',
      '/locations/new-south-wales',
    );
  });

  it('renders UK and Canada exam terms families search for', async () => {
    const { unmount } = render(
      await LocationPage({
        params: Promise.resolve({ locationSlug: 'united-kingdom' }),
      }),
    );

    expect(screen.getByText('National Curriculum')).toBeInTheDocument();
    expect(screen.getByText('GCSE')).toBeInTheDocument();
    expect(screen.getByText('A Levels')).toBeInTheDocument();

    unmount();

    render(
      await LocationPage({
        params: Promise.resolve({ locationSlug: 'canada' }),
      }),
    );

    expect(screen.getByText('Provincial curriculum expectations')).toBeInTheDocument();
    expect(screen.getByText('EQAO')).toBeInTheDocument();
    expect(screen.getByText('OSSLT')).toBeInTheDocument();
    expect(
      screen.getByText('BC literacy and numeracy graduation assessments'),
    ).toBeInTheDocument();
  });

  it('renders a NYC-specific SHSAT location page', async () => {
    render(
      await LocationPage({
        params: Promise.resolve({ locationSlug: 'new-york-city' }),
      }),
    );

    expect(
      screen.getByRole('heading', {
        name: 'Online tutoring and SHSAT prep for New York City students',
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('SHSAT prep')).toBeInTheDocument();
    expect(screen.getByText('Specialized high school readiness')).toBeInTheDocument();
  });

  it('defines metadata for representative regional location pages', async () => {
    await expect(
      generateLocationMetadata({
        params: Promise.resolve({ locationSlug: 'australia' }),
      }),
    ).resolves.toMatchObject({
      title: 'Online Tutoring in Australia | ICONIC Academy',
      alternates: { canonical: '/locations/australia' },
    });

    await expect(
      generateLocationMetadata({
        params: Promise.resolve({ locationSlug: 'new-york-city' }),
      }),
    ).resolves.toMatchObject({
      title: 'Online Tutoring in New York City | ICONIC Academy',
      alternates: { canonical: '/locations/new-york-city' },
    });
  });
});
