"use client";

import { CircleAlertIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

import { type PlatformModelDraft, usePlatformModelDraft } from "../hooks/use-platform-model-draft";
import type { PlatformProviderId } from "../platform-models";
import { AddModelsCard } from "./add-models-card";
import { PlatformModelsCard } from "./platform-models-card";

/** Docked to the bottom of the viewport while the selection has unsaved edits. */
const SaveBar = ({ draft }: { draft: PlatformModelDraft }) => {
  const blocked = draft.problems.length > 0;

  return (
    <>
      {/* Reserves the bar's height so the end of the page can scroll clear of it. */}
      <div aria-hidden="true" className="h-28 sm:h-16" />
      <div
        role="region"
        aria-label="Unsaved changes"
        className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80"
      >
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 text-sm">
            <p className="font-medium">Unsaved changes</p>
            {blocked && (
              <p className="flex items-center gap-1.5 text-xs text-destructive">
                <CircleAlertIcon className="size-3.5 shrink-0" aria-hidden="true" />
                {draft.problems.join(" · ")}
              </p>
            )}
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant="outline" size="sm" className="flex-1 sm:flex-none" onClick={draft.discard}>
              Discard
            </Button>
            <Button size="sm" className="flex-1 sm:flex-none" onClick={draft.save} disabled={blocked}>
              Save changes
            </Button>
          </div>
        </div>
      </div>
    </>
  );
};

export const ModelsTab = ({
  provider,
  providerLabel,
}: {
  provider: PlatformProviderId;
  providerLabel: string;
}) => {
  const draft = usePlatformModelDraft(provider);

  return (
    <>
      <PlatformModelsCard draft={draft} provider={provider} />
      <AddModelsCard draft={draft} providerLabel={providerLabel} />
      {draft.isDirty && <SaveBar draft={draft} />}
    </>
  );
};
