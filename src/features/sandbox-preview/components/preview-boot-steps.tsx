"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from "motion/react";

import { cn } from "@/lib/utils";
import { formatDuration } from "@/lib/format-duration";
import { useNow } from "@/hooks/use-now";
import { BOOT_PHASES, type BootHistory, type BootPhase } from "@/features/sandbox-preview/utils/boot-phase";

const STEPS: { phase: BootPhase; label: string }[] = [
  { phase: "create", label: "Create sandbox" },
  { phase: "files", label: "Write files" },
  { phase: "install", label: "Install dependencies" },
  { phase: "start", label: "Start dev server" },
];

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789#$%&*<>/=+";
const ANSI_ESCAPE = new RegExp(`${String.fromCharCode(27)}\\[[0-9;?]*[A-Za-z]`, "g");
const EASE_OUT = [0.23, 1, 0.32, 1] as const;
const STREAM_LINES = 5;

const randomGlyph = () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)];

const logLines = (log: string) =>
  log
    .replace(ANSI_ESCAPE, "")
    .split(/\r?\n|\r/)
    .filter((line) => line.trim());

/**
 * Morphs `from` into `text` on mount: every character cycles through glyphs
 * and settles, left to right, out of a blur.
 */
const MorphText = ({ text, from }: { text: string; from: string }) => {
  const [chars, setChars] = useState(() => [...from].map((char) => ({ char, settled: false })));

  useEffect(() => {
    const still = from === text || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const length = Math.max(from.length, text.length);
    const frames = still ? 1 : 22;
    let frame = 0;
    const timer = setInterval(() => {
      frame += 1;
      // Characters settle left to right, each after a short spin.
      const settledUpTo = still ? length : ((frame - 4) / (frames - 4)) * length;
      const next = Array.from({ length }, (_, index) => {
        const target = text[index] ?? "";
        if (index < settledUpTo) return { char: target, settled: true };
        if (target === " ") return { char: " ", settled: true };
        return { char: randomGlyph(), settled: false };
      }).filter((entry, index) => index < text.length || !entry.settled);
      setChars(next);
      if (frame >= frames) clearInterval(timer);
    }, 34);
    return () => clearInterval(timer);
  }, [text, from]);

  return (
    <>
      <span aria-hidden="true" className="whitespace-pre-wrap break-words">
        {chars.map(({ char, settled }, index) => (
          <span
            key={index}
            className={cn(
              "inline-block transition-[filter,opacity,color] duration-300",
              !settled && "text-brand opacity-70 blur-[1.5px]",
            )}
          >
            {char}
          </span>
        ))}
      </span>
      <span className="sr-only">{text}</span>
    </>
  );
};

/** Types `text` out once, a few characters per frame. */
const TypedLine = ({ text }: { text: string }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const perFrame = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? text.length : 3;
    const timer = setInterval(() => {
      setCount((value) => {
        if (value >= text.length) clearInterval(timer);
        return Math.min(text.length, value + perFrame);
      });
    }, 16);
    return () => clearInterval(timer);
  }, [text]);

  return (
    <>
      {text.slice(0, count)}
      <span className="ml-0.5 inline-block h-[1em] w-[0.5em] translate-y-[0.15em] animate-pulse bg-brand motion-reduce:animate-none" />
    </>
  );
};

/**
 * The preview's boot as type on the pane (#254). The step in progress is set
 * large and morphs into the next one; a finished step collapses into the
 * history above it. Elapsed time counts from mount, which is when the boot
 * starts showing.
 */
