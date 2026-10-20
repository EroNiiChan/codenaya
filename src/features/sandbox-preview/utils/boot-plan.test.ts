import { describe, expect, it } from "vitest";

import { bootPlan } from "./boot-plan";

describe("bootPlan", () => {
  it("installs and runs a project with a root package.json", () => {
    expect(bootPlan(["package.json", "index.html", "src/main.ts"])).toBe("npm");
  });

  it("serves a plain index.html site statically", () => {
    expect(bootPlan(["index.html", "styles.css", "app.js"])).toBe("static");
  });

  it("ignores a package.json or index.html that isn't at the root", () => {
    expect(bootPlan(["web/package.json", "web/index.html"])).toBe("none");
  });

  it("has nothing to run without either file", () => {
    expect(bootPlan(["README.md"])).toBe("none");
  });

  it("runs the user's own dev command whatever the files", () => {
    expect(bootPlan(["index.html"], "python3 -m http.server 8000")).toBe("npm");
    expect(bootPlan(["main.py"], "python3 main.py")).toBe("npm");
  });
});
