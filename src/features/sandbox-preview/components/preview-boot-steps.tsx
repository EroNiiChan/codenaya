"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";

import { cn } from "@/lib/utils";
import { formatDuration, useNow } from "@/features/conversations/components/agent-run";
import { BOOT_PHASES, type BootPhase } from "@/features/sandbox-preview/utils/boot-phase";

const STEPS: { phase: BootPhase; label: string }[] = [
  { phase: "create", label: "Create sandbox" },
  { phase: "files", label: "Write files" },
  { phase: "install", label: "Install dependencies" },
  { phase: "start", label: "Start dev server" },
];

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789#$%&*<>/";
const ANSI_ESCAPE = new RegExp(`${String.fromCharCode(27)}\\[[0-9;?]*[A-Za-z]`, "g");
const EASE_OUT = [0.23, 1, 0.32, 1] as const;

export type BootStepsVariant = "decrypt" | "blur";

/** Shows `text` resolving out of random glyphs, left to right. */
const DecryptText = ({ text }: { text: string }) => {
  const [shown, setShown] = useState(text);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const frames = 16;
    let frame = 0;
    const timer = setInterval(() => {
      frame += 1;
      const settled = Math.floor((frame / frames) * text.length);
      setShown(
        [...text]
          .map((char, index) =>
            index < settled || char === " "
              ? char
              : GLYPHS[Math.floor(Math.random() * GLYPHS.length)],
          )
          .join(""),
      );
      if (frame >= frames) clearInterval(timer);
    }, 32);
    return () => clearInterval(timer);
  }, [text]);

  return (
    <>
      <span aria-hidden="true">{shown}</span>
      <span className="sr-only">{text}</span>
    </>
  );
};

/** Each character rises out of a blur, one after another. */
const BlurInText = ({ text }: { text: string }) => (
  <>
    <span aria-hidden="true" className="inline-flex flex-wrap">
      {[...text].map((char, index) => (
        <motion.span
          key={index}
          initial={{ opacity: 0, y: 8, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.45, delay: index * 0.022, ease: EASE_OUT }}
          className="whitespace-pre"
        >
          {char}
        </motion.span>
      ))}
    </span>
    <span className="sr-only">{text}</span>
  </>
);

/**
 * The preview's boot as type (#254): what is happening right now, large, with
 * the finished and upcoming steps around it, a hairline progress and the
 * latest log line. It sits on the pane itself rather than in a card.
 * Elapsed time counts from mount, which is when the boot starts showing.
 */
