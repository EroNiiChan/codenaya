"use client";

import { CircleAlertIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

import { type PlatformModelDraft, usePlatformModelDraft } from "../hooks/use-platform-model-draft";
import type { PlatformProviderId } from "../platform-models";
import { AddModelsCard } from "./add-models-card";
import { PlatformModelsCard } from "./platform-models-card";

/** Sticks to the bottom of the viewport while the selection has unsaved edits. */
const SaveBar = ({ draft }: { draft: PlatformModelDraft }) => {
  const blocked = draft.problems.length > 0;

  return (
    <div
      role="region"
      aria-label="Unsaved changes"
      className="sticky bottom-4 z-10 flex flex-col gap-3 rounded-lg border bg-background/95 p-3 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/80 sm:flex-row sm:items-center sm:justify-between"
    >
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
