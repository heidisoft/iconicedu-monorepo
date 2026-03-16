import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from './carousel';

const { scrollPrev, scrollNext } = vi.hoisted(() => ({
  scrollPrev: vi.fn(),
  scrollNext: vi.fn(),
}));

vi.mock('embla-carousel-react', () => {
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
});

describe('Carousel', () => {
  beforeEach(() => {
    scrollPrev.mockClear();
    scrollNext.mockClear();
  });

  it('renders slides and handles controls', async () => {
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
