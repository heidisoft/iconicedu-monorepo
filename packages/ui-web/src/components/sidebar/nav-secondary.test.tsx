import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LifeBuoy } from 'lucide-react';

import { NavSecondary } from './nav-secondary';
import { SidebarProvider } from '@iconicedu/ui-web/ui/sidebar';

const SUPPORT_HIGHLIGHT_CLASS = 'bg-amber-50/85';

describe('NavSecondary', () => {
  it('renders support item without live support tooltip copy', () => {
    render(
      <SidebarProvider>
        <NavSecondary
          items={[
            {
              title: 'Live Support',
              url: '/iconic-academy/c/support-1',
              icon: LifeBuoy,
            },
          ]}
        />
      </SidebarProvider>,
    );

    expect(
      screen.queryByText(
        /Ask us anything in real time: classes, schedules, reschedules, cancellations, and payments\./i,
      ),
    ).not.toBeInTheDocument();
  });

  it('applies support highlight styling in expanded render state', () => {
    const { container } = render(
      <SidebarProvider>
        <NavSecondary
          items={[
            {
              title: 'Live Support',
              url: '/iconic-academy/c/support-1',
              icon: LifeBuoy,
            },
          ]}
        />
      </SidebarProvider>,
    );

    const supportLink = screen.getByRole('link', { name: /Live Support/i });
    const button = supportLink.closest('[data-sidebar="menu-button"]');
    expect(button).not.toBeNull();
    expect(button).toHaveClass(SUPPORT_HIGHLIGHT_CLASS);

    expect(container.querySelector('[data-sidebar="tooltip-content"]')).toBeNull();
  });

  it('keeps support highlight styling in icon-collapsed render context', () => {
    render(
      <div className="group" data-collapsible="icon">
        <SidebarProvider>
          <NavSecondary
            items={[
              {
                title: 'Live Support',
                url: '/iconic-academy/c/support-1',
                icon: LifeBuoy,
              },
            ]}
          />
        </SidebarProvider>
      </div>,
    );

    const supportLink = screen.getByRole('link', { name: /Live Support/i });
    const button = supportLink.closest('[data-sidebar="menu-button"]');
    expect(button).not.toBeNull();
    expect(button).toHaveClass(SUPPORT_HIGHLIGHT_CLASS);
  });
});
