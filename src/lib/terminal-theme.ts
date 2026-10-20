import type { ITheme } from "@xterm/xterm";

// Transparent so the terminal sits on its panel's own background. xterm's
// default red, blue, magenta and bright blue are under 4.5:1 on the dark
// panel (#216), so those are lifted; the rest of its palette already passes.
const darkTheme: ITheme = {
  background: "#00000000",
  red: "#f14c4c",
  blue: "#3b8eea",
  magenta: "#d670d6",
  brightBlue: "#5c8dff",
};

// xterm's defaults are meant for a dark background (white text, pale ANSI
// colours); these stay readable on the light panel.
const lightTheme: ITheme = {
  background: "#00000000",
  foreground: "#383a42",
  cursor: "#383a42",
  cursorAccent: "#faf8f5",
  selectionBackground: "#dce5f5",
  black: "#383a42",
  red: "#b02f37",
  green: "#2f6f1c",
  yellow: "#7a5c00",
  blue: "#2c58bb",
  magenta: "#a0229e",
  cyan: "#0b6a83",
  white: "#5f626c",
  brightBlack: "#5f626c",
  brightRed: "#9c1c24",
  brightGreen: "#245a14",
  brightYellow: "#9c4800",
  brightBlue: "#1f4699",
  brightMagenta: "#841b82",
  brightCyan: "#08566b",
  brightWhite: "#383a42",
};

/** xterm colours matching the app theme (`resolvedTheme` from next-themes). */
export const getTerminalTheme = (resolvedTheme?: string): ITheme =>
  resolvedTheme === "light" ? lightTheme : darkTheme;
