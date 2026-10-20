/**
 * Every scrape is billed to the platform Firecrawl key and its markdown goes
 * into a prompt, so a request scrapes at most this many URLs, each truncated
 * (#242). Separate from `firecrawl.ts` so Workflow tool schemas can import it
 * without loading the Node-only client.
 */
export const MAX_SCRAPE_URLS = 10;
export const MAX_SCRAPED_CHARS = 50_000;
