import type { Metadata } from "next";
import { connection } from "next/server";

import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AuditLogCard } from "@/features/admin/components/audit-log-card";
import { ModelsTab } from "@/features/admin/components/models-tab";
import { ProviderStatusCard } from "@/features/admin/components/provider-status-card";
import { AI_PROVIDERS } from "@/features/ai-providers/registry";
import { isOpenRouterConfigured } from "@/lib/openrouter";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };

// Blocks on the session in the admin layout; see `instant` there.
export const instant = false;

const AdminPage = async () => {
  // Read the env per request, not baked in at build.
  await connection();
  const provider = "openrouter" as const;
  const status = {
    providerLabel: AI_PROVIDERS[provider].label,
    keyEnvVar: "OPENROUTER_API_KEY",
    keyConfigured: isOpenRouterConfigured(),
  };

  return (
    <>
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold tracking-tight">Admin</h1>
        <Badge variant="outline" className="gap-1.5">
          <span
            className={cn(
              "size-1.5 rounded-full",
              status.keyConfigured ? "bg-emerald-500" : "bg-destructive",
            )}
            aria-hidden="true"
          />
          {status.providerLabel}
          <span className="sr-only">
            {status.keyConfigured ? "(key configured)" : "(key missing)"}
          </span>
        </Badge>
      </header>

      <Tabs defaultValue="models" className="gap-6">
        <TabsList>
          <TabsTrigger value="models">Models</TabsTrigger>
          <TabsTrigger value="audit">Audit log</TabsTrigger>
        </TabsList>
        <TabsContent value="models" className="space-y-6">
          <ProviderStatusCard {...status} />
          <ModelsTab provider={provider} providerLabel={status.providerLabel} />
        </TabsContent>
        <TabsContent value="audit">
          <AuditLogCard />
        </TabsContent>
      </Tabs>
    </>
  );
};

export default AdminPage;
