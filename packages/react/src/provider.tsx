'use client';

import React, { createContext, useContext, useMemo } from 'react';
import { Clndr } from '@clndr-pro/sdk';

interface ClndrContextValue {
  client: Clndr;
}

const Ctx = createContext<ClndrContextValue | null>(null);

export interface ClndrProviderProps {
  /** Publishable key (`clndr_pk_...`) for browser use. */
  publishableKey?: string;
  /**
   * Already-configured client (custom `fetch`, tests). It has to be created
   * on the client side: a class instance can't be passed as a prop from a
   * Server Component.
   */
  client?: Clndr;
  /** Override the API base URL. Defaults to https://www.clndr.pro. */
  baseUrl?: string;
  children: React.ReactNode;
}

/**
 * Wrap your app with `<ClndrProvider publishableKey="clndr_pk_...">`. All
 * components read the client from context.
 *
 * For the Next.js App Router: render it from a small `'use client'` file
 * (e.g. `app/providers.tsx`) and use that in your root layout, so the layout
 * itself stays a Server Component. Since 0.2.1 the package entry is marked
 * `"use client"`, so `<BookingInline>` etc. can be imported straight into
 * Server Components.
 */
export function ClndrProvider({ publishableKey, client, baseUrl, children }: ClndrProviderProps) {
  const value = useMemo<ClndrContextValue>(() => {
    if (client) return { client };
    if (!publishableKey) {
      throw new Error('ClndrProvider: either `publishableKey` or `client` is required');
    }
    return { client: new Clndr({ apiKey: publishableKey, baseUrl }) };
  }, [client, publishableKey, baseUrl]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useClndr(): Clndr {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useClndr must be used inside <ClndrProvider>');
  return ctx.client;
}
