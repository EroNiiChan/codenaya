const CLOSER: Record<string, string> = { "(": ")", "[": "]", "{": "}" };
const QUOTES = "\"'`";

/**
 * How many characters after the cursor an accepted suggestion replaces (#268).
 *
 * CodeMirror auto-closes brackets and quotes, so typing `multiply(` leaves a
 * `)` after the cursor. When the suggestion closes that pair itself
 * (`a: number) {`), the auto-inserted closer is replaced instead of
 * duplicated. A closer only counts at the suggestion's own depth 0, so
 * `fn(x)` inside `console.log(|)` keeps the outer `)`; a suggestion that
 * never closes the pair is inserted before it, as before.
 */
export function autoClosedOverlap(suggestion: string, textAfterCursor: string): number {
  const closers = /^[)\]}"'`]*/.exec(textAfterCursor)![0];
  // Brackets and strings the suggestion opened itself.
  const open: string[] = [];
  let matched = 0;

  for (const char of suggestion) {
    const expected = closers[matched];
    if (expected === undefined) break;
    const inner = open.at(-1);

    if (inner && QUOTES.includes(inner)) {
      if (char === inner) open.pop();
    } else if (!inner && QUOTES.includes(expected)) {
      // Inside the auto-closed string: only its own quote ends it.
      if (char === expected) matched++;
    } else if (inner && char === CLOSER[inner]) {
      open.pop();
    } else if (!inner && char === expected) {
      matched++;
    } else if (char in CLOSER || QUOTES.includes(char)) {
      open.push(char);
    }
  }

  return matched;
}
