import { cn } from "@/lib/utils";

export interface CodenayaLogoProps extends React.SVGProps<SVGSVGElement> {
  size?: number | string;
  blinking?: boolean;
  variant?: "default" | "on-dark" | "on-light" | "on-ember" | "monochrome";
  ringColor?: string;
  cursorColor?: string;
}

/**
 * Official Codenaya Brand Mark:
 * - Canvas: 120 x 120 units
 * - Ring: Outer radius 50, inner radius 28, stroke 22
 * - Opening: 76°, cut square along the radius
 * - Cursor: 14 x 28 with a 2 unit corner radius
 * - Gap: 3 units between the cursor and each end of the ring
 * - Optical centre: x = 59
 */
export function CodenayaLogo({
  size = 24,
  className,
  blinking = false,
  variant = "default",
  ringColor,
  cursorColor,
  ...props
}: CodenayaLogoProps) {
  // Determine ring and cursor colors based on the official brand guidelines
  let resolvedRing = ringColor ?? "currentColor";
  let resolvedCursor = cursorColor ?? "var(--ember, #FF5F3A)";

  if (!ringColor && !cursorColor) {
    switch (variant) {
      case "on-dark":
        resolvedRing = "#FAFAF9"; // Paper 50
        resolvedCursor = "#FF5F3A"; // Ember
        break;
      case "on-light":
        resolvedRing = "#09090B"; // Ink 950
        resolvedCursor = "#E5481F"; // Ember deep
        break;
      case "on-ember":
        resolvedRing = "#09090B"; // Ink 950
        resolvedCursor = "#FAFAF9"; // Paper 50
        break;
      case "monochrome":
        resolvedRing = "currentColor";
        resolvedCursor = "currentColor";
        break;
      case "default":
      default:
        // By default, the ring inherits the text/surface color (currentColor),
        // and the cursor uses CSS token --ember (#FF5F3A on dark, #E5481F on light).
        resolvedRing = "currentColor";
        resolvedCursor = "var(--ember, #FF5F3A)";
        break;
    }
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 120 120"
      width={size}
      height={size}
      fill="none"
      className={cn("shrink-0 select-none", className)}
      aria-label="Codenaya"
      role="img"
      {...props}
    >
      <path
        fill={resolvedRing}
        d="M99.4 29.2A50 50 0 1 0 99.4 90.8L82.1 77.2A28 28 0 1 1 82.1 42.8Z"
      />
      <rect
        x="94"
        y="46"
        width="14"
        height="28"
        rx="2"
        fill={resolvedCursor}
        className={cn(
          blinking &&
            "animate-[logo-cursor-blink_1s_infinite_ease-in-out] motion-reduce:animate-none"
        )}
      />
    </svg>
  );
}
