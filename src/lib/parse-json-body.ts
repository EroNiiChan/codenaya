import { NextResponse } from "next/server";
import { z } from "zod";

type ParseJsonBodyResult<T> =
  | { data: T; invalid: undefined }
  | { data: undefined; invalid: NextResponse };

/**
 * Reads and validates a route handler's JSON body. Malformed JSON and schema
 * failures both get `400 { error: "Invalid request", details }` instead of a
 * thrown 500 (#235):
 *
 *   const { data, invalid } = await parseJsonBody(request, requestSchema);
 *   if (invalid) return invalid;
 */
export const parseJsonBody = async <S extends z.ZodType>(
  request: Request,
  schema: S,
): Promise<ParseJsonBodyResult<z.output<S>>> => {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return {
      data: undefined,
      invalid: NextResponse.json(
        { error: "Invalid request", details: z.flattenError(parsed.error).fieldErrors },
        { status: 400 },
      ),
    };
  }
  return { data: parsed.data, invalid: undefined };
};
