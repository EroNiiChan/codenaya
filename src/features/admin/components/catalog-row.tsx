"use client";

import { useId, useState } from "react";
import { CircleAlertIcon, CircleCheckIcon, RouteIcon, Trash2Icon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { TableCell, TableRow } from "@/components/ui/table";
import type { ModelAccess } from "@/features/ai-providers/catalog";

import { type DraftModel, parsePrice, togglePriceMode } from "../catalog-draft";
import { adminPostErrorMessage, useAdminPost } from "../hooks/use-admin-post";
import type { CatalogDraft } from "../hooks/use-catalog-draft";
import type { PlatformProviderId } from "../platform-models";

const ACCESS_LABELS: Record<ModelAccess, string> = {
  everyone: "Everyone",
  promo_counted: "Promo · counted runs",
  promo_unlimited: "Promo · unlimited",
};

const PriceInput = ({ value, label, onChange }: { value: string; label: string; onChange: (value: string) => void }) => (
  <InputGroup className="h-8 w-28">
    <InputGroupAddon>
      <InputGroupText>$</InputGroupText>
    </InputGroupAddon>
    <InputGroupInput
      type="number"
      inputMode="decimal"
      min={0}
      step="any"
      placeholder="Set"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-invalid={parsePrice(value) === null}
      aria-label={label}
    />
    <InputGroupAddon align="inline-end">
      <InputGroupText>/M</InputGroupText>
    </InputGroupAddon>
  </InputGroup>
);

/** One blended number, or input and output apart behind "Advanced". */
const PriceCell = ({ model, draft }: { model: DraftModel; draft: CatalogDraft }) => {
  const set = (patch: Partial<DraftModel>) => draft.update(model.id, { ...patch, isReferencePrice: false });
  const split = model.priceMode === "split";
  return (
    <div className="space-y-1">
      {split ? (
        <div className="flex gap-2">
          <PriceInput value={model.input} label={`${model.name} input price, USD per 1M tokens`} onChange={(input) => set({ input })} />
          <PriceInput value={model.output} label={`${model.name} output price, USD per 1M tokens`} onChange={(output) => set({ output })} />
        </div>
      ) : (
        <PriceInput value={model.price} label={`${model.name} price, USD per 1M tokens`} onChange={(price) => set({ price })} />
      )}
      <div className="flex items-center gap-2">
        <Button
          variant="link"
          className="h-auto p-0 text-xs text-muted-foreground"
          // Pressed: input and output priced apart.
          aria-pressed={split}
          aria-label={`Advanced pricing for ${model.name}`}
          onClick={() => draft.update(model.id, togglePriceMode(model))}
        >
          Advanced
        </Button>
        {model.isReferencePrice && (
          <Badge variant="outline" title="OpenRouter's price for this model. Check the provider's own price.">
            reference
          </Badge>
        )}
      </div>
    </div>
  );
};

const ToolsControl = ({ model, draft }: { model: DraftModel; draft: CatalogDraft }) => {
  const id = useId();
  if (model.tools === "reported") return <Badge variant="secondary">Reported</Badge>;
  return (
    <div className="flex items-center gap-2">
      <Checkbox
        id={id}
        checked={model.tools === "confirmed"}
        onCheckedChange={(checked) => draft.update(model.id, { tools: checked === true ? "confirmed" : null })}
        aria-invalid={model.tools === null}
      />
      <Label htmlFor={id} className="text-xs font-normal whitespace-nowrap">
        Supports tools
      </Label>
    </div>
  );
};

type TestState = { status: "idle" | "running" } | { status: "ok"; latencyMs: number } | { status: "error"; error: string };

/** Sends a tiny request through the model's route (`POST /api/admin/catalog/test`). */
const TestButton = ({ model }: { model: DraftModel }) => {
  const [state, setState] = useState<TestState>({ status: "idle" });
  const post = useAdminPost<
    { provider: PlatformProviderId; providerModelId: string },
    { ok: true; latencyMs: number } | { ok: false; error: string }
  >("/api/admin/catalog/test");

  const run = async () => {
    setState({ status: "running" });
    try {
      const result = await post({ provider: model.provider, providerModelId: model.providerModelId });
      setState(result.ok ? { status: "ok", latencyMs: result.latencyMs } : { status: "error", error: result.error });
    } catch (error) {
      setState({ status: "error", error: adminPostErrorMessage(error) });
    }
  };

  return (
    <div className="w-36 space-y-1">
      <Button variant="outline" size="sm" onClick={run} disabled={state.status === "running"} aria-label={`Test ${model.name}'s route`}>
        {state.status === "running" && <Spinner />}
        Test
      </Button>
      <p role="status" className="text-xs">
        {state.status === "ok" && (
          <span className="flex items-center gap-1 text-muted-foreground">
            <CircleCheckIcon className="size-3.5 shrink-0" aria-hidden="true" />
            OK · {state.latencyMs} ms
          </span>
        )}
        {state.status === "error" && (
          <span className="flex items-start gap-1 text-destructive" title={state.error}>
            <CircleAlertIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span className="line-clamp-3 break-words">{state.error}</span>
          </span>
        )}
      </p>
    </div>
  );
};

interface CatalogRowProps {
  model: DraftModel;
  draft: CatalogDraft;
  providerLabel: string;
  isDefault: boolean;
  isUtility: boolean;
  onReroute: () => void;
  onRemove: () => void;
}

export const CatalogRow = ({ model, draft, providerLabel, isDefault, isUtility, onReroute, onRemove }: CatalogRowProps) => {
  const forEveryone = model.access === "everyone";
  return (
    <TableRow className="align-top">
      <TableCell className="max-w-56">
        <div className="truncate font-medium">{model.name}</div>
        <div className="truncate font-mono text-xs text-muted-foreground">{model.id}</div>
      </TableCell>
      <TableCell>
        <div className="flex flex-col items-start gap-1">
          <Badge variant="secondary">{providerLabel}</Badge>
          {model.providerModelId !== model.id && (
            <span className="max-w-40 truncate font-mono text-xs text-muted-foreground" title={model.providerModelId}>
              {model.providerModelId}
            </span>
          )}
          <Button variant="link" className="h-auto gap-1 p-0 text-xs" onClick={onReroute} aria-label={`Change route for ${model.name}`}>
            <RouteIcon className="size-3" aria-hidden="true" />
            Change route
          </Button>
        </div>
      </TableCell>
      <TableCell>
        <PriceCell model={model} draft={draft} />
      </TableCell>
      <TableCell>
        <Switch
          checked={model.vision}
          // AgentKit's Anthropic adapter is text-only, so images can never reach it.
          disabled={model.provider === "anthropic"}
          onCheckedChange={(vision) => draft.update(model.id, { vision })}
          aria-label={`${model.name} accepts images`}
        />
      </TableCell>
      <TableCell>
        <ToolsControl model={model} draft={draft} />
      </TableCell>
      <TableCell>
        <Select value={model.access} onValueChange={(access) => draft.update(model.id, { access: access as ModelAccess })}>
          <SelectTrigger size="sm" className="w-44" aria-label={`Who can pick ${model.name}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(ACCESS_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell>
        <Switch
          checked={model.hidden}
          onCheckedChange={(hidden) => draft.update(model.id, { hidden })}
          aria-label={`Hide ${model.name} from users`}
        />
      </TableCell>
      {/* Native radios: one group per column across rows, arrow keys included. */}
      <TableCell>
        <input
          type="radio"
          name="default-model"
          className="size-4 accent-primary"
          checked={isDefault}
          disabled={!forEveryone || model.hidden}
          onChange={() => draft.setDefault(model.id)}
          aria-label={`Make ${model.name} the default`}
        />
      </TableCell>
      <TableCell>
        <input
          type="radio"
          name="utility-model"
          className="size-4 accent-primary"
          checked={isUtility}
          disabled={!forEveryone}
          onChange={() => draft.setUtility(model.id)}
          aria-label={`Use ${model.name} for titles and editor AI`}
        />
      </TableCell>
      <TableCell>
        <TestButton key={`${model.provider}:${model.providerModelId}`} model={model} />
      </TableCell>
      <TableCell>
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground hover:text-destructive"
          onClick={onRemove}
          aria-label={`Remove ${model.name}`}
        >
          <Trash2Icon />
        </Button>
      </TableCell>
    </TableRow>
  );
};
