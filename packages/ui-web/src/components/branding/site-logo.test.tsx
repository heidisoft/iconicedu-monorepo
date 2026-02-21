import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { SiteLogo } from './site-logo';
import { SiteLogoFull } from './site-logo-full';
import { SiteLogoWithName } from './site-logo-wt-name';

describe('SiteLogo', () => {
  it('keeps the legacy shared gradient id', () => {
    const { container } = render(<SiteLogo />);
    expect(container.querySelector('linearGradient')?.getAttribute('id')).toBe(
      'logo-linear-gradient',
    );
    expect(container.querySelector('path[fill^="url(#"]')?.getAttribute('fill')).toBe(
      'url(#logo-linear-gradient)',
    );
  });
});

describe('SiteLogoFull', () => {
  it('uses a unique gradient id for each rendered instance', () => {
    const { container } = render(
      <>
        <SiteLogoFull />
        <SiteLogoFull />
      </>,
    );

    const gradients = Array.from(container.querySelectorAll('linearGradient'));
    expect(gradients).toHaveLength(2);

    const gradientIds = gradients.map((gradient) => gradient.getAttribute('id'));
    expect(gradientIds[0]).toBeTruthy();
    expect(gradientIds[1]).toBeTruthy();
    expect(gradientIds[0]).not.toEqual(gradientIds[1]);

    const fills = Array.from(container.querySelectorAll('path[fill^="url(#"]')).map((path) =>
      path.getAttribute('fill'),
    );
    expect(fills).toEqual([`url(#${gradientIds[0]})`, `url(#${gradientIds[1]})`]);
  });
});

describe('SiteLogoWithName', () => {
  it('renders the brand name and tagline', () => {
    render(<SiteLogoWithName />);

    expect(screen.getByText('ICONIC Academy')).toBeInTheDocument();
    expect(screen.getByText('Turn effort into outcomes')).toBeInTheDocument();
  });
});
