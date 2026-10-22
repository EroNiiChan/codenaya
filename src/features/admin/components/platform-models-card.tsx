"use client";

import { useId, useState } from "react";
import { BoxesIcon, EyeIcon, Trash2Icon } from "lucide-react";

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
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemTitle,
} from "@/components/ui/item";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import {
  type DraftModel,
  type PlatformModelDraft,
  parsePrice,
} from "../hooks/use-platform-model-draft";
import { MAX_PLATFORM_MODELS, type PlatformProviderId } from "../platform-models";

const compact = new Intl.NumberFormat("en", { notation: "compact" });

/** "128K", or a dash when the provider didn't say. */
export const formatContext = (tokens?: number) => (tokens ? compact.format(tokens) : "—");

interface RowProps {
  model: DraftModel;
  provider: PlatformProviderId;
  draft: PlatformModelDraft;
}

const PriceInput = ({
  model,
  draft,
  side,
}: Omit<RowProps, "provider"> & { side: "input" | "output" }) => {
  const value = model[side];
  return (
    <InputGroup className="h-8 w-full min-w-24">
      <InputGroupAddon>
        <InputGroupText>$</InputGroupText>
      </InputGroupAddon>
      <InputGroupInput
        type="number"
        inputMode="decimal"
        min={0}
        step="any"
        placeholder="Set price"
        value={value}
        onChange={(e) => draft.update(model.id, { [side]: e.target.value })}
        aria-invalid={parsePrice(value) === null}
        aria-label={`${model.name} ${side} price, USD per 1M tokens`}
      />
      <InputGroupAddon align="inline-end">
        <InputGroupText>/M</InputGroupText>
      </InputGroupAddon>
    </InputGroup>
  );
};

const VisionSwitch = ({ model, provider, draft }: RowProps) => (
  <Switch
    checked={model.vision}
    // AgentKit's Anthropic adapter is text-only, so images can never reach it.
    disabled={provider === "anthropic"}
    onCheckedChange={(vision) => draft.update(model.id, { vision })}
    aria-label={`${model.name} accepts images`}
  />
);

const ToolsControl = ({ model, draft }: Omit<RowProps, "provider">) => {
  // Rendered in both the table and the stacked list, so ids must be unique.
  const id = useId();
  if (model.tools === "reported") return <Badge variant="secondary">Reported</Badge>;
  return (
    <div className="flex items-center gap-2">
      <Checkbox
        id={id}
        checked={model.tools === "confirmed"}
        onCheckedChange={(checked) =>
          draft.update(model.id, { tools: checked === true ? "confirmed" : null })
        }
        aria-invalid={model.tools === null}
      />
      <Label htmlFor={id} className="text-xs font-normal whitespace-nowrap">
        Supports tool calling
      </Label>
    </div>
  );
};

const RemoveButton = ({ model, onRemove }: { model: DraftModel; onRemove: () => void }) => (
  <Button
    variant="ghost"
    size="icon-sm"
    className="text-muted-foreground hover:text-destructive"
    onClick={onRemove}
    aria-label={`Remove ${model.name}`}
  >
    <Trash2Icon />
  </Button>
);

const ModelName = ({ model }: { model: DraftModel }) => (
  <div className="min-w-0">
    <div className="truncate font-medium">{model.name}</div>
    <div className="truncate font-mono text-xs text-muted-foreground">{model.id}</div>
  </div>
);

const LoadingRows = () => (
  <div className="space-y-2" aria-label="Loading models">
    {[0, 1, 2].map((i) => (
      <Skeleton key={i} className="h-12 w-full" />
    ))}
  </div>
);

