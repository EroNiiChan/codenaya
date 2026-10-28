import { useState } from "react";
import { useQuery } from "convex/react";
import ky from "ky";

import { isPromoActive } from "../github-promo";
import { api } from "../../../../convex/_generated/api";

/** The signed-in user's promo claim: null if none, undefined while loading. */
export const usePromoClaim = () => useQuery(api.promoClaims.getMine);

/**
 * Whether the promotion is running, read once per mount. A page left open
 * past the end still shows it; the server refuses claims and runs either way.
 */
export const usePromoActive = () => useState(() => isPromoActive(Date.now()))[0];

/** Claims the promotion. A refusal rejects with the route's `{ error, code }`. */
export const claimPromo = () =>
  ky.post("/api/promotions/claim", { timeout: 30_000 }).json<{ claimed: true }>();
