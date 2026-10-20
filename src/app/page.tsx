import { auth } from "@clerk/nextjs/server";
import { Suspense } from "react";

import { AppNavbar } from "@/components/app-navbar";
import { LandingPage } from "@/components/landing/landing-page";
import { AuthLoadingView } from "@/features/auth/components/auth-loading-view";
import { ConvexAuthBoundary } from "@/features/auth/components/convex-auth-boundary";
import { ProjectsView } from "@/features/projects/components/projects-view";
import { parseGithubRepo } from "@/features/projects/utils/github-repo";

type HomeProps = {
  searchParams: Promise<{ import?: string | string[] }>;
};

const HomeContent = async ({ searchParams }: HomeProps) => {
  const { userId } = await auth();

  if (!userId) {
    return <LandingPage />;
  }

  // Set by /import for an "Open in Codenaya" link (#231).
  const { import: repo } = await searchParams;

  return (
    <ConvexAuthBoundary>
      <div className="h-screen flex flex-col overflow-hidden">
        <AppNavbar />
        <div className="flex-1 min-h-0 overflow-hidden">
          <ProjectsView linkedRepo={typeof repo === "string" ? parseGithubRepo(repo) : null} />
        </div>
      </div>
    </ConvexAuthBoundary>
  );
};

const Home = (props: HomeProps) => {
  return (
    <Suspense fallback={<AuthLoadingView />}>
      <HomeContent {...props} />
    </Suspense>
  );
};

export default Home;
