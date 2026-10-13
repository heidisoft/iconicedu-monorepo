import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SharedContentSurface } from './shared-content-surface';
afterEach(() => vi.restoreAllMocks());
describe('SharedContentSurface', () => {
  it('gives renderer and overlay exactly the aspect-fitted inner rectangle', () => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1000);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(800);
    const { container, rerender } = render(
      <SharedContentSurface
        source={{ width: 1920, height: 1080 }}
        overlay={(size) => (
          <output data-testid="size">
            {size.width}:{size.height}
          </output>
        )}
      >
        <canvas data-testid="renderer" />
      </SharedContentSurface>,
    );
    expect(container.querySelector('[data-shared-content-bounds]')).toHaveStyle({
      left: '0px',
      top: '118.75px',
      width: '1000px',
      height: '562.5px',
    });
    expect(screen.getByTestId('size')).toHaveTextContent('1000:562.5');
    expect(screen.getByTestId('renderer').parentElement).toBe(
      screen.getByTestId('size').parentElement,
    );
    rerender(
      <SharedContentSurface
        source={{ width: 1000, height: 1000 }}
        overlay={(size) => (
          <output data-testid="size">
            {size.width}:{size.height}
          </output>
        )}
      >
        <canvas />
      </SharedContentSurface>,
    );
    expect(container.querySelector('[data-shared-content-bounds]')).toHaveStyle({
      left: '100px',
      top: '0px',
      width: '800px',
      height: '800px',
    });
  });
  it('keeps SDK children mounted before the container becomes measurable', () => {
    const overlay = vi.fn();
    render(
      <SharedContentSurface source={{ width: 1920, height: 1080 }} overlay={overlay}>
        <video data-testid="sdk-target" />
      </SharedContentSurface>,
    );
    expect(screen.getByTestId('sdk-target')).toBeInTheDocument();
    expect(overlay).not.toHaveBeenCalled();
  });
});
