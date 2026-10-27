"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";

interface AnimatedDotGridProps {
  className?: string;
  /** Grid column and row spacing in pixels. Defaults to 26px. */
  spacing?: number;
}

interface Stream {
  col: number;
  y: number;
  speed: number;
  length: number;
  isAmber: boolean;
}

/**
 * Superteam-inspired Dot Matrix Animation (Dark Mode Only).
 * Replaces falling ASCII characters with sleek, microscopic dots arranged on a grid.
 * Vertical streams of light glide down the grid columns with glowing heads and fading tails,
 * accompanied by interactive cursor glow and warm amber accents.
 */
export const AnimatedDotGrid = ({
  className,
  spacing = 26,
}: AnimatedDotGridProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    let animationFrameId: number;
    let isVisible = true;
    let width = 0;
    let height = 0;
    let streams: Stream[] = [];
    let lastTime = performance.now();

    // If not in dark mode, clear canvas and don't run animation loop
    if (resolvedTheme !== "dark") {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    // Interactive mouse coordinates
    let mouseX = -1000;
    let mouseY = -1000;

    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseX = e.clientX - rect.left;
      mouseY = e.clientY - rect.top;
    };

    const onMouseLeave = () => {
      mouseX = -1000;
      mouseY = -1000;
    };

    window.addEventListener("mousemove", onMouseMove, { passive: true });
    window.addEventListener("mouseleave", onMouseLeave, { passive: true });

    const initStreams = (numCols: number, canvasHeight: number) => {
      streams = [];
      const streamCount = Math.max(12, Math.floor(numCols * 0.38));
      for (let i = 0; i < streamCount; i++) {
        streams.push({
          col: Math.floor(Math.random() * numCols),
          y: Math.random() * canvasHeight,
          speed: 60 + Math.random() * 90,
          length: (4 + Math.floor(Math.random() * 6)) * spacing,
          isAmber: Math.random() < 0.28,
        });
      }
    };

    const drawStaticGrid = () => {
      if (width === 0 || height === 0) return;
      ctx.clearRect(0, 0, width, height);
      const cols = Math.ceil(width / spacing) + 1;
      const rows = Math.ceil(height / spacing) + 1;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          ctx.beginPath();
          ctx.arc(c * spacing, r * spacing, 1.2, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(240, 236, 230, 0.12)";
          ctx.fill();
        }
      }
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      // If layout hasn't settled yet, fallback to offset or parent dimensions
      const w = rect.width || canvas.offsetWidth || canvas.parentElement?.clientWidth || window.innerWidth;
      const h = rect.height || canvas.offsetHeight || canvas.parentElement?.clientHeight || window.innerHeight;

      if (w === 0 || h === 0) {
        requestAnimationFrame(resize);
        return;
      }

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = w;
      height = h;

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const numCols = Math.ceil(width / spacing) + 1;
      initStreams(numCols, height);

      if (prefersReducedMotion) {
        drawStaticGrid();
      }
    };

    resize();
    window.addEventListener("resize", resize, { passive: true });

    const resizeObserver = new ResizeObserver(() => {
      resize();
    });
    resizeObserver.observe(canvas);

    const observer = new IntersectionObserver(
      ([entry]) => {
        const wasHidden = !isVisible;
        isVisible = entry.isIntersecting;
        if (wasHidden && isVisible) {
          lastTime = performance.now();
        }
      },
      { threshold: 0 },
    );
    observer.observe(canvas);

    const handleVisibilityChange = () => {
      const wasHidden = !isVisible;
      isVisible = document.visibilityState === "visible";
      if (wasHidden && isVisible) {
        lastTime = performance.now();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    if (prefersReducedMotion) {
      return () => {
        window.removeEventListener("resize", resize);
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseleave", onMouseLeave);
        document.removeEventListener("visibilitychange", handleVisibilityChange);
        resizeObserver.disconnect();
        observer.disconnect();
      };
    }

    lastTime = performance.now();

    const render = (now: number) => {
      animationFrameId = requestAnimationFrame(render);

      if (!isVisible) return;
      if (width === 0 || height === 0) {
        resize();
        return;
      }

      const dt = Math.min(0.1, (now - lastTime) / 1000);
      lastTime = now;

      ctx.clearRect(0, 0, width, height);

      const cols = Math.ceil(width / spacing) + 1;
      const rows = Math.ceil(height / spacing) + 1;

      // Update stream positions
      for (let i = 0; i < streams.length; i++) {
        const s = streams[i];
        s.y += s.speed * dt;
        if (s.y - s.length > height) {
          s.y = -Math.random() * 100;
          s.col = Math.floor(Math.random() * cols);
          s.speed = 60 + Math.random() * 90;
          s.length = (4 + Math.floor(Math.random() * 6)) * spacing;
          s.isAmber = Math.random() < 0.28;
        }
      }

      // Render grid points
      for (let c = 0; c < cols; c++) {
        const x = c * spacing;

        let colStream: Stream | null = null;
        for (let i = 0; i < streams.length; i++) {
          if (streams[i].col === c) {
            colStream = streams[i];
            break;
          }
        }

        for (let r = 0; r < rows; r++) {
          const y = r * spacing;

          let alpha = 0.12;
          let radius = 1.2;
          let isAccent = (c * 17 + r * 23) % 19 === 0;
          let isHead = false;

          if (colStream) {
            const headY = colStream.y;
            const distBehindHead = headY - y;

            if (distBehindHead >= -spacing * 0.5 && distBehindHead <= colStream.length) {
              if (distBehindHead < spacing * 0.8) {
                isHead = true;
                alpha = 0.95;
                radius = 2.4;
                if (colStream.isAmber) isAccent = true;
              } else {
                const progress = 1 - distBehindHead / colStream.length;
                alpha = Math.max(alpha, 0.12 + progress * 0.65);
                radius = Math.max(radius, 1.2 + progress * 1.0);
                if (colStream.isAmber && progress > 0.3) isAccent = true;
              }
            }
          }

          // Mouse proximity illumination
          const dx = x - mouseX;
          const dy = y - mouseY;
          const mouseDist = Math.sqrt(dx * dx + dy * dy);
          if (mouseDist < 120) {
            const mouseEffect = Math.pow(1 - mouseDist / 120, 2);
            alpha = Math.min(1, alpha + mouseEffect * 0.6);
            radius = Math.max(radius, 1.2 + mouseEffect * 1.4);
          }

          ctx.beginPath();
          ctx.arc(x, y, radius, 0, Math.PI * 2);

          if (isHead) {
            ctx.fillStyle = isAccent
              ? `rgba(232, 130, 79, ${alpha})`
              : `rgba(255, 255, 255, ${alpha})`;
          } else if (isAccent) {
            ctx.fillStyle = `rgba(232, 130, 79, ${alpha})`;
          } else {
            ctx.fillStyle = `rgba(240, 236, 230, ${alpha})`;
          }
          ctx.fill();
        }
      }
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseleave", onMouseLeave);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      resizeObserver.disconnect();
      observer.disconnect();
    };
  }, [resolvedTheme, spacing]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={
        "pointer-events-none absolute inset-0 size-full transition-opacity duration-300 " +
        (resolvedTheme === "dark" ? "opacity-100" : "opacity-0 pointer-events-none") +
        (className ? ` ${className}` : "")
      }
    />
  );
};
