"use client";

import { useMemo, useState } from "react";
import ky from "ky";
import { CloudDownloadIcon, PlusIcon, RefreshCwIcon, SearchIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { aiProviderRequestError } from "@/features/ai-providers/hooks/use-ai-providers";
import { cn } from "@/lib/utils";

import type { PlatformModelDraft } from "../hooks/use-platform-model-draft";
import { type FetchedModel, MAX_PLATFORM_MODELS, type PlatformProviderId } from "../platform-models";
import { formatContext } from "./platform-models-card";

const NO_TOOLS_HINT = "No tool calling: the agent can't use this model";

const ToolsBadge = ({ tools }: { tools: boolean | null }) => {
  if (tools === true) return <Badge variant="secondary">Tools</Badge>;
  if (tools === null) {
    return (
      <Badge variant="outline" title="The provider doesn't say; you confirm it after adding">
        Tools?
      </Badge>
    );
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant="outline" tabIndex={0} className="text-muted-foreground">
          No tools
        </Badge>
      </TooltipTrigger>
      <TooltipContent>{NO_TOOLS_HINT}</TooltipContent>
    </Tooltip>
  );
};

const price = (model: FetchedModel) =>
  model.inputUsdPerMTok === undefined || model.outputUsdPerMTok === undefined
    ? null
    : `$${model.inputUsdPerMTok} / $${model.outputUsdPerMTok}`;

export const AddModelsCard = ({
  draft,
  provider,
  providerLabel,
}: {
  draft: PlatformModelDraft;
  provider: PlatformProviderId;
  providerLabel: string;
}) => {
  const [fetched, setFetched] = useState<FetchedModel[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [hideNoTools, setHideNoTools] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const added = useMemo(
    () => new Set(draft.draft?.models.map((m) => m.id)),
    [draft.draft?.models],
  );
  const room = MAX_PLATFORM_MODELS - added.size;

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (fetched ?? []).filter(
      (m) =>
        (!hideNoTools || m.tools !== false) &&
        (!query || `${m.name} ${m.id} ${m.vendor}`.toLowerCase().includes(query)),
    );
  }, [fetched, search, hideNoTools]);

  const fetchModels = async () => {
    setLoading(true);
    setError(null);
    try {
      const body = await ky
        .get("/api/admin/models", { searchParams: { provider }, timeout: 20_000 })
        .json<{ models: FetchedModel[] }>();
      setFetched(body.models);
      setSelected(new Set());
    } catch (e) {
      setError(await aiProviderRequestError(e));
    } finally {
      setLoading(false);
    }
  };

  const toggle = (id: string, checked: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });

  const addSelected = () => {
    draft.add((fetched ?? []).filter((m) => selected.has(m.id)));
    setSelected(new Set());
  };

  const renderList = () => {
    if (loading && !fetched) {
      return (
        <div className="space-y-2" aria-label="Loading models">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-11 w-full" />
          ))}
        </div>
      );
    }
    if (!fetched) return null;
    if (visible.length === 0) {
      return (
        <p className="py-8 text-center text-sm text-muted-foreground">
          No models match. Try another search
          {hideNoTools ? " or show models without tool calling" : ""}.
        </p>
      );
    }

    return (
      <ScrollArea className="h-[min(28rem,60vh)] rounded-md border">
        <ul className="divide-y">
          {visible.map((model) => {
            const isAdded = added.has(model.id);
            const isChecked = isAdded || selected.has(model.id);
            const disabled =
              isAdded || model.tools === false || (!isChecked && selected.size >= room);
            const id = `fetched-${model.id}`;
            return (
              <li
                key={model.id}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 text-sm",
                  !disabled && "hover:bg-muted/50",
                  model.tools === false && "opacity-60",
                )}
              >
                <Checkbox
                  id={id}
                  checked={isChecked}
                  disabled={disabled}
                  onCheckedChange={(checked) => toggle(model.id, checked === true)}
                />
                <Label htmlFor={id} className="min-w-0 flex-1 flex-col items-start gap-0.5 font-normal">
                  <span className="w-full truncate font-medium">{model.name}</span>
                  <span className="w-full truncate font-mono text-xs text-muted-foreground">
                    {model.id}
                  </span>
                </Label>
                <span className="hidden w-14 text-right text-xs tabular-nums text-muted-foreground sm:block">
                  {formatContext(model.contextLength)}
                </span>
                <span className="hidden w-28 text-right text-xs tabular-nums sm:block">
                  {price(model) ?? <span className="text-muted-foreground">Set price</span>}
                </span>
                {isAdded ? <Badge>Added</Badge> : <ToolsBadge tools={model.tools} />}
              </li>
            );
          })}
        </ul>
      </ScrollArea>
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add models</CardTitle>
        <CardDescription>
          Live from {providerLabel}. Models without tool calling can&apos;t run the
          agent, so they can&apos;t be added.
        </CardDescription>
        {fetched && (
          <CardAction>
            <Button variant="outline" size="sm" onClick={fetchModels} disabled={loading}>
              {loading ? <Spinner /> : <RefreshCwIcon aria-hidden="true" />}
              Refresh
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertTitle>Couldn&apos;t fetch models</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!fetched && (
          <Button onClick={fetchModels} disabled={loading}>
            {loading ? <Spinner /> : <CloudDownloadIcon aria-hidden="true" />}
            Fetch models from {providerLabel}
          </Button>
        )}

        {fetched && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <InputGroup className="sm:max-w-sm">
              <InputGroupAddon>
                <SearchIcon aria-hidden="true" />
              </InputGroupAddon>
              <InputGroupInput
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, id or vendor"
                aria-label="Search models"
              />
            </InputGroup>
            <div className="flex items-center gap-2">
              <Switch
                id="hide-no-tools"
                checked={hideNoTools}
                onCheckedChange={setHideNoTools}
              />
              <Label htmlFor="hide-no-tools" className="font-normal">
                Hide models without tool calling
              </Label>
            </div>
          </div>
        )}

        {renderList()}
      </CardContent>
      {fetched && (
        <CardFooter className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground tabular-nums">
            Showing {visible.length} of {fetched.length}
            {room <= 0 ? ` · the ${MAX_PLATFORM_MODELS}-model limit is reached` : ""}
          </p>
          <Button size="sm" onClick={addSelected} disabled={selected.size === 0}>
            <PlusIcon aria-hidden="true" />
            {selected.size ? `Add ${selected.size} selected` : "Add selected"}
          </Button>
        </CardFooter>
      )}
    </Card>
  );
};
