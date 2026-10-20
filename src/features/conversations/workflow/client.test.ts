import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  start: vi.fn(),
  mutation: vi.fn(),
}));

vi.mock("workflow/api", () => ({ start: mocks.start, getRun: vi.fn() }));
vi.mock("@/lib/convex-client", () => ({ convex: { mutation: mocks.mutation } }));
vi.mock("./process-message.workflow", () => ({ processMessageWorkflow: vi.fn() }));

import { startProcessMessageWorkflow } from "./client";
import type { Id } from "../../../../convex/_generated/dataModel";

describe("startProcessMessageWorkflow", () => {
  it("keeps the internal key out of the persisted workflow input (#211)", async () => {
    mocks.start.mockResolvedValue({ runId: "run_1" });
    const input = {
      internalKey: "secret-key",
      messageId: "m1" as Id<"messages">,
      conversationId: "c1" as Id<"conversations">,
      projectId: "p1" as Id<"projects">,
      message: "hi",
      // Callers pass their whole dispatch input; extra fields must not leak in.
      model: { keyId: "k1", modelId: "x" },
    };

    await startProcessMessageWorkflow(input);

    const [, [workflowInput]] = mocks.start.mock.calls[0];
    expect(workflowInput).toEqual({
      messageId: "m1",
      conversationId: "c1",
      projectId: "p1",
      message: "hi",
      mode: undefined,
    });
    expect(JSON.stringify(workflowInput)).not.toContain("secret-key");
    expect(mocks.mutation).toHaveBeenCalledWith(expect.anything(), {
      internalKey: "secret-key",
      messageId: "m1",
      workflowRunId: "run_1",
    });
  });
});
