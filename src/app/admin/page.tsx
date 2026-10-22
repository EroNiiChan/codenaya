import type { Metadata } from "next";
import { connection } from "next/server";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AuditLogCard } from "@/features/admin/components/audit-log-card";
import { ModelsTab } from "@/features/admin/components/models-tab";
import {
  ENV_PLATFORM_PROVIDER,
  PLATFORM_PROVIDERS,
  platformKeyOrNull,
} from "@/features/admin/server/platform-keys";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };

// Blocks on the session in the admin layout; see `instant` there.
export const instant = false;

const AdminPage = async () => {
  // Read the env per request, not baked in at build.
  await connection();
  // Only whether each key is set reaches the browser, never the key.
  const providers = PLATFORM_PROVIDERS.map((p) => ({
    ...p,
    keyConfigured: platformKeyOrNull(p.id) !== null,
  }));

  return (
    <>
      <header className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight">Admin</h1>
        <p className="text-sm text-muted-foreground">
          The AI provider and models behind the Codenaya key.
        </p>
      </header>

      <Tabs defaultValue="models" className="gap-6">
        <TabsList>
          <TabsTrigger value="models">Models</TabsTrigger>
          <TabsTrigger value="audit">Audit log</TabsTrigger>
        </TabsList>
        <TabsContent value="models" className="space-y-6">
          <ModelsTab providers={providers} fallbackProvider={ENV_PLATFORM_PROVIDER} />
        </TabsContent>
        <TabsContent value="audit">
          <AuditLogCard />
        </TabsContent>
      </Tabs>
    </>
  );
};

export default AdminPage;
