"use client";

import { useSyncExternalStore } from "react";
import {
  Authenticated,
  AuthLoading,
  Unauthenticated,
} from "convex/react";

import { AuthLoadingView } from "./auth-loading-view";
import { UnauthenticatedView } from "./unauthenticated-view";

const noopSubscribe = () => () => {};

/**
 * Prevent authenticated Convex queries from mounting until Convex has accepted
 * Clerk's JWT. Keeping this boundary inside the page (instead of around the
 * root provider's children) also ensures every App Router segment remains in
 * the prerendered tree for Next.js instant-navigation validation.
 */
export const ConvexAuthBoundary = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  // Hydrate with the server's markup (it has no Convex auth, so it renders the
  // loading view). A boundary that streams in late, like /admin's after its
  // Convex check, can hydrate after the client's auth has settled and would
  // otherwise mismatch. Client-side navigations skip this.
  const isHydrated = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  if (!isHydrated) return <AuthLoadingView />;

  return (
    <>
      <Authenticated>{children}</Authenticated>
      <Unauthenticated>
        <UnauthenticatedView />
      </Unauthenticated>
      <AuthLoading>
        <AuthLoadingView />
      </AuthLoading>
    </>
  );
};