export const PreviewBootSteps = ({
  phase,
  history,
  log,
  firstStepLabel,
}: {
  /** The phase in progress; `null` before the first one is reported. */
  phase: BootPhase | null;
  history?: BootHistory;
  /** The boot's terminal output. */
  log: string;
  /** WebContainer boots in the page, so its first step isn't a sandbox. */
  firstStepLabel?: string;
}) => {
  const [startedAt] = useState(() => Date.now());
  const now = useNow(true);
  const reduceMotion = useReducedMotion();
  const key = phase ?? "create";
  const current = Math.min(BOOT_PHASES.indexOf(key), STEPS.length - 1);
  // When each phase was first seen, for the per-step times.
  const [observedMarks, setMarks] = useState<BootHistory>({});
  if (!history && observedMarks[key] === undefined)
    setMarks({ ...observedMarks, [key]: { at: now } });
  const marks = history ?? observedMarks;

  const progress = Math.min(1, (current + 0.5) / STEPS.length);
  const labelOf = (index: number) =>
    index === 0 && firstStepLabel ? firstStepLabel : STEPS[index].label;
  const lines = logLines(log);
  const done = STEPS.slice(0, current);
  const upcoming = STEPS.slice(current + 1);
  const active = STEPS[current];
  const activeStart = marks[active.phase]?.at;

  const stepTime = (index: number) => {
    const start = marks[STEPS[index].phase]?.at;
    const end = marks[BOOT_PHASES[index + 1]]?.at;
    return start !== undefined && end !== undefined ? formatDuration(end - start) : null;
  };

  return (
    <MotionConfig reducedMotion="user">
      <div
        role="status"
        aria-label="Starting preview"
        className="size-full overflow-y-auto bg-background"
      >
        <div className="mx-auto flex min-h-full w-full max-w-lg flex-col justify-center gap-6 px-6 py-8 @3xl:gap-8">
          <div className="space-y-3">
            <div className="flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              <span className="flex items-center gap-2">
                <span aria-hidden="true" className="relative flex size-1.5">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-brand opacity-70 motion-reduce:animate-none" />
                  <span className="relative inline-flex size-1.5 rounded-full bg-brand" />
                </span>
                Starting preview
              </span>
              <span className="tabular-nums">{formatDuration(now - (marks.create?.at ?? startedAt))}</span>
            </div>
            <div aria-hidden="true" className="relative h-px w-full overflow-hidden bg-border">
              <motion.div
                className="absolute inset-y-0 left-0 bg-foreground"
                initial={false}
                animate={{ width: `${progress * 100}%` }}
                transition={{ type: "spring", stiffness: 70, damping: 20 }}
              />
              <motion.div
                className="absolute inset-y-0 w-24 bg-gradient-to-r from-transparent via-brand to-transparent"
                animate={reduceMotion ? { left: "0%" } : { left: ["-6rem", `${progress * 100}%`] }}
                transition={{ duration: 1.6, repeat: reduceMotion ? 0 : Infinity, ease: "easeInOut" }}
              />
            </div>
          </div>

          <ol className="flex flex-col">
            {/* Finished steps: each collapses in from the stage. */}
            <AnimatePresence initial={false}>
              {done.map((step, index) => (
                <motion.li
                  key={step.phase}
                  layout
                  initial={{ opacity: 0, scale: 1.9, y: 36, filter: "blur(6px)" }}
                  animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
                  transition={{ duration: 0.6, ease: EASE_OUT }}
                  style={{ originX: 0 }}
                  data-state="done"
                  className="text-sm text-muted-foreground"
                >
                  <div className="flex h-7 items-baseline justify-between gap-4">
                    <span className="flex min-w-0 items-baseline gap-3">
                      <span aria-hidden="true" className="w-4 shrink-0 font-mono text-xs text-brand">
                        ✓
                      </span>
                      <span className="truncate">
                        {labelOf(index)}
                        <span className="sr-only"> (done)</span>
                      </span>
                    </span>
                    <span className="shrink-0 font-mono text-xs tabular-nums">{stepTime(index)}</span>
                  </div>
                </motion.li>
              ))}
            </AnimatePresence>

            {/* The stage: the step in progress, large, morphing into the next. */}
            <motion.li
              layout
              data-state="active"
              aria-current="step"
              className="py-3"
              transition={{ duration: 0.5, ease: EASE_OUT }}
            >
              <motion.div
                key={active.phase}
                initial={{ scale: 0.94, opacity: 0.6 }}
                animate={{ scale: reduceMotion ? 1 : [0.94, 1.03, 1], opacity: 1 }}
                transition={{ duration: 0.7, ease: EASE_OUT }}
                style={{ originX: 0 }}
                className="text-3xl font-semibold tracking-tight text-foreground @3xl:text-5xl"
              >
                <MorphText text={labelOf(current)} from={current > 0 ? labelOf(current - 1) : ""} />
                <span className="sr-only"> (in progress)</span>
              </motion.div>
              <div className="mt-2 flex items-center gap-3 font-mono text-xs text-muted-foreground">
                <span>
                  Step {current + 1} of {STEPS.length}
                </span>
                <span aria-hidden="true" className="h-px w-6 bg-border" />
                <span className="tabular-nums">
                  {activeStart !== undefined ? formatDuration(now - activeStart) : null}
                </span>
              </div>
            </motion.li>

            {upcoming.map((step) => (
              <motion.li
                key={step.phase}
                layout
                transition={{ duration: 0.5, ease: EASE_OUT }}
                data-state="pending"
                className="flex h-7 items-baseline gap-3 text-sm text-muted-foreground/40"
              >
                <span aria-hidden="true" className="w-4 shrink-0 font-mono text-xs">
                  ·
                </span>
                {labelOf(STEPS.indexOf(step))}
              </motion.li>
            ))}
          </ol>

          <div
            aria-hidden="true"
            className="space-y-1 font-mono text-xs text-muted-foreground [mask-image:linear-gradient(to_bottom,transparent,#000_45%)]"
          >
            <AnimatePresence initial={false} mode="popLayout">
              {lines.slice(-STREAM_LINES).map((line, index, shown) => (
                <motion.p
                  key={`${lines.length - shown.length + index}`}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.25, ease: EASE_OUT }}
                  className="truncate"
                >
                  <span className="text-brand">❯</span>{" "}
                  {index === shown.length - 1 ? <TypedLine text={line} /> : line}
                </motion.p>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </MotionConfig>
  );
};
