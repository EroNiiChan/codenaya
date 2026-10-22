import { CircleAlertIcon, CircleCheckIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export interface PlatformStatus {
  providerLabel: string;
  keyEnvVar: string;
  keyConfigured: boolean;
}

/** Which provider the platform key runs on, and whether its key is set. Server-rendered. */
export const ProviderStatusCard = ({ providerLabel, keyEnvVar, keyConfigured }: PlatformStatus) => (
  <Card>
    <CardHeader>
      <CardTitle>{providerLabel}</CardTitle>
      <CardDescription>
        The active platform provider, from <code className="font-mono text-xs">NEXT_PUBLIC_AI_PROVIDER</code>.
        Switching it means changing that variable in Infisical and redeploying.
      </CardDescription>
    </CardHeader>
    <CardContent>
      {keyConfigured ? (
        <p className="flex items-center gap-2 text-sm">
          <CircleCheckIcon className="size-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
          <span>
            <code className="font-mono text-xs">{keyEnvVar}</code> is configured
          </span>
        </p>
      ) : (
        <Alert variant="destructive">
          <CircleAlertIcon aria-hidden="true" />
          <AlertTitle>{keyEnvVar} is not set</AlertTitle>
          <AlertDescription>
            Users can&apos;t run the agent on the Codenaya key, and models can&apos;t be
            fetched. Add it in Infisical and redeploy.
          </AlertDescription>
        </Alert>
      )}
    </CardContent>
  </Card>
);
