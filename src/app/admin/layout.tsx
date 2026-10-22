import { notFound } from "next/navigation";
import { Suspense } from "react";

import { AppNavbar } from "@/components/app-navbar";
import { AuthLoadingView } from "@/features/auth/components/auth-loading-view";
import { ConvexAuthBoundary } from "@/features/auth/components/convex-auth-boundary";
import { adminOrNull } from "@/features/admin/server/require-admin";

// Blocks on the session like the settings pages; see `instant` there.
export const instant = false;

const AdminContent = async ({ children }: { children: React.ReactNode }) => {
  // Signed out, not the admin and unverified all get the same 404, with no
  // sign-in redirect, so /admin looks like any missing page. Every admin
  // Convex function and route checks again on its own.
  if (!(await adminOrNull())) notFound();

  return (
    <ConvexAuthBoundary>
      <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 lg:py-10">{children}</main>
    </ConvexAuthBoundary>
  );
};

const AdminLayout = ({ children }: { children: React.ReactNode }) => (
  <div className="flex min-h-screen flex-col bg-background">
    <AppNavbar />
    <Suspense fallback={<AuthLoadingView />}>
      <AdminContent>{children}</AdminContent>
    </Suspense>
  </div>
);

export default AdminLayout;
