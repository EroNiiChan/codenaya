import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import type { FunctionArgs, FunctionReturnType } from "convex/server";
import { toast } from "sonner";

import { convexErrorMessage } from "@/lib/convex-error";

import { api } from "../../../../convex/_generated/api";
import {
  type FetchedModel,
  MAX_USD_PER_MTOK,
  type PlatformProviderId,
} from "../platform-models";

/**
 * The /admin editor's unsaved copy of the platform model selection. Prices are
 * kept as typed text so an empty input stays empty (unpriced) instead of
 * becoming 0. `tools: null` means the provider didn't say, and Save stays
 * blocked until the admin confirms it.
 */

type SavedConfig = NonNullable<FunctionReturnType<typeof api.platformModels.getForAdmin>>;
type SaveArgs = FunctionArgs<typeof api.platformModels.save>;

export interface DraftModel {
  id: string;
  name: string;
  vendor: string;
  contextLength?: number;
  vision: boolean;
  tools: "reported" | "confirmed" | null;
  input: string;
  output: string;
}

export interface Draft {
  models: DraftModel[];
  defaultModelId: string;
}

/** USD per 1M tokens from an input, or null when empty or out of range. */
export function parsePrice(text: string): number | null {
  if (!text.trim()) return null;
  const value = Number(text);
  return Number.isFinite(value) && value >= 0 && value <= MAX_USD_PER_MTOK ? value : null;
}

export const isPriced = (model: DraftModel) =>
  parsePrice(model.input) !== null && parsePrice(model.output) !== null;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** Why the draft can't be saved yet, empty when it can. */
export function draftProblems(draft: Draft): string[] {
  if (draft.models.length === 0) return ["Add at least one model"];
  const unpriced = draft.models.filter((m) => !isPriced(m)).length;
  const unconfirmed = draft.models.filter((m) => m.tools === null).length;
  return [
    unpriced && `Set both prices for ${plural(unpriced, "model")}`,
    unconfirmed && `Confirm tool calling for ${plural(unconfirmed, "model")}`,
  ].filter((problem): problem is string => !!problem);
}

const toDraft = (config: SavedConfig | null): Draft => ({
  models: (config?.models ?? []).map(({ inputUsdPerMTok, outputUsdPerMTok, ...model }) => ({
    ...model,
    input: String(inputUsdPerMTok),
    output: String(outputUsdPerMTok),
  })),
  defaultModelId: config?.defaultModelId ?? "",
});

/** A fetched model as a draft row. Callers never pass `tools: false` rows. */
export const fromFetched = (model: FetchedModel, provider: PlatformProviderId): DraftModel => ({
  id: model.id,
  name: model.name,
  vendor: model.vendor,
  contextLength: model.contextLength,
  // Unknown vision stays off: a wrong "on" would send images a model can't read.
  vision: provider !== "anthropic" && model.vision === true,
  tools: model.tools ? "reported" : null,
  input: model.inputUsdPerMTok === undefined ? "" : String(model.inputUsdPerMTok),
  output: model.outputUsdPerMTok === undefined ? "" : String(model.outputUsdPerMTok),
});

/** The mutation args for a draft with no `draftProblems`. */
export const toSaveArgs = (provider: PlatformProviderId, draft: Draft): SaveArgs => ({
  provider,
  defaultModelId: draft.defaultModelId,
  models: draft.models.map(({ input, output, tools, contextLength, ...model }) => ({
    ...model,
    ...(contextLength === undefined ? {} : { contextLength }),
    tools: tools ?? "confirmed",
    inputUsdPerMTok: parsePrice(input)!,
    outputUsdPerMTok: parsePrice(output)!,
  })),
});

export function usePlatformModelDraft(provider: PlatformProviderId) {
  const saved = useQuery(api.platformModels.getForAdmin, { provider });
  const [edited, setEdited] = useState<Draft | null>(null);
  const saveMutation = useMutation(api.platformModels.save).withOptimisticUpdate(
    (store, args) => {
      store.setQuery(
        api.platformModels.getForAdmin,
        { provider: args.provider },
        { models: args.models, defaultModelId: args.defaultModelId },
      );
    },
  );

  const draft = edited ?? (saved === undefined ? undefined : toDraft(saved));

  const edit = (change: (draft: Draft) => Draft) => {
    if (draft) setEdited(change(draft));
  };

  const add = (models: FetchedModel[]) =>
    edit((d) => {
      const ids = new Set(d.models.map((m) => m.id));
      const added = models.filter((m) => !ids.has(m.id)).map((m) => fromFetched(m, provider));
      const all = [...d.models, ...added];
      return { models: all, defaultModelId: d.defaultModelId || all[0]?.id || "" };
    });

  const remove = (id: string) =>
    edit((d) => {
      const models = d.models.filter((m) => m.id !== id);
      const defaultModelId = d.defaultModelId === id ? (models[0]?.id ?? "") : d.defaultModelId;
      return { models, defaultModelId };
    });

  const update = (id: string, patch: Partial<DraftModel>) =>
    edit((d) => ({ ...d, models: d.models.map((m) => (m.id === id ? { ...m, ...patch } : m)) }));

  const setDefault = (defaultModelId: string) => edit((d) => ({ ...d, defaultModelId }));

  const save = async () => {
    if (!edited || draftProblems(edited).length > 0) return;
    // Optimistic: the saved query shows the new selection at once; a failure
    // rolls it back and restores the draft so nothing typed is lost.
    setEdited(null);
    try {
      await saveMutation(toSaveArgs(provider, edited));
      toast.success("Models saved. Users see the new list now.");
    } catch (error) {
      setEdited(edited);
      toast.error(convexErrorMessage(error, "Couldn't save the models. Try again."));
    }
  };

  return {
    draft,
    hasSaved: !!saved,
    isDirty: edited !== null,
    problems: draft ? draftProblems(draft) : [],
    add,
    remove,
    update,
    setDefault,
    discard: () => setEdited(null),
    save,
  };
}

export type PlatformModelDraft = ReturnType<typeof usePlatformModelDraft>;
