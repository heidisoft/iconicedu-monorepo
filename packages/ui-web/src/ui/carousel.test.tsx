import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, vi } from 'vitest';

const { scrollPrev, scrollNext } = vi.hoisted(() => ({
  scrollPrev: vi.fn(),
  scrollNext: vi.fn(),
}));

const mockEmblaCarousel = () => {
  const api = {
    canScrollPrev: () => true,
    canScrollNext: () => true,
    scrollPrev,
    scrollNext,
    on: vi.fn(),
    off: vi.fn(),
  };

  return {
    __esModule: true,
    default: vi.fn(() => [vi.fn(), api]),
  };
};

const loadSubject = async () => {
  vi.doMock('embla-carousel-react', mockEmblaCarousel);
  return import('./carousel');
};

describe('Carousel', () => {
  beforeEach(() => {
    vi.resetModules();
    scrollPrev.mockClear();
    scrollNext.mockClear();
  });

  it('renders slides and handles controls', async () => {
    const { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } =
      await loadSubject();
    const user = userEvent.setup();

    render(
      <Carousel aria-label="Test carousel">
        <CarouselContent>
          <CarouselItem>Slide 1</CarouselItem>
          <CarouselItem>Slide 2</CarouselItem>
        </CarouselContent>
        <CarouselPrevious />
        <CarouselNext />
      </Carousel>,
    );

    expect(screen.getByRole('region', { name: 'Test carousel' })).toBeInTheDocument();
    expect(screen.getByText('Slide 1')).toBeInTheDocument();
    expect(screen.getByText('Slide 2')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Previous slide' }));
    await user.click(screen.getByRole('button', { name: 'Next slide' }));

    expect(scrollPrev).toHaveBeenCalledTimes(1);
    expect(scrollNext).toHaveBeenCalledTimes(1);
  });
});
