import React from 'react';
import { render } from '@testing-library/react';

import { Calendar } from './calendar';

describe('Calendar', () => {
  it('renders the calendar root slot', () => {
    const { container } = render(<Calendar mode="single" />);

    expect(container.querySelector('[data-slot="calendar"]')).toBeInTheDocument();
  });
});
