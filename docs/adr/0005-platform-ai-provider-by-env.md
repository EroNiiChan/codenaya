# 0005. Platform AI provider chosen by env; Workflow backend retired

- Status: Accepted
- Date: 2026-10-22
- Related: ADR 0002 (supersedes its "platform model is OpenRouter" and
  `MESSAGE_PROCESSOR=workflow` bullets)

## Context

Codenaya's own models (users without a key of their own) were hard-wired to
OpenRouter (`src/lib/openrouter.ts`, `inngest/lib/openrouter-model.ts`). We want to
run the platform on OpenRouter, OpenAI, Anthropic or Groq without code changes, and
BYOK (`features/ai-providers`) already builds agent and editor models for every one of
them through `buildAgentKitModel` / `buildAiSdkModel`.

A second message backend, Vercel Workflow on Google Vertex
(`MESSAGE_PROCESSOR=workflow`), existed as a fallback. It never got BYOK, the model
picker, images, MCP tools, skills, the build-check gate or the step trail, so it was
not behaviorally equivalent, as ADR 0002 required. Production already runs on Inngest.
Every platform-model change (provider switch, admin model selection, usage metering)
would need a second, divergent implementation there.

## Decision

- **`NEXT_PUBLIC_AI_PROVIDER` picks the platform provider**: `openrouter` | `openai` |
  `anthropic` | `groq`. Unset or invalid falls back to `openrouter` (today's behavior)
  and an invalid value is logged once. It is public because it holds no secret and the
  model picker needs it; changing it needs a redeploy.
- `features/ai-providers/platform.ts` (pure, client-safe) resolves the provider and its
  models. `resolvePlatformModel` is the allowlist: an unknown, removed or
  other-provider model id (an old conversation's) runs on the provider's default. It
  takes an admin model selection (`config`), `null` until one is stored.
- `features/ai-providers/server/platform-model.ts` is the only code that reads the
  platform keys (`OPENROUTER_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`,
  `GROQ_API_KEY`). Only the active provider's key is required. Keys never reach the
  client, Convex, a step result or a log.
- Without the active key, a send is refused with 503 `{ code: "ai_not_configured" }`
  before anything is created, a run already queued ends with a reply that says so, and
  editor AI answers 503. The env var name is logged server-side, not shown to users.
- Groq joins the registry as an OpenAI-compatible provider, which also makes it
  available for BYOK.
- **The Workflow backend is removed.** Inngest is the only message backend.
  `messages.workflowRunId` stays as a legacy optional field because rows carry it.

## Alternatives considered

- **Port the Workflow backend to the new provider switch.** It doubles the risky work
  (provider switch, model gate, metering) for a path production doesn't use.
- **A server-only provider var plus an API for the client.** Adds a round-trip and a
  route for a value that isn't secret.
- **Keep OpenRouter and switch models only.** OpenRouter can't use our direct provider
  accounts or Groq's latency.

## Consequences

- Switching provider is an env change plus a redeploy. Saved model ids from another
  provider keep working by falling back to the default.
- Anthropic on the agent path is text-only (AgentKit's adapter forwards no images), so
  its models are marked non-vision and images are refused before the run.
- Anthropic runs show no reasoning trace and get no prompt caching; revisit if it
  becomes the main provider.
- Removing Workflow drops about 900 lines and three dependencies. A run in flight on
  Workflow at cutover is failed by the "fail lost agent runs" cron.