export const PlatformModelsCard = ({
  draft,
  provider,
}: {
  draft: PlatformModelDraft;
  provider: PlatformProviderId;
}) => {
  const [pendingRemove, setPendingRemove] = useState<DraftModel | null>(null);
  const models = draft.draft?.models ?? [];
  const defaultId = draft.draft?.defaultModelId;

  const requestRemove = (model: DraftModel) => {
    if (model.id === defaultId && models.length > 1) setPendingRemove(model);
    else draft.remove(model.id);
  };

  const renderBody = () => {
    if (!draft.draft) return <LoadingRows />;
    if (models.length === 0) {
      return (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <BoxesIcon />
            </EmptyMedia>
            <EmptyTitle>No models configured</EmptyTitle>
            <EmptyDescription>
              Users see the built-in list. Fetch models below to choose your own.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      );
    }

    return (
      <>
        {/* Desktop: one row per model. */}
        <RadioGroup
          value={defaultId}
          onValueChange={draft.setDefault}
          aria-label="Default model"
          className="hidden lg:block"
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Default</TableHead>
                <TableHead>Model</TableHead>
                <TableHead className="w-20">Context</TableHead>
                <TableHead className="w-16">Vision</TableHead>
                <TableHead className="w-44">Tools</TableHead>
                <TableHead className="w-36">Input</TableHead>
                <TableHead className="w-36">Output</TableHead>
                <TableHead className="w-10">
                  <span className="sr-only">Remove</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {models.map((model) => (
                <TableRow key={model.id}>
                  <TableCell>
                    <RadioGroupItem value={model.id} aria-label={`Make ${model.name} the default`} />
                  </TableCell>
                  <TableCell className="max-w-64">
                    <ModelName model={model} />
                  </TableCell>
                  <TableCell className="tabular-nums">{formatContext(model.contextLength)}</TableCell>
                  <TableCell>
                    <VisionSwitch model={model} provider={provider} draft={draft} />
                  </TableCell>
                  <TableCell>
                    <ToolsControl model={model} draft={draft} />
                  </TableCell>
                  <TableCell>
                    <PriceInput model={model} draft={draft} side="input" />
                  </TableCell>
                  <TableCell>
                    <PriceInput model={model} draft={draft} side="output" />
                  </TableCell>
                  <TableCell>
                    <RemoveButton model={model} onRemove={() => requestRemove(model)} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </RadioGroup>

        {/* Mobile and tablet: one stacked item per model. */}
        <ItemGroup className="gap-2 lg:hidden">
          {models.map((model) => (
            <Item key={model.id} variant="outline" className="flex-col items-stretch gap-3">
              <div className="flex items-start gap-2">
                <ItemContent className="min-w-0">
                  <ItemTitle className="w-full">
                    <span className="truncate">{model.name}</span>
                  </ItemTitle>
                  <ItemDescription className="truncate font-mono text-xs">
                    {model.id} · {formatContext(model.contextLength)} context
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  {model.id === defaultId ? (
                    <Badge>Default</Badge>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => draft.setDefault(model.id)}>
                      Make default
                    </Button>
                  )}
                  <RemoveButton model={model} onRemove={() => requestRemove(model)} />
                </ItemActions>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Input</span>
                  <PriceInput model={model} draft={draft} side="input" />
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Output</span>
                  <PriceInput model={model} draft={draft} side="output" />
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <EyeIcon className="size-3.5" aria-hidden="true" />
                  Vision
                  <VisionSwitch model={model} provider={provider} draft={draft} />
                </div>
                <ToolsControl model={model} draft={draft} />
              </div>
            </Item>
          ))}
        </ItemGroup>
      </>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Available to users</CardTitle>
        <CardDescription>
          The models users can pick on the Codenaya key, the default for new runs,
          and what each costs us. Prices are USD per 1M tokens.
        </CardDescription>
        {models.length > 0 && (
          <CardAction>
            <Badge variant="outline" className="tabular-nums">
              {models.length} / {MAX_PLATFORM_MODELS}
            </Badge>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>{renderBody()}</CardContent>

      <AlertDialog open={!!pendingRemove} onOpenChange={(open) => !open && setPendingRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove the default model?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRemove?.name} is the default for new runs.{" "}
              {models.find((m) => m.id !== pendingRemove?.id)?.name} becomes the
              default instead. You can change it before saving.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingRemove && draft.remove(pendingRemove.id)}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};