export const PreviewBootSteps = ({
  phase,
  log,
  firstStepLabel,
  onShowLogs,
  variant = "decrypt",
}: {
  /** The phase in progress; `null` before the first one is reported. */
  phase: BootPhase | null;
  /** The boot's terminal output; its latest line shows under the steps. */
  log: string;
  /** WebContainer boots in the page, so its first step isn't a sandbox. */
  firstStepLabel?: string;
  /** Reveals the terminal; omitted while it is already showing. */
  onShowLogs?: () => void;
  variant?: BootStepsVariant;
}) => {
  const [startedAt] = useState(() => Date.now());
  const now = useNow(true);
  const key = phase ?? "create";
  const current = BOOT_PHASES.indexOf(key);
  // When each phase was first seen, for the per-step times.
  const [marks, setMarks] = useState<Partial<Record<BootPhase, number>>>({});
  if (marks[key] === undefined) setMarks({ ...marks, [key]: now });
  // Half credit for the step in progress, so the bar moves as each starts.
  const progress = Math.min(1, (current + 0.5) / STEPS.length);
  const lastLine = log
    .replace(ANSI_ESCAPE, "")
    .split(/\r?\n|\r/)
    .filter((line) => line.trim())
    .at(-1);

  return (
    <MotionConfig reducedMotion="user">
      <div
        role="status"
        aria-label="Starting preview"
        className="size-full overflow-y-auto bg-background"
      >
        <div className="mx-auto flex min-h-full w-full max-w-lg flex-col justify-center gap-7 px-6 py-8 @3xl:gap-9">
          <div className="space-y-3">
            <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              <span className="flex items-center gap-2">
                <span aria-hidden="true" className="relative flex size-1.5">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand opacity-70 motion-reduce:animate-none" />
                  <span className="relative inline-flex size-1.5 rounded-full bg-brand" />
                </span>
                Starting preview
              </span>
              <span className="tabular-nums">{formatDuration(now - startedAt)}</span>
            </div>
            <div aria-hidden="true" className="relative h-px w-full overflow-hidden bg-border">
              <motion.div
                className="absolute inset-y-0 left-0 bg-foreground"
                initial={false}
                animate={{ width: `${progress * 100}%` }}
                transition={{ duration: 0.8, ease: EASE_OUT }}
              />
              <motion.div
                className="absolute inset-y-0 w-24 bg-gradient-to-r from-transparent via-brand to-transparent"
                animate={{ left: ["-6rem", `${progress * 100}%`] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
              />
            </div>
          </div>

          <ol className="space-y-2.5">
            {STEPS.map((step, index) => {
              const state = index < current ? "done" : index === current ? "active" : "pending";
              const label = index === 0 && firstStepLabel ? firstStepLabel : step.label;
              const start = marks[step.phase];
              const end = state === "done" ? marks[BOOT_PHASES[index + 1]] : now;
              const time =
                state !== "pending" && start !== undefined && end !== undefined
                  ? formatDuration(end - start)
                  : null;
              return (
                <motion.li
                  key={step.phase}
                  layout
                  transition={{ duration: 0.5, ease: EASE_OUT }}
                  data-state={state}
                  aria-current={state === "active" ? "step" : undefined}
                  className={cn(
                    "flex items-baseline justify-between gap-4",
                    state === "active" ? "py-1.5" : "text-sm",
                    state === "done" && "text-muted-foreground",
                    state === "pending" && "text-muted-foreground/40",
                  )}
                >
                  <span
                    className={cn(
                      "flex min-w-0 items-baseline gap-3",
                      state === "active" &&
                        "text-2xl font-semibold tracking-tight text-foreground @3xl:text-4xl",
                      state === "active" && variant === "decrypt" && "font-mono font-medium tracking-tighter",
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className={cn(
                        "w-4 shrink-0 font-mono text-xs",
                        state === "done" && "text-brand",
                        state === "active" && "hidden",
                      )}
                    >
                      {state === "done" ? "✓" : "·"}
                    </span>
                    <span className="min-w-0">
                      {state !== "active" ? (
                        label
                      ) : variant === "decrypt" ? (
                        <>
                          <DecryptText key={label} text={label} />
                          <span
                            aria-hidden="true"
                            className="ml-1 inline-block h-[0.8em] w-[0.45em] translate-y-[0.08em] animate-pulse bg-brand motion-reduce:animate-none"
                          />
                        </>
                      ) : (
                        <BlurInText key={label} text={label} />
                      )}
                      <span className="sr-only">
                        {state === "done" ? " (done)" : state === "active" ? " (in progress)" : ""}
                      </span>
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                    {time}
                  </span>
                </motion.li>
              );
            })}
          </ol>

          <div className="flex min-h-5 items-center justify-between gap-4 font-mono text-xs text-muted-foreground">
            <div aria-hidden="true" className="relative min-w-0 flex-1 overflow-hidden">
              <AnimatePresence mode="popLayout" initial={false}>
                {lastLine && (
                  <motion.p
                    key={lastLine}
                    initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    exit={{ opacity: 0, y: -8, filter: "blur(4px)" }}
                    transition={{ duration: 0.3, ease: EASE_OUT }}
                    className="truncate"
                  >
                    <span className="text-brand">❯</span> {lastLine}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
            {onShowLogs && (
              <button
                type="button"
                onClick={onShowLogs}
                className="shrink-0 underline-offset-4 transition-colors hover:text-foreground hover:underline"
              >
                Show logs
              </button>
            )}
          </div>
        </div>
      </div>
    </MotionConfig>
  );
};
