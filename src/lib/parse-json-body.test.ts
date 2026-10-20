import { describe, expect, it } from "vitest";
import { z } from "zod";

import { parseJsonBody } from "./parse-json-body";

const schema = z.object({ name: z.string() });

const post = (body: string) =>
  new Request("http://localhost/api", { method: "POST", body });

describe("parseJsonBody", () => {
  it("answers 400 for malformed JSON", async () => {
    const { data, invalid } = await parseJsonBody(post("{not json"), schema);

    expect(data).toBeUndefined();
    expect(invalid?.status).toBe(400);
    expect(await invalid?.json()).toMatchObject({ error: "Invalid request" });
  });

  it("answers 400 with the failing fields when the schema rejects the body", async () => {
    const { invalid } = await parseJsonBody(post("{}"), schema);

    expect(invalid?.status).toBe(400);
    expect(await invalid?.json()).toMatchObject({
      error: "Invalid request",
      details: { name: expect.any(Array) },
    });
  });

  it("returns the parsed body", async () => {
    const result = await parseJsonBody(post('{"name":"a","extra":1}'), schema);

    expect(result).toEqual({ data: { name: "a" }, invalid: undefined });
  });
});
