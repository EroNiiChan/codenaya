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
export function autoClosedOverlap(
  suggestion: string,
  textBeforeCursor: string,
  textAfterCursor: string
): number {
  const run = /^[)\]}"'`]*/.exec(textAfterCursor)![0];
  // A quote after the cursor closes a string only when the line before the
  // cursor left one open; otherwise it opens a string already in the file.
  // ponytail: counts escaped quotes and apostrophes in comments too.
  let end = 0;
  while (end < run.length && (!QUOTES.includes(run[end]) || textBeforeCursor.split(run[end]).length % 2 === 0)) {
    end++;
  }
  const closers = run.slice(0, end);
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
