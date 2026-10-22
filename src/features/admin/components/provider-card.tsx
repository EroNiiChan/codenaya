"use client";

import { useState } from "react";
import ky from "ky";
import { CircleAlertIcon, CircleCheckIcon, ZapIcon } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { aiProviderRequestError } from "@/features/ai-providers/hooks/use-ai-providers";

import type { PlatformProviderId } from "../platform-models";

/** A platform provider as the server sees it: never the key, only whether it's set. */
export interface PlatformProviderStatus {
  id: PlatformProviderId;
  label: string;
  keyEnvVar: string;
  keyConfigured: boolean;
}

interface ProviderCardProps {
  providers: PlatformProviderStatus[];
  activeProvider: PlatformProviderId;
  editing: PlatformProviderId;
  onEdit: (provider: PlatformProviderId) => void;
  /** Unsaved model edits lock the selector: switching would drop them. */
  isDirty: boolean;
  /** The edited provider has saved models, so it can be made active. */
  hasSavedModels: boolean;
}

/**
 * Picks which provider's models the page edits, and makes it the provider
 * every user runs on. Switching needs saved models and a configured key; the
 * server checks both again.
 */
export const ProviderCard = ({
  providers,
  activeProvider,
  editing,
  onEdit,
  isDirty,
  hasSavedModels,
}: ProviderCardProps) => {
  const [confirming, setConfirming] = useState(false);
  const [switching, setSwitching] = useState(false);
  const current = providers.find((p) => p.id === editing)!;
  const active = providers.find((p) => p.id === activeProvider)!;
  const isActive = editing === activeProvider;

  const makeActive = async () => {
    setSwitching(true);
    try {
      await ky.post("/api/admin/provider", { json: { provider: editing }, timeout: 20_000 });
      toast.success(`${current.label} is now the platform provider.`);
    } catch (error) {
      toast.error(await aiProviderRequestError(error));
    } finally {
      setSwitching(false);
    }
  };

  const blockedReason = !current.keyConfigured
    ? `${current.keyEnvVar} is not set`
    : !hasSavedModels
      ? `Save models for ${current.label} first`
      : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Platform provider</CardTitle>
        <CardDescription>
          Runs every request that doesn&apos;t use the user&apos;s own key. Pick a
          provider to set up its models, then make it active.
        </CardDescription>
        <CardAction>
          <Badge variant="outline" className="gap-1.5">
            <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
            Active: {active.label}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="space-y-1.5">
            <Label htmlFor="platform-provider">Provider</Label>
            <Select
              value={editing}
              onValueChange={(value) => onEdit(value as PlatformProviderId)}
              disabled={isDirty}
            >
              <SelectTrigger id="platform-provider" className="w-full sm:w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {providers.map((p) => (
                  <SelectItem key={p.id} value={p.id} disabled={!p.keyConfigured}>
                    {p.label}
                    {p.id === activeProvider && <span className="text-muted-foreground"> · active</span>}
                    {!p.keyConfigured && (
                      <span className="text-muted-foreground"> · {p.keyEnvVar} not set</span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {!isActive && (
            <Button
              onClick={() => setConfirming(true)}
              disabled={!!blockedReason || switching || isDirty}
              className="sm:ml-auto"
            >
              {switching ? <Spinner /> : <ZapIcon aria-hidden="true" />}
              Make {current.label} active
            </Button>
          )}
        </div>

        {isDirty && (
          <p className="text-xs text-muted-foreground">Save or discard your changes to switch providers.</p>
        )}
        {current.keyConfigured ? (
          <p className="flex items-center gap-2 text-sm">
            <CircleCheckIcon className="size-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
            <span>
              <code className="font-mono text-xs">{current.keyEnvVar}</code> is configured
            </span>
          </p>
        ) : (
          <p className="flex items-center gap-2 text-sm text-destructive">
            <CircleAlertIcon className="size-4" aria-hidden="true" />
            <span>
              <code className="font-mono text-xs">{current.keyEnvVar}</code> is not set. Add it in
              Infisical and redeploy.
            </span>
          </p>
        )}
        {!isActive && blockedReason && current.keyConfigured && (
          <p className="text-xs text-muted-foreground">{blockedReason} to make it active.</p>
        )}
      </CardContent>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Switch every user to {current.label}?</AlertDialogTitle>
            <AlertDialogDescription>
              New runs on the Codenaya key use {current.label} and its models right away.
              Chats that picked a {active.label} model run on {current.label}&apos;s
              default instead. Users on their own keys aren&apos;t affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={makeActive}>Switch to {current.label}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};
