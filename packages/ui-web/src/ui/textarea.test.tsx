import { createRef } from 'react';
import { act, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Textarea } from './textarea';

describe('Textarea', () => {
  it('forwards the textarea ref', async () => {
    const ref = createRef<HTMLTextAreaElement>();

    await act(async () => {
      render(<Textarea ref={ref} defaultValue="Hello" />);
      await Promise.resolve();
    });

    expect(ref.current).toBeInstanceOf(HTMLTextAreaElement);
    expect(ref.current?.value).toBe('Hello');
  });
});
