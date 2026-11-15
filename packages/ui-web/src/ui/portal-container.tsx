'use client';

import { createContext, useContext, type ReactNode } from 'react';

const PortalContainerContext = createContext<HTMLElement | undefined>(undefined);

/** Keeps menus and dialogs in the same window as their owning interface. */
export function PortalContainerProvider({
  container,
  children,
}: {
  container?: HTMLElement;
  children: ReactNode;
}) {
  return (
    <PortalContainerContext.Provider value={container}>
      {children}
    </PortalContainerContext.Provider>
  );
}

export function usePortalContainer() {
  return useContext(PortalContainerContext);
}
