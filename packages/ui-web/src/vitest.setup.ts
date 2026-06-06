import '@testing-library/jest-dom/vitest';

// React 19 + Vitest requires this flag to ensure updates are flushed in `act`.
if (typeof globalThis !== 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
}

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
