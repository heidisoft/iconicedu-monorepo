import * as React from 'react';
import { usePortalContainer } from '../ui/portal-container';

const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
  const portalContainer = usePortalContainer();
  const ownerWindow = portalContainer?.ownerDocument.defaultView;
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const view = ownerWindow ?? window;
    const mql = view.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(view.innerWidth < MOBILE_BREAKPOINT);
    };
    mql.addEventListener('change', onChange);
    setIsMobile(view.innerWidth < MOBILE_BREAKPOINT);
    return () => mql.removeEventListener('change', onChange);
  }, [ownerWindow]);

  return !!isMobile;
}

export function useHasHydrated() {
  const [hasHydrated, setHasHydrated] = React.useState(false);

  React.useEffect(() => {
    setHasHydrated(true);
  }, []);

  return hasHydrated;
}
