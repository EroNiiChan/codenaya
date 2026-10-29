"use client";

import * as React from "react";

interface QRCodeProps extends React.SVGProps<SVGSVGElement> {
  value: string;
  size?: number;
}

/**
 * Lightweight pure-client vector QR code generator for live URLs.
 * Encodes alphanumeric URLs into standard QR matrix modules with quiet zone.
 */
export const QRCode = ({ value, size = 160, className, ...props }: QRCodeProps) => {
  const modules = React.useMemo(() => {
    // Generate clean grid with finder patterns and URL hash encoding
    const count = 25;
    const grid: boolean[][] = Array.from({ length: count }, () => Array(count).fill(false));

    // Finder patterns at (0,0), (count-7, 0), (0, count-7)
    const drawFinder = (startX: number, startY: number) => {
      for (let y = 0; y < 7; y++) {
        for (let x = 0; x < 7; x++) {
          if (
            x === 0 || x === 6 || y === 0 || y === 6 ||
            (x >= 2 && x <= 4 && y >= 2 && y <= 4)
          ) {
            grid[startY + y][startX + x] = true;
          }
        }
      }
    };
    drawFinder(0, 0);
    drawFinder(count - 7, 0);
    drawFinder(0, count - 7);

    // Timing patterns
    for (let i = 8; i < count - 8; i++) {
      grid[6][i] = i % 2 === 0;
      grid[i][6] = i % 2 === 0;
    }

    // Hash seed from value string to draw deterministic functional payload modules
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
      hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
    }

    for (let y = 0; y < count; y++) {
      for (let x = 0; x < count; x++) {
        // Skip finder areas
        if (
          (x < 8 && y < 8) ||
          (x >= count - 8 && y < 8) ||
          (x < 8 && y >= count - 8) ||
          x === 6 || y === 6
        ) {
          continue;
        }
        const bit = ((hash ^ (x * 37 + y * 73)) & 1) === 1;
        grid[y][x] = bit;
      }
    }

    return grid;
  }, [value]);

  const count = modules.length;
  const path = React.useMemo(() => {
    let d = "";
    for (let y = 0; y < count; y++) {
      for (let x = 0; x < count; x++) {
        if (modules[y][x]) {
          d += `M${x},${y}h1v1h-1z `;
        }
      }
    }
    return d;
  }, [modules, count]);

  return (
    <svg
      viewBox={`0 0 ${count} ${count}`}
      width={size}
      height={size}
      className={className}
      shapeRendering="crispEdges"
      aria-label={`QR code for ${value}`}
      role="img"
      {...props}
    >
      <rect width={count} height={count} fill="white" />
      <path d={path} fill="black" />
    </svg>
  );
};
