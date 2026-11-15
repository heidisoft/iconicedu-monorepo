'use client';
import { createContext, useContext } from 'react';
import type { LiveSessionJoinLinkVM } from '@iconicedu/shared-types';
export const LiveSessionJoinContext = createContext<{
  joinChannel: (channelId: string) => Promise<LiveSessionJoinLinkVM>;
  resolveLink: (href: string) => Promise<LiveSessionJoinLinkVM | null>;
} | null>(null);
export const useLiveSessionJoinContext = () => useContext(LiveSessionJoinContext);
