import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LifeBuoy } from 'lucide-react';

const mockSidebar = () => {
  const React = require('react') as typeof import('react');

  const passthrough = (Tag: keyof React.JSX.IntrinsicElements) => {
    function Passthrough({ children, ...props }: { children?: React.ReactNode }) {
      return React.createElement(Tag, props, children);
    }

    return Passthrough;
  };

  return {
    SidebarProvider: passthrough('div'),
    SidebarGroup: passthrough('div'),
    SidebarGroupContent: passthrough('div'),
    SidebarMenu: passthrough('ul'),
    SidebarMenuItem: passthrough('li'),
    SidebarMenuButton: ({
      asChild,
      children,
      className,
      ...props
    }: {
      asChild?: boolean;
      children?: React.ReactNode;
      className?: string;
    }) => {
      const menuButtonProps = {
        ...props,
        'data-sidebar': 'menu-button',
        className,
      };

      if (asChild && React.isValidElement(children)) {
        return React.cloneElement(children, menuButtonProps);
      }

      return React.createElement('button', menuButtonProps, children);
    },
  };
};

const loadSubject = async () => {
  vi.doMock('@iconicedu/ui-web/ui/sidebar', mockSidebar);

  const [{ NavSecondary }, { SidebarProvider }] = await Promise.all([
    import('./nav-secondary'),
    import('@iconicedu/ui-web/ui/sidebar'),
  ]);

  return { NavSecondary, SidebarProvider };
};

const SUPPORT_HIGHLIGHT_CLASS = 'bg-warning/10';

describe('NavSecondary', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('renders support item without live support tooltip copy', async () => {
    const { NavSecondary, SidebarProvider } = await loadSubject();

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

  it('applies support highlight styling in expanded render state', async () => {
    const { NavSecondary, SidebarProvider } = await loadSubject();

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

  it('keeps support highlight styling in icon-collapsed render context', async () => {
    const { NavSecondary, SidebarProvider } = await loadSubject();

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
