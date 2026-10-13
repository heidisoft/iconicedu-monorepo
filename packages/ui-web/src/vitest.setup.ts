import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => {
  cleanup();
});

// React 19 + Vitest requires this flag to ensure updates are flushed in `act`.
if (typeof globalThis !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
}

// jsdom defines window.scrollTo but makes it throw "Not implemented" when
// called (it's a real function reference, so `if (!window.scrollTo)` guards
// like the ones below never catch it — this one has to be unconditional).
// framer-motion's keyframes resolver calls it while measuring exit-animation
// targets (AnimatePresence), and that uncaught error silently aborts the
// animation before its completion callback ever fires. That left elements
// under an animated unmount (e.g. session-completed-carousel's dismiss/rate
// flows) stuck in the DOM forever in tests, not just slow to disappear.
window.scrollTo = (() => undefined) as typeof window.scrollTo;

// jsdom does no real layout, so every element reports a zero-size rect.
// framer-motion's `height: 'auto'` animate/exit targets (used throughout
// this package for collapsing sections) measure the "auto" height via
// getBoundingClientRect before tweening to/from it — with every measurement
// coming back 0, the animation has no real distance to cover and the
// underlying motion-dom scheduler never resolves its completion promise,
// so AnimatePresence's post-exit unmount never fires.
Element.prototype.getBoundingClientRect = function stubGetBoundingClientRect(
  this: Element,
) {
  return {
    width: 320,
    height: 240,
    top: 0,
    left: 0,
    right: 320,
    bottom: 240,
    x: 0,
    y: 0,
    toJSON() {
      return this;
    },
  } satisfies DOMRect;
};

if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
}

if (!window.IntersectionObserver) {
  class MockIntersectionObserver implements IntersectionObserver {
    readonly root: Element | null = null;
    readonly rootMargin: string = '';
    readonly thresholds: ReadonlyArray<number> = [];

    disconnect() {
      return undefined;
    }

    observe() {
      return undefined;
    }

    takeRecords(): IntersectionObserverEntry[] {
      return [];
    }

    unobserve() {
      return undefined;
    }
  }

  window.IntersectionObserver = MockIntersectionObserver;
  globalThis.IntersectionObserver = MockIntersectionObserver;
}

if (!window.ResizeObserver) {
  class MockResizeObserver implements ResizeObserver {
    observe() {
      return undefined;
    }

    unobserve() {
      return undefined;
    }

    disconnect() {
      return undefined;
    }
  }

  window.ResizeObserver = MockResizeObserver;
  globalThis.ResizeObserver = MockResizeObserver;
}
