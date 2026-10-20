import { describe, expect, it } from "vitest";

import { autoClosedOverlap } from "./reconcile";

/** The line after accepting `suggestion` at the cursor between `before` and `after`. */
const accept = (before: string, suggestion: string, after: string) =>
  before + suggestion + after.slice(autoClosedOverlap(suggestion, before, after));

describe("autoClosedOverlap (#268)", () => {
  it("replaces an auto-closed closer the suggestion spans", () => {
    expect(accept("multiply(", "a: number, b: number) {", ")")).toBe(
      "multiply(a: number, b: number) {"
    );
    expect(accept("const xs = [", "1, 2];", "]")).toBe("const xs = [1, 2];");
    expect(accept("const o = {", " a: 1 };", "}")).toBe("const o = { a: 1 };");
    expect(accept('import x from "', 'react";', '"')).toBe('import x from "react";');
    expect(accept('foo("', 'bar", 2);', '")')).toBe('foo("bar", 2);');
  });

  it("keeps the closer when the suggestion stops inside the pair", () => {
    expect(accept("multiply(", "a: number, b: number", ")")).toBe(
      "multiply(a: number, b: number)"
    );
    expect(accept("arr.map(", "x => x + 1", ")")).toBe("arr.map(x => x + 1)");
    expect(accept('import x from "', "react", '"')).toBe('import x from "react"');
  });

  it("ignores closers of brackets and strings the suggestion opened itself", () => {
    expect(accept("console.log(", "fn(x)", ")")).toBe("console.log(fn(x))");
    expect(accept("foo(", "{ a: [1] }", ")")).toBe("foo({ a: [1] })");
    expect(accept("foo(", '")"', ")")).toBe('foo(")")');
  });

  it("replaces nothing when no closer follows the cursor", () => {
    expect(autoClosedOverlap("a) {", "f(", "")).toBe(0);
    expect(autoClosedOverlap("a) {", "f(", " x)")).toBe(0);
  });

  it("keeps a quote after the cursor that opens a string already in the file", () => {
    expect(accept("const s = ", '"pre" + ', '"abc";')).toBe('const s = "pre" + "abc";');
  });
});
