import { describe, expect, it } from "vitest";

import { isBootPhase, recordBootPhase, type BootHistory } from "./boot-phase";

describe("boot phase protocol", () => {
  it("retains timestamps across batched phases", () => {
    let history: BootHistory = {};
    history = recordBootPhase(history, "create", 1000);
    history = recordBootPhase(history, "files", 3500);
    history = recordBootPhase(history, "install", 6000);
    expect(history.files!.at - history.create!.at).toBe(2500);
    expect(recordBootPhase(history, "files", 9000)).toBe(history);
  });

  it("ignores unknown phases and invalid timestamps", () => {
    const history: BootHistory = {};
    expect(isBootPhase("ready")).toBe(true);
    expect(isBootPhase("unknown")).toBe(false);
    for (const at of [undefined, "1000", NaN, Infinity, -1]) {
      expect(recordBootPhase(history, "create", at)).toBe(history);
    }
    expect(recordBootPhase(history, "unknown", 1000)).toBe(history);
  });
});
