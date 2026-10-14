# Loop log

Running log of quality cycles on main: what merged, audit results, open P0/P1 count, e2e smoke status.
Newest entry first.

## 2026-10-14 — cycle 4 (main @ 26eaf72)

### Merged since cycle 3 (2026-10-08, a3b4f96)

Fixes

- #277 fix(#79): return KEK config errors from setEnvVar without step retries
- #278 fix(#219): show folder names and paths instead of "a file" in tool errors
- #281 fix(#80): generate project names from curated word lists
- #284 fix(#221): reference-check blob deletes so a remix can't delete the publisher's files

Features

- #280 feat(chat): show model reasoning in Thought rows
- #289 Preview: pre-warm the E2B sandbox during the first build and open it when the run ends (part 1 of #254)

UI

- #285 Showcase: unlist test entries, featured curation, cover-art fallback on detail
- #329 feat(#255): collapse the preview terminal into a status strip by default

Tests and docs

- #326 test(e2e): match the Portfolio starter chip by exact name
- #346 docs: engineering standards and the first ADRs

Also merged on 2026-10-08 up to the cycle 3 baseline (a3b4f96), verified on main this cycle:

- Fixes: #193 #197 #201 #202 #205 #213 #214 #215 #220
- Features: #192 #194 #195 #198 #203 #206
- Tests, CI and docs: #196 #199 #200 #207

### Audit results

- e2e smoke on c1f5746: 142 passed / 3 failed / 9 skipped. One deterministic test bug (#287, fixed in #326); two load flakes that passed on rerun.
- Gates: tsc 0 errors; lint 0 errors / 129 warnings; vitest 90 files / 908 tests pass; build ok; knip unchanged (64 unused files); jscpd 29 clones / 1.70% (up from 1.28%).
- UI sweep: 174 captures at 375/768/1440 in dark and light; no overflow, no console errors, no failed requests.
- Core flows: prompt → agent → E2B preview → edit → restore → image input → ZIP → publish → remix → import all work. Starter templates are broken (#328).
- Architecture health: 7 pairs of mutually importing features; 0 `ConvexError` usages vs 110 plain throws (#354).

### Verified fixed on main

#43 #46 #47 #48 #54 #55 #68 #79 #80 #97 #116 #120 #143 #179 #190 #204 #208 #209 #219 #221 #279

### New issues this cycle

Quality findings:

- P1: #328
- P2: #354 #286
- P3: #327 #355 #356 #357 #358 #359 #360 (plus #287, fixed in #326)

Competitive gaps:

- P2: #361 #362 #363 #364 (bug)
- P3: #365

Roadmap enhancements also filed today (#288–#353) are tracked separately; their P1s count toward the open P1 total below.

### Open P0/P1 at time of writing

- P0 (1): #222
- P1 (31): #105 #223 #224 #225 #226 #254 #266 #290 #291 #292 #293 #294 #299 #300 #306 #307 #312 #313 #314 #320 #321 #322 #328 #330 #331 #332 #333 #337 #338 #339 #343

### Smoke status

Green except known flakes. Done criterion (no new findings above P2): not met this cycle (new P1 #328).
