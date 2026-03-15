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
  it('uses unique gradient ids and keeps all fill references valid', () => {
    const { container } = render(
      <>
        <SiteLogoFull />
        <SiteLogoFull />
      </>,
    );

    const gradients = Array.from(container.querySelectorAll('linearGradient'));
    expect(gradients).toHaveLength(16);

    const gradientIds = gradients.map((gradient) => gradient.getAttribute('id'));
    expect(gradientIds.every(Boolean)).toBe(true);
    expect(new Set(gradientIds).size).toBe(gradientIds.length);

    const fills = Array.from(container.querySelectorAll('path[fill^="url(#"]')).map(
      (path) => path.getAttribute('fill'),
    );
    expect(fills).toHaveLength(16);
    for (const fill of fills) {
      expect(fill).toBeTruthy();
      const fillId = fill?.replace('url(#', '').replace(')', '');
      expect(gradientIds).toContain(fillId);
    }
  });

  it('defaults to proportional sizing and theme-aware fill', () => {
    const { container } = render(<SiteLogoFull />);

    const svg = container.querySelector('svg');
    expect(svg).toHaveClass('h-8');
    expect(svg).toHaveClass('w-auto');

    const baseLayer = container.querySelector('g[data-name="Layer 1"]');
    expect(baseLayer?.getAttribute('fill')).toBe('currentColor');
  });
});

describe('SiteLogoWithName', () => {
  it('renders the brand name and tagline', () => {
    render(<SiteLogoWithName />);

    expect(screen.getByText('ICONIC Academy')).toBeInTheDocument();
    expect(screen.getByText('Turn effort into outcomes')).toBeInTheDocument();
  });

  it('includes collapsed-state classes to keep only the icon visible', () => {
    const { container } = render(<SiteLogoWithName />);

    expect(container.firstElementChild?.className).toContain(
      'group-data-[collapsible=icon]:mx-auto',
    );
    expect(screen.getByText('ICONIC Academy').parentElement?.className).toContain(
      'group-data-[collapsible=icon]:hidden',
    );
  });
});
